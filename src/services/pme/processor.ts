/**
 * PME Processing Pipeline (PRD sections #53, #54) + in-memory async queue.
 *
 * UPLOADED -> EXTRACTING -> VALIDATING -> (REVIEW_REQUIRED) -> ANALYZING -> COMPLETED
 *                                        \-> FAILED
 *
 * Jobs run sequentially to control AI cost. In a Redis/BullMQ deployment the
 * enqueue() function is the only point that would change.
 */
import { db } from "@/lib/db";
import { readPmePdf } from "@/lib/storage";
import { downloadPdfFromDrive } from "@/services/storage/google-drive";
import { normalizeDocument } from "./pdf-processor";
import { getActiveRule, computeZStatus } from "./zscore-engine";
import { validateResult, isSourceTraceable, type RawExtractionResult } from "./validation-engine";
import { extractPMEData, analyzePMEResult, QuotaExceededError, assertQuota } from "@/services/ai/extraction-service";
import { PROMPT_VERSION } from "@/services/ai/prompts";

interface Job {
  sessionId: string;
  organizationId: string;
  userId?: string | null;
}

interface QueueState {
  jobs: Job[];
  running: boolean;
  activeSessionIds: Set<string>;
}

// Survive Next.js HMR by stashing the queue on globalThis
const g = globalThis as unknown as { __pmeQueue?: QueueState };
const queue: QueueState =
  g.__pmeQueue || (g.__pmeQueue = { jobs: [], running: false, activeSessionIds: new Set() });

export function isProcessing(sessionId: string): boolean {
  return queue.activeSessionIds.has(sessionId);
}

export function enqueueSession(sessionId: string, organizationId: string, userId?: string | null): Promise<void> {
  if (queue.activeSessionIds.has(sessionId)) return Promise.resolve();
  queue.jobs.push({ sessionId, organizationId, userId });
  return pump();
}

export async function pump(): Promise<void> {
  if (queue.running) return;
  queue.running = true;
  try {
    while (queue.jobs.length > 0) {
      const job = queue.jobs.shift()!;
      try {
        await processSession(job);
      } catch (err) {
        console.error("[pme-processor-fatal]", err);
        await failSession(job.sessionId, "INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown processing error");
      } finally {
        queue.activeSessionIds.delete(job.sessionId);
      }
    }
  } finally {
    queue.running = false;
  }
}

async function setStage(sessionId: string, status: string, detail?: string) {
  await db.pmeSession.update({
    where: { id: sessionId },
    data: { status, statusDetail: detail ?? null, updatedAt: new Date() },
  });
}

async function logStage(sessionId: string, stage: string, status: "STARTED" | "SUCCESS" | "FAILED", message?: string) {
  await db.extractionLog.create({
    data: { sessionId, stage, status, message: message?.slice(0, 500) ?? null },
  });
}

async function failSession(sessionId: string, errorCode: string, message: string) {
  await db.pmeSession
    .update({
      where: { id: sessionId },
      data: { status: "FAILED", errorCode, errorMessage: message.slice(0, 1000), updatedAt: new Date() },
    })
    .catch(() => undefined);
}

function normalizeResultsArray(raw: unknown): RawExtractionResult[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as { results?: unknown };
  const results = Array.isArray(obj.results) ? obj.results : Array.isArray(raw) ? raw : [];
  return results.filter((r): r is RawExtractionResult => Boolean(r) && typeof r === "object");
}

