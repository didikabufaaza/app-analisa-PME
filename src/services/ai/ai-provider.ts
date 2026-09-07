/**
 * AI Provider Abstraction (PRD section #6)
 *
 * The application talks to AI through this interface only.
 * Primary provider: GeminiProvider (Google Gemini API - PRD section #4/#5).
 * A fallback provider may be registered for environments where the
 * Gemini endpoint is unreachable (e.g. geo-restricted networks).
 */

export type PdfClass = "TEXT_PDF" | "SCANNED_PDF" | "MIXED_PDF";

export interface NormalizedPage {
  page_number: number;
  text: string;
  image_base64?: string; // rendered page image (used for scanned PDFs by vision-capable providers)
}

export interface DocumentInput {
  fileName: string;
  pdfBase64: string;
  pdfClass: PdfClass;
  pages: NormalizedPage[];
}

export interface PMEExtractionMeta {
  provider: string | null;
  program: string | null;
  cycle: string | null;
  period: string | null;
  participant_id: string | null;
  laboratory_name: string | null;
}

export interface PMEResultExtraction {
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
  confidence: {
    parameter: number;
    participant_value: number;
    target_value: number;
    z_score: number;
  };
  source: {
    page: number | null;
    text: string | null;
    bbox: number[] | null;
  };
}

export interface PMEExtraction {
  pme: PMEExtractionMeta;
  results: PMEResultExtraction[];
}

export interface AIUsageMeta {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  processingTimeMs: number;
}

export interface AIResultWithUsage<T> {
  data: T;
  usage: AIUsageMeta;
}

export interface PMEHistoryEntry {
  cycle: string | null;
  period: string | null;
  z_score: number | null;
  status: string | null;
}

export interface PMEAnalysisInput {
  parameter: string;
  participant_value: number | null;
  target_value: number | null;
  z_score: number | null;
  status: string;
  unit?: string | null;
  method?: string | null;
  instrument?: string | null;
  history?: PMEHistoryEntry[];
}

export interface PMEAnalysis {
  interpretation: string;
  possible_causes: { category: "PRE_ANALYTICAL" | "ANALYTICAL" | "POST_ANALYTICAL"; text: string }[];
  investigation_steps: string[];
  corrective_actions: string[];
  preventive_actions: string[];
}

export interface AIProvider {
  readonly name: string;
  extractPMEData(input: DocumentInput): Promise<AIResultWithUsage<PMEExtraction>>;
  analyzePMEResult(input: PMEAnalysisInput): Promise<AIResultWithUsage<PMEAnalysis>>;
  healthCheck(): Promise<{ ok: boolean; error?: string }>;
}

/** Standard AI error carrying a stable error code (PRD section #45). */
export class AIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const AI_ERROR_CODES = {
  GEMINI_API_ERROR: "GEMINI_API_ERROR",
  GEMINI_QUOTA_EXCEEDED: "GEMINI_QUOTA_EXCEEDED",
  GEMINI_AUTH_ERROR: "GEMINI_AUTH_ERROR",
  GEMINI_TIMEOUT: "GEMINI_TIMEOUT",
  GEMINI_INVALID_RESPONSE: "GEMINI_INVALID_RESPONSE",
  GEMINI_LOCATION_UNSUPPORTED: "GEMINI_LOCATION_UNSUPPORTED",
  AI_USAGE_LIMIT_REACHED: "AI_USAGE_LIMIT_REACHED",
  INTERNAL_AI_ERROR: "INTERNAL_AI_ERROR",
} as const;
