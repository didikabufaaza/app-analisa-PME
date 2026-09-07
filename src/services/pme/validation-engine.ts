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

  // source validation
  const sourcePage = typeof raw.source?.page === "number" && Number.isFinite(raw.source.page) ? raw.source.page : null;
  const sourceText = raw.source?.text ? String(raw.source.text).slice(0, 1000) : null;
  const bbox = Array.isArray(raw.source?.bbox) && raw.source.bbox.length === 4 ? raw.source.bbox.map(Number) : null;
  if (!sourcePage) issues.push("MISSING_SOURCE");

  // cross-field validation: expected sign of z = sign(participant - target) when target > 0
  if (participantValue !== null && targetValue !== null && zScore !== null && targetValue > 0) {
    const diff = participantValue - targetValue;
    if (Math.abs(zScore) >= 0.5 && diff !== 0 && Math.sign(diff) !== Math.sign(zScore)) {
      issues.push("SIGN_CONFLICT");
    }
  }

  const critical: IssueCode[] = ["LOW_CONFIDENCE", "MISSING_Z_SCORE", "MISSING_VALUE", "INVALID_NUMBER", "SIGN_CONFLICT", "OCR_CONFLICT"];
  const validationStatus = issues.some((i) => critical.includes(i)) ? "REVIEW_REQUIRED" : "VALID";

  return {
    parameterName,
    participantValue,
    targetValue,
    sdpa: sdpa.value,
    zScore,
    unit: raw.unit ? String(raw.unit).slice(0, 100) : null,
    method: raw.method ? String(raw.method).slice(0, 200) : null,
    instrument: raw.instrument ? String(raw.instrument).slice(0, 200) : null,
    peerGroup: raw.peer_group ? String(raw.peer_group).slice(0, 200) : null,
    providerRemark:
      raw.provider_remark || raw.provider_category
        ? [raw.provider_category, raw.provider_remark].filter(Boolean).join(" | ").slice(0, 200) || null
        : null,
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