function normalizeMeta(raw: unknown) {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pme = (obj.pme && typeof obj.pme === "object" ? obj.pme : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  return {
    provider: str(pme.provider),
    program: str(pme.program),
    cycle: str(pme.cycle),
    period: str(pme.period),
    participantId: str(pme.participant_id),
    laboratoryName: str(pme.laboratory_name),
  };
}

/** Core pipeline for one PME session. */
export async function processSession(job: Job): Promise<void> {
  const { sessionId, organizationId, userId } = job;
  queue.activeSessionIds.add(sessionId);

  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, organizationId },
    include: { file: true },
  });
  if (!session || !session.file) {
    await failSession(sessionId, "NOT_FOUND", "Sesi PME tidak ditemukan");
    return;
  }

  try {
    /* ---------- 1. classify + normalize ---------- */
    await setStage(sessionId, "EXTRACTING", "Membaca & mengklasifikasi dokumen PDF...");
    await logStage(sessionId, "CLASSIFY", "STARTED");
    let buffer: Buffer | null = null;
    // 1. Prioritaskan membaca langsung dari penyimpanan lokal (sangat cepat < 1ms)
    if (session.file.filePath) {
      try {
        buffer = await readPmePdf(session.file.filePath);
      } catch (e) {
        console.warn("[processor] Gagal membaca dari storage lokal, mencoba Google Drive:", e);
      }
    }
    // 2. Cadangan jika berkas lokal tidak ada (misalnya cold restart serverless)
    if (!buffer && session.file.driveFileId) {
      try {
        buffer = await downloadPdfFromDrive(session.file.driveFileId);
      } catch (e) {
        console.warn("[processor] Gagal membaca dari Google Drive:", e);
      }
    }
    if (!buffer) {
      throw new Error("Berkas PDF tidak dapat ditemukan di penyimpanan lokal maupun di Google Drive.");
    }
    const doc = await normalizeDocument(buffer, session.file.fileName, true);
    await db.pmeFile.update({ where: { id: session.file.id }, data: { pageCount: doc.pageCount, pdfClass: doc.pdfClass } });
    await logStage(sessionId, "CLASSIFY", "SUCCESS", `${doc.pdfClass}, ${doc.pageCount} halaman`);

    /* ---------- 2. Data extraction (Gemini primary, fallback enabled) ---------- */
    await setStage(sessionId, "EXTRACTING", "Sistem sedang membaca dokumen (ekstraksi data)...");
    await logStage(sessionId, "EXTRACT", "STARTED");

    const { extraction, providerName } = await extractPMEData(
      {
        fileName: session.file.fileName,
        pdfBase64: buffer.toString("base64"),
        pdfClass: doc.pdfClass,
        pages: doc.pages,
      },
      { organizationId, userId, pmeSessionId: sessionId, operation: "PDF_EXTRACTION" }
    );
    await logStage(sessionId, "EXTRACT", "SUCCESS", `Provider: ${providerName}`);
    const meta = normalizeMeta(extraction);

    /* ---------- 3. validation + z-score engine ---------- */
    await setStage(sessionId, "VALIDATING", "Validasi data & penerapan aturan Z-score...");
    await logStage(sessionId, "VALIDATE", "STARTED");
    const rule = await getActiveRule(organizationId);

    const rawResults = normalizeResultsArray(extraction);
    // duplicate parameter detection (extraction conflict)
    const seen = new Map<string, number>();
    for (const r of rawResults) {
      const key = (r.parameter || "").toString().trim().toLowerCase();
      if (!key) continue;
      seen.set(key, (seen.get(key) || 0) + 1);
    }

    await db.pmeResult.deleteMany({ where: { sessionId } }); // reprocess-safe

    const pageTexts = doc.pages.map((p) => p.text || "");

    const rows = rawResults.map((r) => {
      const validated = validateResult(r);
      const key = validated.parameterName.trim().toLowerCase();
      if (key && (seen.get(key) || 0) > 1) validated.issues.push("DUPLICATE_PARAMETER");
      // anti-hallucination trace: AI-quoted source text must exist in the document
      if (!isSourceTraceable(validated.sourceText, pageTexts, validated.sourcePage)) {
        validated.issues.push("UNVERIFIED_SOURCE");
      }
      const critical = ["LOW_CONFIDENCE", "MISSING_Z_SCORE", "MISSING_VALUE", "INVALID_NUMBER", "SIGN_CONFLICT", "OCR_CONFLICT", "UNVERIFIED_SOURCE"];
      const validationStatus = validated.issues.some((i) => critical.includes(i)) ? "REVIEW_REQUIRED" : "VALID";
      const zStatus = computeZStatus(validated.zScore, rule);
      return {
        sessionId,
        organizationId,
        parameterName: validated.parameterName.slice(0, 300),
        participantValue: validated.participantValue,
        targetValue: validated.targetValue,
        sdpa: validated.sdpa,
        zScore: validated.zScore,
        unit: validated.unit,
        method: validated.method,
        instrument: validated.instrument,
        peerGroup: validated.peerGroup,
        providerRemark: validated.providerRemark,
        allParticipantsCount: validated.allParticipantsCount,
        allParticipantsTarget: validated.allParticipantsTarget,
        allParticipantsSdpa: validated.allParticipantsSdpa,
        allParticipantsZScore: validated.allParticipantsZScore,
        allParticipantsStatus: validated.allParticipantsStatus,
        methodCount: validated.methodCount,
        methodTarget: validated.methodTarget,
        methodSdpa: validated.methodSdpa,
        methodZScore: validated.methodZScore,
        methodStatus: validated.methodStatus,
        instrumentCount: validated.instrumentCount,
        instrumentTarget: validated.instrumentTarget,
        instrumentSdpa: validated.instrumentSdpa,
        instrumentZScore: validated.instrumentZScore,
        instrumentStatus: validated.instrumentStatus,
        parameterConfidence: validated.parameterConfidence,
        participantConfidence: validated.participantConfidence,
        targetConfidence: validated.targetConfidence,
        zScoreConfidence: validated.zScoreConfidence,
        sourcePage: validated.sourcePage,
        sourceText: validated.sourceText,
        sourceBbox: validated.sourceBbox,
        issues: JSON.stringify(validated.issues),
        validationStatus,
        analysisStatus: "PENDING",
        reviewStatus: "NONE",
        zStatus,
      };
    });

    // Drop rows with no numeric data at all ("parameter tidak dianalisa" / all-dash rows).
    // A PME result needs at least one of: participant value, target, SDPA or Z-score;
    // fully empty rows carry no analytical value and would only create review noise.
    const dataRows = rows.filter(
      (row) =>
        row.participantValue !== null || row.targetValue !== null || row.zScore !== null || row.sdpa !== null
    );
    const noDataDropped = rows.length - dataRows.length;

    if (dataRows.length > 0) {
      await db.pmeResult.createMany({ data: dataRows });
    }

    const hasReview = dataRows.some((r) => r.validationStatus === "REVIEW_REQUIRED");
    await db.pmeSession.update({
      where: { id: sessionId },
      data: {
        provider: meta.provider,
        program: meta.program,
        cycle: meta.cycle,
        period: meta.period,
        participantId: meta.participantId,
        laboratoryName: meta.laboratoryName,
        ruleVersion: rule.ruleVersion,
        aiProvider: providerName,
        rawExtraction: JSON.stringify(extraction).slice(0, 200_000),
        updatedAt: new Date(),
      },
    });
    const validateMsg = noDataDropped
      ? `${dataRows.length} hasil divalidasi, ${noDataDropped} baris tanpa data dilewati (aturan ${rule.ruleVersion})`
      : `${dataRows.length} hasil divalidasi (aturan ${rule.ruleVersion})`;
    await logStage(sessionId, "VALIDATE", "SUCCESS", validateMsg);

    /* ---------- 4. Evaluation for non-satisfactory results ---------- */
    if (hasReview) {
      await setStage(sessionId, "REVIEW_REQUIRED", "Beberapa data memerlukan review manual sebelum evaluasi lanjutan.");
      await logStage(sessionId, "COMPLETE", "SUCCESS", "Status: REVIEW_REQUIRED");
      return;
    }

    await runAnalysisStage(sessionId, organizationId, userId);

    await setStage(sessionId, "COMPLETED", "Pemrosesan selesai.");
    await logStage(sessionId, "COMPLETE", "SUCCESS", "Status: COMPLETED");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      await failSession(sessionId, "AI_USAGE_LIMIT_REACHED", err.message);
      await logStage(sessionId, "EXTRACT", "FAILED", err.message);
      return;
    }
    const code = err instanceof Error ? err.message.slice(0, 80) : "INTERNAL_ERROR";
    await failSession(sessionId, "GEMINI_API_ERROR", err instanceof Error ? err.message : String(err));
    await logStage(sessionId, "EXTRACT", "FAILED", code);
    throw err;
  }
}

