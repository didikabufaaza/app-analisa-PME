/**
 * FallbackProvider — internal AI implementation using z-ai-web-dev-sdk.
 *
 * Used automatically when the Gemini endpoint is unreachable from the host
 * network (e.g. geo-restriction) so the application remains fully functional.
 * Text PDFs are extracted from the text layer; scanned pages are rendered to
 * images and read by the vision model.
 */
import ZAI from "z-ai-web-dev-sdk";
import {
  type AIProvider,
  type AIResultWithUsage,
  type AIUsageMeta,
  type DocumentInput,
  type NormalizedPage,
  type PMEAnalysis,
  type PMEAnalysisInput,
  type PMEExtraction,
  type PMEExtractionMeta,
  type PMEResultExtraction,
  AIError,
  AI_ERROR_CODES,
} from "./ai-provider";
import { ANALYSIS_SYSTEM_PROMPT, EXTRACTION_SCHEMA_JSON, EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import { parseAiJson } from "./json-utils";

const PROVIDER_NAME = "internal-ai";
const MODEL_NAME = "glm-4-plus";
const MAX_VISION_PAGES = 8;
/** Pages per extraction call — keeps AI output far below token limits for dense multi-page tables. */
const PAGE_CHUNK_SIZE = 2;

async function getClient() {
  try {
    return await ZAI.create();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AIError(AI_ERROR_CODES.INTERNAL_AI_ERROR, `AI SDK initialization failed: ${msg}`);
  }
}

function extractUsage(completion: unknown, startedAt: number) {
  const usage = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } })?.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  return {
    provider: PROVIDER_NAME,
    model: MODEL_NAME,
    inputTokens,
    outputTokens,
    totalTokens: usage?.total_tokens ?? inputTokens + outputTokens,
    processingTimeMs: Date.now() - startedAt,
  };
}

function getContent(completion: { choices?: { message?: { content?: string | Array<{ text?: string }> } }[] }): string {
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => c.text ?? "").join("");
  return "";
}

function parseJsonResponse<T>(text: string): T {
  // Robust parsing with repair + salvage (handles fences, truncation, minor syntax issues)
  return parseAiJson<T>(text);
}

export class FallbackProvider implements AIProvider {
  readonly name = PROVIDER_NAME;

