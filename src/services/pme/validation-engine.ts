/**
 * Validation Engine + Confidence Engine (PRD sections #22, #23)
 *
 * The backend performs numeric validation, sign validation, missing value
 * validation, source validation and cross-field validation.
 * AI output is treated as *candidate data only* — never as the source of truth.
 */

export type IssueCode =
  | "LOW_CONFIDENCE"
  | "MISSING_Z_SCORE"
  | "MISSING_VALUE"
  | "INVALID_NUMBER"
  | "SIGN_CONFLICT"
  | "OCR_CONFLICT"
  | "MISSING_SOURCE"
  | "UNVERIFIED_SOURCE"
  | "DUPLICATE_PARAMETER";

export const ISSUE_LABELS: Record<IssueCode, string> = {
  LOW_CONFIDENCE: "Keyakinan AI rendah (confidence < 0.85)",
  MISSING_Z_SCORE: "Z-score tidak ditemukan pada dokumen",
  MISSING_VALUE: "Nilai peserta/target tidak lengkap",
  INVALID_NUMBER: "Format angka tidak dapat divalidasi",
  SIGN_CONFLICT: "Kemungkinan kesalahan numerik: tanda Z-score berlawanan dengan selisih nilai",
  OCR_CONFLICT: "Potensi kekeliruan OCR (ambiguitas karakter angka)",
  MISSING_SOURCE: "Sumber halaman tidak terlacak",
  UNVERIFIED_SOURCE: "Teks sumber tidak dapat dilacak di dokumen (potensi halusinasi AI)",
  DUPLICATE_PARAMETER: "Parameter duplikat pada dokumen",
};

/** Critical fields per PRD section #22. */
const CRITICAL_THRESHOLD = 0.85;

export interface RawExtractionGroup {
  name?: string | null;
  count?: number | string | null;
  target?: number | string | null;
  sdpa?: number | string | null;
  z_score?: number | string | null;
  status?: string | null;
}

export interface RawExtractionResult {
  parameter: string | null;
  participant_value: number | string | null;
  target_value: number | string | null;
  sdpa?: number | string | null;
  z_score: number | string | null;
  unit?: string | null;
  method?: string | null;
  instrument?: string | null;
  peer_group?: string | null;
  provider_category?: string | null;
  provider_remark?: string | null;
  all_participants_group?: RawExtractionGroup | null;
  method_group?: RawExtractionGroup | null;
  instrument_group?: RawExtractionGroup | null;
  confidence?: {
    parameter?: number;
    participant_value?: number;
    target_value?: number;
    z_score?: number;
  };
  source?: {
    page?: number | null;
    text?: string | null;
    bbox?: number[] | null;
  };
}

export interface ValidatedResult {
  parameterName: string;
  participantValue: number | null;
  targetValue: number | null;
  sdpa: number | null;
  zScore: number | null;
  unit: string | null;
  method: string | null;
  instrument: string | null;
  peerGroup: string | null;
  providerRemark: string | null;
  allParticipantsCount: number | null;
  allParticipantsTarget: number | null;
  allParticipantsSdpa: number | null;
  allParticipantsZScore: number | null;
  allParticipantsStatus: string | null;
  methodCount: number | null;
  methodTarget: number | null;
  methodSdpa: number | null;
  methodZScore: number | null;
  methodStatus: string | null;
  instrumentCount: number | null;
  instrumentTarget: number | null;
  instrumentSdpa: number | null;
  instrumentZScore: number | null;
  instrumentStatus: string | null;
  parameterConfidence: number;
  participantConfidence: number;
  targetConfidence: number;
  zScoreConfidence: number;
  sourcePage: number | null;
  sourceText: string | null;
  sourceBbox: string | null;
  issues: IssueCode[];
  validationStatus: "VALID" | "REVIEW_REQUIRED";
}

/** Parse loosely-typed AI/OCR numbers into strict numbers. Preserves sign (PRD #23). */
export function toNumberStrict(value: number | string | null | undefined): { value: number | null; invalid: boolean } {
  if (value === null || value === undefined || value === "") return { value: null, invalid: false };
  if (typeof value === "number") return { value: Number.isFinite(value) ? value : null, invalid: !Number.isFinite(value) };
  let s = String(value).trim();
  if (!s) return { value: null, invalid: false };
  s = s.replace(/\s+/g, "").replace(/,(?=\d{1,2}\b)/, ".");
  // keep leading + or -, digits, dot
  const match = s.match(/^([+-]?)(\d+(?:\.\d+)?)$/);
  if (!match) return { value: null, invalid: true };
  const num = Number.parseFloat(`${match[1]}${match[2]}`);
  if (!Number.isFinite(num)) return { value: null, invalid: true };
  return { value: num, invalid: false };
}