/**
 * Analyze stage: interpretation for WARNING/UNSATISFACTORY results.
 * Satisfactory results are marked SKIPPED (available on-demand from the UI).
 */
export async function runAnalysisStage(sessionId: string, organizationId: string, userId?: string | null, limit = 10, singleResultId?: string): Promise<{ analyzed: number; skippedQuota: boolean }> {
  const session = await db.pmeSession.findFirst({ where: { id: sessionId, organizationId } });
  if (!session) return { analyzed: 0, skippedQuota: false };

  await setStage(sessionId, "ANALYZING", "Sistem menganalisis hasil yang perlu perhatian...");

  const rawCandidates = await db.pmeResult.findMany({
    where: {
      sessionId,
      ...(singleResultId
        ? { id: singleResultId, analysisStatus: { in: ["PENDING", "SKIPPED"] } }
        : { analysisStatus: "PENDING", zStatus: { in: ["WARNING", "UNSATISFACTORY"] } }),
    },
    orderBy: [{ zScore: "asc" }],
    take: singleResultId ? 1 : limit,
  });

  const candidates = rawCandidates.filter((r) => {
    const hasZ = [r.zScore, r.instrumentZScore, r.methodZScore, r.allParticipantsZScore].some(
      (z) => typeof z === "number" && !isNaN(z)
    );
    if (!hasZ) {
      void db.pmeResult.update({ where: { id: r.id }, data: { analysisStatus: "SKIPPED" } }).catch(() => undefined);
      return false;
    }
    return true;
  });

  // History for trend context: prefetch in a single batch query for maximum speed
  const previousSessions = await db.pmeSession.findMany({
    where: { organizationId, status: "COMPLETED", id: { not: sessionId } },
    select: { id: true, cycle: true, period: true },
    orderBy: { createdAt: "asc" },
    take: 6,
  });

  const previousSessionIds = previousSessions.map((s) => s.id);
  const prevResults =
    previousSessionIds.length > 0 && candidates.length > 0
      ? await db.pmeResult.findMany({
          where: {
            sessionId: { in: previousSessionIds },
            parameterName: { in: candidates.map((c) => c.parameterName) },
          },
          select: { sessionId: true, parameterName: true, zScore: true, zStatus: true },
        })
      : [];

  const historyMap = new Map<string, { cycle: string | null; period: string | null; z_score: number | null; status: string | null }[]>();
  for (const cand of candidates) {
    const entries: { cycle: string | null; period: string | null; z_score: number | null; status: string | null }[] = [];
    for (const s of previousSessions) {
      const found = prevResults.find((pr) => pr.sessionId === s.id && pr.parameterName === cand.parameterName);
      if (found && found.zScore !== null) {
        entries.push({
          cycle: s.cycle,
          period: s.period,
          z_score: found.zScore,
          status: found.zStatus,
        });
      }
    }
    historyMap.set(cand.id, entries);
  }

  let analyzed = 0;
  let skippedQuota = false;

  // Analisis kandidat secara paralel (concurrency batch: 4) untuk memangkas waktu proses hingga maksimal
  const BATCH_SIZE = 4;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (result) => {
        try {
          await assertQuota(organizationId);
          const historyEntries = historyMap.get(result.id) || [];

          const { analysis, providerName } = await analyzePMEResult(
            {
              parameter: result.parameterName,
              participant_value: result.participantValue,
              target_value: result.targetValue,
              z_score: result.zScore,
              status: result.zStatus || "UNKNOWN",
              unit: result.unit,
              method: result.method,
              instrument: result.instrument,
              all_participants_group: {
                count: result.allParticipantsCount,
                target: result.allParticipantsTarget,
                sdpa: result.allParticipantsSdpa,
                z_score: result.allParticipantsZScore,
                status: result.allParticipantsStatus,
              },
              method_group: {
                name: result.method,
                count: result.methodCount,
                target: result.methodTarget,
                sdpa: result.methodSdpa,
                z_score: result.methodZScore,
                status: result.methodStatus,
              },
              instrument_group: {
                name: result.instrument,
                count: result.instrumentCount,
                target: result.instrumentTarget,
                sdpa: result.instrumentSdpa,
                z_score: result.instrumentZScore,
                status: result.instrumentStatus,
              },
              history: historyEntries,
            },
            { organizationId, userId, pmeSessionId: sessionId, operation: "PME_ANALYSIS" }
          );

          await db.aiAnalysis.upsert({
            where: { resultId: result.id },
            create: {
              resultId: result.id,
              interpretation: analysis.interpretation || "",
              possibleCauses: JSON.stringify(analysis.possible_causes || []),
              investigationSteps: JSON.stringify(analysis.investigation_steps || []),
              correctiveActions: JSON.stringify(analysis.corrective_actions || []),
              preventiveActions: JSON.stringify(analysis.preventive_actions || []),
              instrumentEvaluation: analysis.instrument_evaluation || null,
              methodEvaluation: analysis.method_evaluation || null,
              biasAnalysis: analysis.bias_analysis || null,
              provider: providerName,
              model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
              promptVersion: PROMPT_VERSION,
            },
            update: {
              interpretation: analysis.interpretation || "",
              possibleCauses: JSON.stringify(analysis.possible_causes || []),
              investigationSteps: JSON.stringify(analysis.investigation_steps || []),
              correctiveActions: JSON.stringify(analysis.corrective_actions || []),
              preventiveActions: JSON.stringify(analysis.preventive_actions || []),
              instrumentEvaluation: analysis.instrument_evaluation || null,
              methodEvaluation: analysis.method_evaluation || null,
              biasAnalysis: analysis.bias_analysis || null,
              provider: providerName,
              model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
              promptVersion: PROMPT_VERSION,
            },
          });
          await db.pmeResult.update({
            where: { id: result.id },
            data: { analysisStatus: "DONE", updatedAt: new Date() },
          });
          analyzed += 1;
        } catch (err) {
          if (err instanceof QuotaExceededError) {
            skippedQuota = true;
            await db.pmeResult.update({ where: { id: result.id }, data: { analysisStatus: "SKIPPED" } });
          } else {
            console.error(`[analysis-failed] ${result.parameterName}:`, err);
            await db.pmeResult.update({ where: { id: result.id }, data: { analysisStatus: "FAILED" } });
          }
        }
      })
    );
  }

  let remainingCount = 0;
  if (!singleResultId) {
    const remaining = await db.pmeResult.updateMany({
      where: { sessionId, analysisStatus: "PENDING" },
      data: { analysisStatus: "SKIPPED" },
    });
    remainingCount = remaining.count;
  }

  if (skippedQuota) {
    await setStage(sessionId, "COMPLETED", `Analisis AI dihentikan sebagian: kuota bulanan tercapai. (${analyzed} dianalisis, ${remainingCount} dilewati)`);
  } else {
    await setStage(sessionId, "COMPLETED", "Pemrosesan selesai.");
  }
  return { analyzed, skippedQuota };
}