  async extractPMEData(input: DocumentInput): Promise<AIResultWithUsage<PMEExtraction>> {
    const startedAt = Date.now();
    const zai = await getClient();

    const hasText = input.pages.some((p) => p.text && p.text.trim().length > 30);

    /* ---------- text PDFs: chunked extraction (2 pages per call) ---------- */
    if (hasText) {
      const chunks: NormalizedPage[][] = [];
      for (let i = 0; i < input.pages.length; i += PAGE_CHUNK_SIZE) {
        chunks.push(input.pages.slice(i, i + PAGE_CHUNK_SIZE));
      }

      const mergedMeta: PMEExtractionMeta = {
        provider: null,
        program: null,
        cycle: null,
        period: null,
        participant_id: null,
        laboratory_name: null,
      };
      const mergedResults: PMEResultExtraction[] = [];
      const totalUsage: AIUsageMeta = {
        provider: PROVIDER_NAME,
        model: MODEL_NAME,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        processingTimeMs: 0,
      };

      for (let c = 0; c < chunks.length; c++) {
        // Anti-hallucination guard: pages without a real text layer (covers,
        // watermark-only pages) must NOT be sent to the model — it would be
        // forced to answer and may fabricate plausible-looking rows.
        const chunkTextLength = chunks[c].reduce((sum, p) => sum + (p.text || "").replace(/\s+/g, "").length, 0);
        if (chunkTextLength < 200) {
          console.warn(`[fallback-extract] skipping chunk ${c + 1}/${chunks.length}: no meaningful text (${chunkTextLength} chars)`);
          continue;
        }
        const partInfo =
          chunks.length > 1 ? ` (part ${c + 1} of ${chunks.length} — extract EVERY data row on these pages)` : "";
        const docText = chunks[c]
          .map((p) => `--- PAGE ${p.page_number} ---\n${p.text.slice(0, 12000)}`)
          .join("\n");
        const baseContent = `Document: "${input.fileName}" (${input.pdfClass})${partInfo}.

The text below was extracted from a PDF, so table rows may appear as a flat sequence of values and tables may continue across pages (a repeated header means continuation). Reconstruct each data row carefully: identify the parameter name, the participant result, then the peer-group statistics (n, target, sdpa, z-score, category, remark). A single printed cell often contains a stacked fraction: the TOP number is the target, the BOTTOM number is the SDPA. Skip rows that contain no numeric data at all. Extract EVERY data row visible on the given pages — do not stop early or summarize.

Document text per page:\n${docText}\n\nExtract structured PME data. Return ONLY JSON following this schema:\n${EXTRACTION_SCHEMA_JSON}`;

        let extraction: PMEExtraction | null = null;
        let usage: AIUsageMeta | null = null;
        // up to 2 attempts: second attempt with a stricter JSON instruction
        for (let attempt = 0; attempt < 2 && !extraction; attempt++) {
          const content =
            attempt === 0
              ? baseContent
              : `${baseContent}\n\nIMPORTANT: Your previous response was not parseable. Return ONLY one valid compact JSON object, nothing else.`;
          const completion = await zai.chat.completions.create({
            messages: [
              { role: "assistant", content: EXTRACTION_SYSTEM_PROMPT },
              { role: "user", content },
            ],
            thinking: { type: "disabled" },
          });
          const text = getContent(completion);
          if (!text) continue;
          const u = extractUsage(completion, startedAt);
          totalUsage.inputTokens += u.inputTokens;
          totalUsage.outputTokens += u.outputTokens;
          totalUsage.totalTokens += u.totalTokens;
          usage = u;
          try {
            extraction = parseAiJson<PMEExtraction>(text);
          } catch (err) {
            console.warn(
              `[fallback-extract] chunk ${c + 1}/${chunks.length} attempt ${attempt + 1} unparseable:`,
              err instanceof Error ? err.message : err
            );
          }
        }
        if (!extraction) {
          throw new AIError(
            AI_ERROR_CODES.GEMINI_INVALID_RESPONSE,
            `AI returned an unparseable response for pages chunk ${c + 1}/${chunks.length}`
          );
        }

        // merge meta: first non-null value wins
        const meta = (extraction.pme || {}) as Partial<Record<keyof PMEExtractionMeta, unknown>>;
        const metaTarget = mergedMeta as unknown as Record<string, unknown>;
        for (const key of Object.keys(mergedMeta) as (keyof PMEExtractionMeta)[]) {
          if (metaTarget[key] === null && meta[key] != null) {
            metaTarget[key] = meta[key];
          }
        }
        mergedResults.push(...(Array.isArray(extraction.results) ? extraction.results : []));
      }

      totalUsage.processingTimeMs = Date.now() - startedAt;
      return { data: { pme: mergedMeta, results: mergedResults }, usage: totalUsage };
    }

    /* ---------- scanned PDFs: single vision call over rendered page images ---------- */
    const imagePages = input.pages.filter((p) => p.image_base64).slice(0, MAX_VISION_PAGES);
    if (imagePages.length === 0) {
      throw new AIError(
        AI_ERROR_CODES.GEMINI_INVALID_RESPONSE,
        "Scanned PDF could not be rendered for OCR (no page images available)"
      );
    }
    const visionContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Document: "${input.fileName}" (scanned, ${input.pages.length} pages). Read ALL visible table content via OCR. Rows may span multiple peer groups (Seluruh Peserta / Kelompok Metode / Kelompok Alat); a stacked cell's TOP number is the target and the BOTTOM number is the SDPA. Skip rows with no numeric data. Extract EVERY data row. Return ONLY JSON following this schema:\n${EXTRACTION_SCHEMA_JSON}`,
      },
      ...imagePages.map((p) => ({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${p.image_base64}` },
      })),
    ];
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: visionContent as never },
      ],
      thinking: { type: "disabled" },
    });

    const text = getContent(completion);
    if (!text) throw new AIError(AI_ERROR_CODES.GEMINI_INVALID_RESPONSE, "AI returned an empty response");
    const data = parseJsonResponse<PMEExtraction>(text);
    return { data, usage: extractUsage(completion, startedAt) };
  }

  async analyzePMEResult(input: PMEAnalysisInput): Promise<AIResultWithUsage<PMEAnalysis>> {
    const startedAt = Date.now();
    const zai = await getClient();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this VALIDATED PME result (status already determined by the backend rule engine, do not change it):\n${JSON.stringify(
            input,
            null,
            2
          )}`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const text = getContent(completion);
    if (!text) throw new AIError(AI_ERROR_CODES.GEMINI_INVALID_RESPONSE, "AI returned an empty response");
    const data = parseJsonResponse<PMEAnalysis>(text);
    return { data, usage: extractUsage(completion, startedAt) };
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const zai = await getClient();
      const completion = await zai.chat.completions.create({
        messages: [{ role: "user", content: "Reply with the single word OK" }],
        thinking: { type: "disabled" },
      });
      return { ok: getContent(completion).trim().length > 0 };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const fallbackProvider = new FallbackProvider();
