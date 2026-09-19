import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import {
  calculateDescriptiveStats,
  runDixonQTest,
  evaluateParticipantResult,
  calculatePeerGroup,
  DescriptiveStats,
  DixonTestResult,
} from "@/lib/pme-stats-engine";

export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const isSuperAdmin = user.role === "SUPERADMIN";
    const effectiveOrgId = getEffectiveOrgId(user, req);
    const orgFilter = effectiveOrgId === "ALL" ? {} : { organizationId: effectiveOrgId };

    let participantLab: any = null;
    if (!isSuperAdmin) {
      participantLab = await db.pmeParticipant.findFirst({
        where: { organizationId: user.organizationId },
      });
      if (!participantLab) {
        participantLab = await db.pmeParticipant.findFirst({
          where: { email: user.email },
        });
      }
      if (!participantLab) {
        return jsonError("Akses ditolak. Akun Anda belum terdaftar sebagai peserta PME.", 403, "FORBIDDEN");
      }
    }

    // 1. Dapatkan daftar seluruh siklus yang ada di pmeSubmission dan pmeParticipant
    const [subCycles, partCycles] = await Promise.all([
      db.pmeSubmission.findMany({
        where: isSuperAdmin ? orgFilter : { participantId: participantLab.id },
        select: { cycle: true },
        distinct: ["cycle"],
        orderBy: { submittedAt: "desc" },
      }),
      db.pmeParticipant.findMany({
        where: isSuperAdmin ? orgFilter : { id: participantLab.id },
        select: { cycle: true },
        distinct: ["cycle"],
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const availableCyclesSet = new Set<string>();
    subCycles.forEach((s) => s.cycle && availableCyclesSet.add(s.cycle.trim()));
    partCycles.forEach((p) => p.cycle && availableCyclesSet.add(p.cycle.trim()));
    if (availableCyclesSet.size === 0) {
      availableCyclesSet.add("Siklus 1 2026");
    }
    const availableCycles = Array.from(availableCyclesSet);

    // Tentukan siklus yang dianalisa
    const rawCycleParam = req.nextUrl.searchParams.get("cycle")?.trim();
    let cycle = rawCycleParam;
    
    if (!cycle || (cycle === "Siklus 2 2025" && !availableCycles.includes("Siklus 2 2025"))) {
      cycle = availableCycles[0] || "Siklus 1 2026";
    }

    const categoryParam = req.nextUrl.searchParams.get("category")?.trim();
    const packageCategory = categoryParam && categoryParam !== "ALL" ? categoryParam : "ALL";
    const targetParticipantId = req.nextUrl.searchParams.get("participantId");

    // 2. Ambil data Kop Surat & Penandatangan resmi
    let [kopSurat, signer] = await Promise.all([
      db.kopSurat.findFirst({
        where: effectiveOrgId !== "ALL" ? { organizationId: effectiveOrgId } : { organizationId: user.organizationId },
      }),
      db.pmeSigner.findFirst({
        where: effectiveOrgId !== "ALL" ? { organizationId: effectiveOrgId } : { organizationId: user.organizationId },
      }),
    ]);

    if (!kopSurat) {
      kopSurat = await db.kopSurat.findFirst();
    }
    if (!signer) {
      signer = await db.pmeSigner.findFirst();
    }
    if (!signer) {
      signer = {
        id: "default-signer",
        organizationId: user.organizationId,
        namaPejabat: "dr. Lisa Dewi, MKes",
        jabatan: "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan",
        tempat: "Palembang",
        tanggal: "14 November 2025",
        nip: "196907172001122001",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // 3. Ambil paket-paket dalam kategori ini (jika ALL, ambil semua paket)
    const packageWhere: any = {};
    if (effectiveOrgId !== "ALL") {
      packageWhere.organizationId = effectiveOrgId;
    }
    if (packageCategory !== "ALL") {
      packageWhere.category = packageCategory;
    }

    const packages = await db.pmePackage.findMany({
      where: packageWhere,
      include: {
        parameters: { orderBy: { sortOrder: "asc" } },
      },
    });

    // Kumpulkan daftar parameter master
    const masterParams: {
      id: string;
      name: string;
      unit: string | null;
      sortOrder: number;
      defaultMethodCode: string | null;
      defaultInstrumentCode: string | null;
    }[] = [];

    for (const pkg of packages) {
      for (const p of pkg.parameters) {
        if (!masterParams.some((mp) => mp.name.toLowerCase().trim() === p.name.toLowerCase().trim())) {
          masterParams.push({
            id: p.id,
            name: p.name,
            unit: p.unit,
            sortOrder: p.sortOrder,
            defaultMethodCode: p.defaultMethodCode,
            defaultInstrumentCode: p.defaultInstrumentCode,
          });
        }
      }
    }

    // 4. Ambil SEMUA submissions peserta untuk siklus ini untuk kalkulasi biostatistik peer group yang akurat
    const allCycleSubmissions = await db.pmeSubmission.findMany({
      where: {
        cycle,
        status: { in: ["SUBMITTED", "VALIDATED", "PUBLISHED"] },
      },
      include: {
        participant: true,
        results: true,
      },
      orderBy: { submittedAt: "asc" },
    });

    // Pastikan setiap parameter yang ada di submission results peserta juga masuk ke masterParams
    let dynSort = masterParams.length + 1;
    for (const sub of allCycleSubmissions) {
      for (const res of sub.results) {
        if (!masterParams.some((mp) => mp.name.toLowerCase().trim() === res.parameterName.toLowerCase().trim())) {
          masterParams.push({
            id: `dyn-${res.id}`,
            name: res.parameterName,
            unit: res.unit || null,
            sortOrder: dynSort++,
            defaultMethodCode: res.methodCode || null,
            defaultInstrumentCode: res.instrumentCode || null,
          });
        }
      }
    }
    masterParams.sort((a, b) => a.sortOrder - b.sortOrder);

    // 5. Biostatistical Calculation per Parameter (Global, Method Groups, Instrument Groups)
    const paramStatsMap = new Map<
      string,
      {
        stats: DescriptiveStats | null;
        dixon: DixonTestResult;
        methodStats: Map<string, { n: number; target: number | null; sdpa: number | null; isAnalyzed: boolean }>;
        instrumentStats: Map<string, { n: number; target: number | null; sdpa: number | null; isAnalyzed: boolean }>;
      }
    >();

    for (const p of masterParams) {
      const pNameLower = p.name.toLowerCase().trim();

      const allValues: number[] = [];
      const methodGroups = new Map<string, number[]>();
      const instrumentGroups = new Map<string, number[]>();

      for (const sub of allCycleSubmissions) {
        const res = sub.results.find((r) => r.parameterName.toLowerCase().trim() === pNameLower);
        if (res && res.value !== null && res.value !== undefined && !isNaN(res.value)) {
          allValues.push(res.value);

          // Group by method
          const mCode = res.methodCode?.trim() || p.defaultMethodCode || "STD";
          if (!methodGroups.has(mCode)) methodGroups.set(mCode, []);
          methodGroups.get(mCode)!.push(res.value);

          // Group by instrument
          const iCode = res.instrumentCode?.trim() || p.defaultInstrumentCode || "STD";
          if (!instrumentGroups.has(iCode)) instrumentGroups.set(iCode, []);
          instrumentGroups.get(iCode)!.push(res.value);
        }
      }

      // Hitung ISO 13528 statistik deskriptif & Dixon Q-Test
      const stats = calculateDescriptiveStats(allValues);
      const dixon = runDixonQTest(allValues);

      // Hitung per metode
      const methodStats = new Map<string, { n: number; target: number | null; sdpa: number | null; isAnalyzed: boolean }>();
      for (const [mCode, vals] of methodGroups.entries()) {
        methodStats.set(mCode, calculatePeerGroup(vals, 6));
      }

      // Hitung per alat
      const instrumentStats = new Map<string, { n: number; target: number | null; sdpa: number | null; isAnalyzed: boolean }>();
      for (const [iCode, vals] of instrumentGroups.entries()) {
        instrumentStats.set(iCode, calculatePeerGroup(vals, 6));
      }

      paramStatsMap.set(pNameLower, { stats, dixon, methodStats, instrumentStats });
    }

    // 6. Tentukan daftar submissions yang akan ditampilkan pada laporan
    let reportSubmissions = allCycleSubmissions;
    if (!isSuperAdmin) {
      // Peserta HANYA melihat submission miliknya yang SUDAH DIPUBLIKASI (isPublished: true)
      reportSubmissions = allCycleSubmissions.filter(
        (sub) => sub.participantId === participantLab.id && sub.isPublished === true
      );

      // Jika peserta belum dipublish atau laporannya ditarik kembali oleh Superadmin
      if (reportSubmissions.length === 0) {
        const anySub = allCycleSubmissions.find((sub) => sub.participantId === participantLab.id);
        return jsonOk({
          cycle,
          category: packageCategory,
          availableCycles,
          isSuperAdmin: false,
          isParticipant: true,
          participant: participantLab,
          isPublished: false,
          isValidated: anySub?.isValidated ?? false,
          message: anySub
            ? `Laporan Hasil PME ${participantLab.labName} untuk ${cycle} belum dipublikasikan atau telah ditarik kembali oleh Penyelenggara (Superadmin) untuk evaluasi. Lembar evaluasi resmi akan tampil kembali setelah dikirimkan oleh Superadmin.`
            : `Belum ada data pengiriman hasil pemeriksaan PME untuk ${cycle}.`,
          kopSurat,
          signer,
          participantReports: [],
        });
      }
    } else {
      // Superadmin filter by targetParticipantId if provided
      if (targetParticipantId && targetParticipantId !== "ALL") {
        reportSubmissions = reportSubmissions.filter((s) => s.participantId === targetParticipantId);
      }
    }

    // 7. Generate Individual Participant Reports (Format Kemenkes Labkesmas)
    const participantReports = [];
    let totalSatisfactory = 0;
    let totalWarning = 0;
    let totalUnsatisfactory = 0;
    let totalOutliers = 0;

    for (const sub of reportSubmissions) {
      const rows = [];
      let participantWarningCount = 0;
      let participantUnsatisfactoryCount = 0;
      let participantNotAnalyzedInstrumentCount = 0;

      for (let i = 0; i < masterParams.length; i++) {
        const p = masterParams[i];
        const pNameLower = p.name.toLowerCase().trim();
        const pStat = paramStatsMap.get(pNameLower);

        const res = sub.results.find((r) => r.parameterName.toLowerCase().trim() === pNameLower);
        const hasResult = res && res.value !== null && res.value !== undefined && !isNaN(res.value);
        const val = hasResult ? res.value! : null;

        const mCode = res?.methodCode?.trim() || p.defaultMethodCode || "-";
        const iCode = res?.instrumentCode?.trim() || p.defaultInstrumentCode || "-";

        if (hasResult && pStat && pStat.stats) {
          const globalTarget = pStat.stats.median;
          const globalSdpa = pStat.stats.sdpa;

          // Evaluasi Seluruh Peserta
          const evalResult = evaluateParticipantResult(val!, globalTarget, globalSdpa, pStat.stats);

          if (evalResult.statusText === "Memuaskan") totalSatisfactory++;
          else if (evalResult.statusText === "Peringatan") {
            totalWarning++;
            participantWarningCount++;
          } else if (evalResult.statusText === "Tidak Memuaskan") {
            totalUnsatisfactory++;
            participantUnsatisfactoryCount++;
          }

          if (evalResult.outlierStatus !== "NORMAL") {
            totalOutliers++;
          }

          // Evaluasi Kelompok Metode (Minimal 6 peserta)
          const mPeer = pStat.methodStats.get(mCode);
          let methodEval = null;
          if (mPeer && mPeer.isAnalyzed && mPeer.target !== null && mPeer.sdpa !== null) {
            methodEval = evaluateParticipantResult(val!, mPeer.target, mPeer.sdpa);
          }

          // Evaluasi Kelompok Alat (Minimal 6 peserta)
          const iPeer = pStat.instrumentStats.get(iCode);
          let instrumentEval = null;
          if (iPeer && iPeer.isAnalyzed && iPeer.target !== null && iPeer.sdpa !== null) {
            instrumentEval = evaluateParticipantResult(val!, iPeer.target, iPeer.sdpa);
          } else {
            participantNotAnalyzedInstrumentCount++;
          }

          // Perhitungan Bias % Spesifik
          const biasMethodPercent =
            mPeer?.target !== null && mPeer?.target !== undefined && mPeer.target !== 0
              ? Number((((val! - mPeer.target) / mPeer.target) * 100).toFixed(2))
              : null;

          const biasInstrumentPercent =
            iPeer?.target !== null && iPeer?.target !== undefined && iPeer.target !== 0
              ? Number((((val! - iPeer.target) / iPeer.target) * 100).toFixed(2))
              : null;

          rows.push({
            no: i + 1,
            parameterName: p.name,
            unit: p.unit || "",
            methodCode: mCode,
            instrumentCode: iCode,
            participantValue: val,
            // Seluruh Peserta
            global: {
              n: pStat.stats.n,
              target: globalTarget,
              sdpa: globalSdpa,
              zScore: evalResult.zScore,
              category: evalResult.category,
              keterangan: evalResult.statusText,
            },
            // Kelompok Metode
            method: {
              n: mPeer ? mPeer.n : 0,
              target: mPeer?.target ?? null,
              sdpa: mPeer?.sdpa ?? null,
              zScore: methodEval?.zScore ?? null,
              category: methodEval?.category ?? "-",
              keterangan: mPeer?.isAnalyzed ? (methodEval?.statusText ?? "-") : "Tidak dianalisa",
              isAnalyzed: mPeer?.isAnalyzed ?? false,
            },
            // Kelompok Alat
            instrument: {
              n: iPeer ? iPeer.n : 0,
              target: iPeer?.target ?? null,
              sdpa: iPeer?.sdpa ?? null,
              zScore: instrumentEval?.zScore ?? null,
              category: instrumentEval?.category ?? "-",
              keterangan: iPeer?.isAnalyzed ? (instrumentEval?.statusText ?? "-") : "Tidak dianalisa",
              isAnalyzed: iPeer?.isAnalyzed ?? false,
            },
            // Metrik Statistik Lengkap
            biasPercent: evalResult.biasPercent !== null ? Number(evalResult.biasPercent.toFixed(2)) : null,
            biasMethodPercent,
            biasInstrumentPercent,
            cvPercent: evalResult.cvRef !== null ? Number(evalResult.cvRef.toFixed(2)) : null,
            totalErrorPercent: evalResult.totalErrorPercent !== null ? Number(evalResult.totalErrorPercent.toFixed(2)) : null,
            outlierStatus: evalResult.outlierStatus,
            dixonStatus:
              pStat.dixon.isApplicable && (pStat.dixon.isLowOutlier || pStat.dixon.isHighOutlier)
                ? pStat.dixon.status
                : "Normal",
          });
        } else {
          // Parameter tidak diperiksa / kosong
          rows.push({
            no: i + 1,
            parameterName: p.name,
            unit: p.unit || "",
            methodCode: "-",
            instrumentCode: "-",
            participantValue: null,
            global: { n: 0, target: null, sdpa: null, zScore: null, category: "-", keterangan: "-" },
            method: { n: 0, target: null, sdpa: null, zScore: null, category: "-", keterangan: "-", isAnalyzed: false },
            instrument: { n: 0, target: null, sdpa: null, zScore: null, category: "-", keterangan: "-", isAnalyzed: false },
            biasPercent: null,
            biasMethodPercent: null,
            biasInstrumentPercent: null,
            cvPercent: null,
            totalErrorPercent: null,
            outlierStatus: "NORMAL",
            dixonStatus: "Normal",
          });
        }
      }

      // Kalimat Rekomendasi / Komentar Saran Standar Kemenkes
      const comments: string[] = [];
      if (participantUnsatisfactoryCount > 0) {
        comments.push(
          `Ditemukan ${participantUnsatisfactoryCount} parameter dengan hasil Tidak Memuaskan (|Z| >= 3.0). Laboratorium wajib segera melakukan tindakan korektif (CAPA), evaluasi kalibrasi alat, dan investigasi mutu.`
        );
      }
      if (participantWarningCount > 0) {
        comments.push(
          "Pertahankan hasil pemeriksaan saudara yang Memuaskan dan tingkatkan hasil pemeriksaan yang Peringatan."
        );
      } else if (participantUnsatisfactoryCount === 0) {
        comments.push(
          "Seluruh hasil evaluasi mutu berada dalam rentang Memuaskan. Pertahankan konsistensi pengendalian mutu analitik laboratorium."
        );
      }
      if (participantNotAnalyzedInstrumentCount > 0) {
        comments.push(
          "Bagi Parameter dengan Kelompok Alat yang tidak dianalisa (peserta < 6), lakukan koordinasi dengan suplier alat terkait pengguna Alat di laboratorium lainnya."
        );
        comments.push("Disarankan untuk menggunakan alat yang banyak digunakan di laboratorium lain.");
      }

      participantReports.push({
        submissionId: sub.id,
        participant: sub.participant,
        cycle: sub.cycle,
        period: sub.period,
        submittedAt: sub.submittedAt,
        status: sub.status,
        isValidated: sub.isValidated,
        validatedAt: sub.validatedAt,
        validatedBy: sub.validatedBy,
        isPublished: sub.isPublished,
        publishedAt: sub.publishedAt,
        publishedBy: sub.publishedBy,
        category: packageCategory,
        rows,
        comments,
      });
    }

    // Rekapitulasi Statistik Tabel Deskriptif (Sheet 2 Dashboard View)
    const dashboardStats = masterParams.map((p) => {
      const pStat = paramStatsMap.get(p.name.toLowerCase().trim());
      return {
        parameterName: p.name,
        unit: p.unit,
        stats: pStat?.stats || null,
        dixon: pStat?.dixon || null,
      };
    });

    return jsonOk({
      cycle,
      availableCycles,
      category: packageCategory,
      totalSubmissions: reportSubmissions.length,
      isSuperAdmin,
      isParticipant: !isSuperAdmin,
      kopSurat,
      signer,
      summary: {
        totalParticipants: reportSubmissions.length,
        totalSatisfactory,
        totalWarning,
        totalUnsatisfactory,
        totalOutliers,
        passRate:
          totalSatisfactory + totalWarning + totalUnsatisfactory > 0
            ? Number(
                (
                  (totalSatisfactory /
                    (totalSatisfactory + totalWarning + totalUnsatisfactory)) *
                  100
                ).toFixed(1)
              )
            : 100,
      },
      dashboardStats,
      participantReports,
    });
  });
}

/**
 * POST /api/pme-mgmt/reports
 * Aksi Pengesahan & Pengiriman Laporan oleh Superadmin:
 * - action: "validate" -> Validasi laporan hasil evaluasi
 * - action: "publish" / "send" -> Kirim laporan resmi ke akun peserta PME
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Akses ditolak. Hanya Superadmin yang berhak memvalidasi atau mengirimkan laporan hasil PME.", 403, "FORBIDDEN");
    }

    const body = await req.json().catch(() => ({}));
    const { action, cycle, participantId } = body;

    if (!cycle || !cycle.trim()) {
      return jsonError("Siklus PME wajib ditentukan.", 400);
    }

    const whereClause: any = {
      cycle: cycle.trim(),
    };
    if (participantId && participantId !== "ALL") {
      whereClause.participantId = participantId;
    }

    const approverName = user.name || user.email || "Superadmin";

    if (action === "validate") {
      const updated = await db.pmeSubmission.updateMany({
        where: whereClause,
        data: {
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: approverName,
          status: "VALIDATED",
        },
      });

      return jsonOk({
        success: true,
        action: "validate",
        count: updated.count,
        message: `Laporan hasil PME ${cycle} (${updated.count} peserta) berhasil divalidasi dan dinyatakan selesai.`,
      });
    }

    if (action === "publish" || action === "send") {
      const updated = await db.pmeSubmission.updateMany({
        where: whereClause,
        data: {
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: approverName,
          isPublished: true,
          publishedAt: new Date(),
          publishedBy: approverName,
          status: "PUBLISHED",
        },
      });

      return jsonOk({
        success: true,
        action: "publish",
        count: updated.count,
        message: `Laporan hasil PME ${cycle} (${updated.count} laboratorium) berhasil dikirimkan ke akun peserta. Peserta kini dapat melihat dan mengunduh lembar evaluasi resmi di akun mereka.`,
      });
    }

    if (action === "unpublish" || action === "retract") {
      const updated = await db.pmeSubmission.updateMany({
        where: whereClause,
        data: {
          isPublished: false,
          publishedAt: null,
          publishedBy: null,
          isValidated: false,
          status: "SUBMITTED",
        },
      });

      return jsonOk({
        success: true,
        action: "retract",
        count: updated.count,
        message: `Laporan hasil PME ${cycle} (${updated.count} laboratorium) berhasil ditarik kembali. Tampilan laporan hasil pada akun peserta kini telah kembali kosong.`,
      });
    }

    return jsonError("Aksi tidak valid (gunakan 'validate', 'publish', atau 'retract').", 400);
  });
}
