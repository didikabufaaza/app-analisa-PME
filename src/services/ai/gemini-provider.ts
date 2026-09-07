/**
 * GeminiProvider — Google Gemini API implementation (PRD sections #4, #5, #7, #8).
 *
 * - Server-side only. API key is read from process.env.GEMINI_API_KEY (never hardcoded,
 *   never sent to the client, never stored in the database).
 * - Model is configurable via process.env.GEMINI_MODEL.
 * - Handles TEXT_PDF and SCANNED_PDF natively (Gemini is multimodal and performs OCR).
 */
import { GoogleGenAI } from "@google/genai";
import {
  type AIProvider,
  type AIResultWithUsage,
  type DocumentInput,
  type PMEAnalysis,
  type PMEAnalysisInput,
  type PMEExtraction,
  AIError,
  AI_ERROR_CODES,
} from "./ai-provider";
import { ANALYSIS_SYSTEM_PROMPT, EXTRACTION_SCHEMA_JSON, EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import { parseAiJson } from "./json-utils";

const PROVIDER_NAME = "gemini";

const FAST_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
];

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIError(AI_ERROR_CODES.GEMINI_AUTH_ERROR, "GEMINI_API_KEY is not configured on the server");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Map SDK/HTTP errors to stable error codes (PRD section #45). */
function classifyError(err: unknown): AIError {
  const raw = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === "object" && err !== null
      ? ((err as { status?: number }).status ?? undefined)
      : undefined;
  const lower = raw.toLowerCase();

  if (lower.includes("user location is not supported") || lower.includes("failed_precondition")) {
    return new AIError(AI_ERROR_CODES.GEMINI_LOCATION_UNSUPPORTED, raw);
  }
  if (status === 429 || lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("rate limit")) {
    return new AIError(AI_ERROR_CODES.GEMINI_QUOTA_EXCEEDED, raw);
  }
  if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("unauthenticated") || lower.includes("permission denied")) {
    return new AIError(AI_ERROR_CODES.GEMINI_AUTH_ERROR, raw);
  }
  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("aborted") || lower.includes("econnaborted")) {
    return new AIError(AI_ERROR_CODES.GEMINI_TIMEOUT, raw);
  }
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("econnrefused") || lower.includes("enotfound")) {
    return new AIError(AI_ERROR_CODES.GEMINI_API_ERROR, `Gemini endpoint unreachable: ${raw}`);
  }
  return new AIError(AI_ERROR_CODES.GEMINI_API_ERROR, raw);
}

/** Limited retry with intelligent fast-model fallback for transient 503/404 errors. */
async function withRetry<T>(fn: (modelName: string) => Promise<T>, maxRetries = 2): Promise<{ result: T; usedModel: string }> {
  const primary = getModel();
  const modelsToTry = [primary, ...FAST_MODELS.filter((m) => m !== primary)];
  let lastError: unknown;

  for (const modelName of modelsToTry.slice(0, maxRetries + 1)) {
    try {
      const res = await fn(modelName);
      return { result: res, usedModel: modelName };
    } catch (err) {
      lastError = err;
      const raw = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] Model ${modelName} returned error (${raw.slice(0, 80)}). Mencoba model alternatif jika ada...`);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const aiErr = lastError instanceof AIError ? lastError : classifyError(lastError);
  throw aiErr;
}

function parseUsage(
  response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } },
  startedAt: number,
  actualModel?: string
) {
  const u = response.usageMetadata || {};
  const inputTokens = u.promptTokenCount ?? 0;
  const outputTokens = u.candidatesTokenCount ?? 0;
  return {
    provider: PROVIDER_NAME,
    model: actualModel || getModel(),
    inputTokens,
    outputTokens,
    totalTokens: u.totalTokenCount ?? inputTokens + outputTokens,
    processingTimeMs: Date.now() - startedAt,
  };
}

/** Extract and strictly parse JSON from the model response (with repair + salvage). */
function parseJsonResponse<T>(text: string | undefined): T {
  if (!text || text.trim().length === 0) {
    throw new AIError(AI_ERROR_CODES.GEMINI_INVALID_RESPONSE, "Gemini returned an empty response");
  }
  try {
    return parseAiJson<T>(text);
  } catch (err) {
    throw new AIError(
      AI_ERROR_CODES.GEMINI_INVALID_RESPONSE,
      err instanceof Error ? err.message : "Gemini response was not valid JSON"
    );
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = PROVIDER_NAME;

  async extractPMEData(input: DocumentInput): Promise<AIResultWithUsage<PMEExtraction>> {
    const startedAt = Date.now();
    const ai = getClient();

    // Optimasi bandwidth & latensi:
    // Jika dokumen memiliki layer teks lengkap (TEXT_PDF), kirimkan teks terstruktur langsung
    // tanpa perlu mentransfer megabytes base64 PDF di jaringan.
    const hasMeaningfulText = input.pdfClass === "TEXT_PDF" && input.pages.some((p) => p.text.trim().length > 100);

    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];

    if (!hasMeaningfulText && input.pdfBase64) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: input.pdfBase64 } });
      parts.push({
        text: `Extract structured PME data from this document ("${input.fileName}").\nReturn JSON exactly following this schema:\n${EXTRACTION_SCHEMA_JSON}`,
      });
    } else {
      const docText = input.pages
        .slice(0, 40)
        .map((p) => `--- HALAMAN ${p.page_number} ---\n${p.text}`)
        .join("\n\n");
      parts.push({
        text: `Extract structured PME data from document ("${input.fileName}") with text:\n\n${docText}\n\nReturn JSON exactly following this schema:\n${EXTRACTION_SCHEMA_JSON}`,
      });
    }

    const { result: response, usedModel } = await withRetry((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: EXTRACTION_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      })
    );

    const data = parseJsonResponse<PMEExtraction>(response.text);
    return { data, usage: parseUsage(response, startedAt, usedModel) };
  }

  async analyzePMEResult(input: PMEAnalysisInput): Promise<AIResultWithUsage<PMEAnalysis>> {
    const startedAt = Date.now();
    const ai = getClient();

    const { result: response, usedModel } = await withRetry((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this VALIDATED PME result:\n${JSON.stringify(input, null, 2)}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: ANALYSIS_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      })
    );

    const data = parseJsonResponse<PMEAnalysis>(response.text);
    return { data, usage: parseUsage(response, startedAt, usedModel) };
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const ai = getClient();
      await ai.models.generateContent({
        model: getModel(),
        contents: [{ role: "user", parts: [{ text: "Reply with the single word OK" }] }],
        config: { maxOutputTokens: 10 },
      });
      return { ok: true };
    } catch (err) {
      const aiErr = err instanceof AIError ? err : classifyError(err);
      return { ok: false, error: `${aiErr.code}: ${aiErr.message}` };
    }
  }
}

export const geminiProvider = new GeminiProvider();