function clamp01(n: unknown): number {
  const num = typeof n === "number" ? n : Number.parseFloat(String(n ?? 0));
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

export function confidenceLevel(conf: number): "HIGH" | "MEDIUM" | "LOW" {
  if (conf >= 0.95) return "HIGH";
  if (conf >= 0.85) return "MEDIUM";
  return "LOW";
}

/**
 * Validate a single raw extraction result.
 * Deterministic checks only — no guessing (PRD #15, #20, #22, #23).
 */
export function validateResult(raw: RawExtractionResult): ValidatedResult {
  const issues: IssueCode[] = [];

  // parameter
  const parameterName = (raw.parameter || "").toString().trim() || "Unknown Parameter";
  if (!raw.parameter || !parameterName) issues.push("MISSING_VALUE");

  // numeric fields (sign preserved)
  const participant = toNumberStrict(raw.participant_value);
  const target = toNumberStrict(raw.target_value);
  const z = toNumberStrict(raw.z_score);
  const sdpa = toNumberStrict(raw.sdpa ?? null);
  if (participant.invalid) issues.push("INVALID_NUMBER");
  if (target.invalid) issues.push("INVALID_NUMBER");
  if (z.invalid) issues.push("INVALID_NUMBER");
  if (sdpa.invalid) issues.push("INVALID_NUMBER");

  const participantValue = participant.value;
  const targetValue = target.value;
  const zScore = z.value;

  if (participantValue === null || targetValue === null) issues.push("MISSING_VALUE");
  if (zScore === null) issues.push("MISSING_Z_SCORE");

  // confidence engine
  const parameterConfidence = clamp01(raw.confidence?.parameter);
  const participantConfidence = clamp01(raw.confidence?.participant_value);
  const targetConfidence = clamp01(raw.confidence?.target_value);
  const zScoreConfidence = clamp01(raw.confidence?.z_score);

  if (
    parameterConfidence < CRITICAL_THRESHOLD ||
    participantConfidence < CRITICAL_THRESHOLD ||
    targetConfidence < CRITICAL_THRESHOLD ||
    zScoreConfidence < CRITICAL_THRESHOLD
  ) {
    issues.push("LOW_CONFIDENCE");
  }

  // OCR ambiguity heuristics on raw string (O<->0, I<->1, S<->5 confusion next to numbers)
  const rawZ = raw.z_score !== null && raw.z_score !== undefined ? String(raw.z_score) : "";
  if (/[OIS]/i.test(rawZ.replace(/[^a-zA-Z]/g, "")) && /[-+]?\d/.test(rawZ)) {
    issues.push("OCR_CONFLICT");
  }

  // Multi-group resolution (All participants, Method group, Instrument group)
  const textParsed = parsePmeMultiGroupText(sourceText);

  // All Participants Group
  const allParticipantsCount =
    toNumberStrict(raw.all_participants_group?.count).value ?? textParsed?.allParticipants?.count ?? null;
  const allParticipantsTarget =
    toNumberStrict(raw.all_participants_group?.target).value ?? textParsed?.allParticipants?.target ?? null;
  const allParticipantsSdpa = toNumberStrict(raw.all_participants_group?.sdpa).value ?? null;
  const allParticipantsZScore =
    toNumberStrict(raw.all_participants_group?.z_score).value ?? textParsed?.allParticipants?.zScore ?? null;
  const allParticipantsStatus =
    raw.all_participants_group?.status?.trim() || textParsed?.allParticipants?.status || null;

  // Method Group
  const methodCount =
    toNumberStrict(raw.method_group?.count).value ?? textParsed?.methodGroup?.count ?? null;
  const methodTarget =
    toNumberStrict(raw.method_group?.target).value ?? textParsed?.methodGroup?.target ?? null;
  const methodSdpa = toNumberStrict(raw.method_group?.sdpa).value ?? null;
  const methodZScore =
    toNumberStrict(raw.method_group?.z_score).value ?? textParsed?.methodGroup?.zScore ?? null;
  const methodStatus =
    raw.method_group?.status?.trim() || textParsed?.methodGroup?.status || null;

  // Instrument Group
  const instrumentCount =
    toNumberStrict(raw.instrument_group?.count).value ?? textParsed?.instrumentGroup?.count ?? null;
  const instrumentTarget =
    toNumberStrict(raw.instrument_group?.target).value ?? textParsed?.instrumentGroup?.target ?? null;
  const instrumentSdpa = toNumberStrict(raw.instrument_group?.sdpa).value ?? null;
  const instrumentZScore =
    toNumberStrict(raw.instrument_group?.z_score).value ?? textParsed?.instrumentGroup?.zScore ?? null;
  const instrumentStatus =
    raw.instrument_group?.status?.trim() || textParsed?.instrumentGroup?.status || null;

  // Resolve method & instrument names/codes
  const method = raw.method ? String(raw.method).slice(0, 200) : textParsed?.methodCode || null;
  const instrument = raw.instrument ? String(raw.instrument).slice(0, 200) : textParsed?.instrumentCode || null;

  // Fallback for primary target & z-score if top-level was null
  const finalTargetValue = targetValue ?? instrumentTarget ?? allParticipantsTarget;
  const finalZScore = zScore ?? instrumentZScore ?? allParticipantsZScore;

  // Re-check missing issues with multi-group fallbacks
  if (finalTargetValue !== null && issues.includes("MISSING_VALUE") && participantValue !== null) {
    const idx = issues.indexOf("MISSING_VALUE");
    if (idx >= 0) issues.splice(idx, 1);
  }
  if (finalZScore !== null && issues.includes("MISSING_Z_SCORE")) {
    const idx = issues.indexOf("MISSING_Z_SCORE");
    if (idx >= 0) issues.splice(idx, 1);
  }

  // source validation
  const sourcePage = typeof raw.source?.page === "number" && Number.isFinite(raw.source.page) ? raw.source.page : null;
  const bbox = Array.isArray(raw.source?.bbox) && raw.source.bbox.length === 4 ? raw.source.bbox.map(Number) : null;
  if (!sourcePage) issues.push("MISSING_SOURCE");

  // cross-field validation: expected sign of z = sign(participant - target) when target > 0
  if (participantValue !== null && finalTargetValue !== null && finalZScore !== null && finalTargetValue > 0) {
    const diff = participantValue - finalTargetValue;
    if (Math.abs(finalZScore) >= 0.5 && diff !== 0 && Math.sign(diff) !== Math.sign(finalZScore)) {
      issues.push("SIGN_CONFLICT");
    }
  }

  const critical: IssueCode[] = ["LOW_CONFIDENCE", "MISSING_Z_SCORE", "MISSING_VALUE", "INVALID_NUMBER", "SIGN_CONFLICT", "OCR_CONFLICT"];
  const validationStatus = issues.some((i) => critical.includes(i)) ? "REVIEW_REQUIRED" : "VALID";

  return {
    parameterName,
    participantValue,
    targetValue: finalTargetValue,
    sdpa: sdpa.value ?? instrumentSdpa ?? allParticipantsSdpa,
    zScore: finalZScore,
    unit: raw.unit ? String(raw.unit).slice(0, 100) : null,
    method,
    instrument,
    peerGroup: raw.peer_group ? String(raw.peer_group).slice(0, 200) : instrument ? "Kelompok Alat" : "Seluruh Peserta",
    providerRemark:
      raw.provider_remark || raw.provider_category
        ? [raw.provider_category, raw.provider_remark].filter(Boolean).join(" | ").slice(0, 200) || null
        : instrumentStatus || allParticipantsStatus || null,
    allParticipantsCount,
    allParticipantsTarget,
    allParticipantsSdpa,
    allParticipantsZScore,
    allParticipantsStatus,
    methodCount,
    methodTarget,
    methodSdpa,
    methodZScore,
    methodStatus,
    instrumentCount,
    instrumentTarget,
    instrumentSdpa,
    instrumentZScore,
    instrumentStatus,
    parameterConfidence,
    participantConfidence,
    targetConfidence,
    zScoreConfidence,
    sourcePage,
    sourceText,
    sourceBbox: bbox ? JSON.stringify(bbox) : null,
    issues,
    validationStatus,
  };
}

/** Robust regex parser for Indonesian PME multi-group text lines (BBLK / PNPME). */
export function parsePmeMultiGroupText(text: string | null | undefined): {
  methodCode?: string;
  instrumentCode?: string;
  allParticipants?: { count?: number; target?: number; zScore?: number; status?: string };
  methodGroup?: { count?: number; target?: number; zScore?: number; status?: string };
  instrumentGroup?: { count?: number; target?: number; zScore?: number; status?: string };
} | null {
  if (!text) return null;
  const clean = text.trim().replace(/\s+/g, " ");

  // Pattern: parameter ... <methodCode> <instrumentCode> <participantVal> <N1> <Target1> <Z1> <Status1> <N2> <Target2> <Z2> <Status2> <N3> <Target3> <Z3> <Status3>
  // Example: "5 MCV 53 305206 105.7 290 96.86 1.92 OK Memuaskan 176 96.40 2.31 $ Peringatan 13 104.93 0.73 OK Memuaskan"
  const m = clean.match(
    /\b(\d{1,5})\s+(\d{3,8})\s+([0-9\.\,]+)\s+(\d+)\s+([0-9\.\,]+)\s+([+-]?[0-9\.\,]+)\s+([A-Za-z\$\*\@\s]+?)\s+(\d+)\s+([0-9\.\,]+)\s+([+-]?[0-9\.\,]+)\s+([A-Za-z\$\*\@\s]+?)\s+(\d+)\s+([0-9\.\,]+)\s+([+-]?[0-9\.\,]+)(?:\s+([A-Za-z\$\*\@\s]+))?$/
  );

  if (!m) return null;

  const toN = (v: string) => {
    const parsed = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const toInt = (v: string) => {
    const parsed = Number.parseInt(v, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    methodCode: m[1],
    instrumentCode: m[2],
    allParticipants: {
      count: toInt(m[4]),
      target: toN(m[5]),
      zScore: toN(m[6]),
      status: m[7]?.trim(),
    },
    methodGroup: {
      count: toInt(m[8]),
      target: toN(m[9]),
      zScore: toN(m[10]),
      status: m[11]?.trim(),
    },
    instrumentGroup: {
      count: toInt(m[12]),
      target: toN(m[13]),
      zScore: toN(m[14]),
      status: m[15]?.trim(),
    },
  };
}

/** Re-run deterministic checks on a stored (possibly user-edited) result. */
export function revalidateStoredResult(input: {
  parameterName: string;
  participantValue: number | null;
  targetValue: number | null;
  zScore: number | null;
  parameterConfidence: number;
  participantConfidence: number;
  targetConfidence: number;
  zScoreConfidence: number;
  sourcePage: number | null;
}): IssueCode[] {
  const issues: IssueCode[] = [];
  if (!input.parameterName?.trim()) issues.push("MISSING_VALUE");
  if (input.participantValue === null || input.targetValue === null) issues.push("MISSING_VALUE");
  if (input.zScore === null) issues.push("MISSING_Z_SCORE");
  if (
    input.parameterConfidence < CRITICAL_THRESHOLD ||
    input.participantConfidence < CRITICAL_THRESHOLD ||
    input.targetConfidence < CRITICAL_THRESHOLD ||
    input.zScoreConfidence < CRITICAL_THRESHOLD
  ) {
    issues.push("LOW_CONFIDENCE");
  }
  if (!input.sourcePage) issues.push("MISSING_SOURCE");
  if (input.participantValue !== null && input.targetValue !== null && input.zScore !== null && input.targetValue > 0) {
    const diff = input.participantValue - input.targetValue;
    if (Math.abs(input.zScore) >= 0.5 && diff !== 0 && Math.sign(diff) !== Math.sign(input.zScore)) {
      issues.push("SIGN_CONFLICT");
    }
  }
  return issues;
}

export function parseIssues(issues: string | null): IssueCode[] {
  if (!issues) return [];
  try {
    const arr = JSON.parse(issues);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* ------------------------- anti-hallucination trace ------------------------- */

function normalizeForTrace(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Deterministic anti-hallucination check: the AI-quoted source text must be
 * findable (normalized containment, punctuation/whitespace/case-insensitive)
 * in the text of the claimed page — or any page as a fallback.
 * Returns true when the quote is traceable (or nothing was quoted).
 */
export function isSourceTraceable(
  sourceText: string | null | undefined,
  pageTexts: string[],
  sourcePage: number | null | undefined
): boolean {
  if (!sourceText || !sourceText.trim()) return true; // nothing claimed -> nothing to verify
  const needle = normalizeForTrace(sourceText).slice(0, 200);
  if (needle.length < 8) return true; // too short to judge reliably
  const candidates: string[] = [];
  if (sourcePage && pageTexts[sourcePage - 1]) candidates.push(pageTexts[sourcePage - 1]);
  candidates.push(...pageTexts);
  return candidates.some((t) => normalizeForTrace(t).includes(needle));
}
