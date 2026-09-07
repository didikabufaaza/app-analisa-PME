/**
 * AI Service layer — provider selection, usage logging and quota control.
 *
 * Selection strategy (AI_PROVIDER_MODE):
 *  - "gemini":   force Gemini (fails hard if unreachable) — recommended in production
 *  - "fallback": force internal AI provider
 *  - "auto":     try Gemini first; on provider-level failure automatically fall back
 *                so the application keeps working in restricted networks.
 *
 * Every call (success or failure) is recorded in ai_usage_logs for monitoring,
 * quota and cost calculation (PRD sections #10, #11, #12).
 */
import { db } from "@/lib/db";
import {
  type AIProvider,
  type AIUsageMeta,
  type DocumentInput,
  type PMEAnalysis,
  type PMEAnalysisInput,
  type PMEExtraction,
  AIError,
  AI_ERROR_CODES,
} from "./ai-provider";
import { geminiProvider } from "./gemini-provider";
import { fallbackProvider } from "./fallback-provider";

export type AiOperation = "PDF_EXTRACTION" | "PME_ANALYSIS" | "REPORT_ANALYSIS";

function getMode(): "gemini" | "fallback" | "auto" {
  const mode = (process.env.AI_PROVIDER_MODE || "auto").toLowerCase();
  if (mode === "gemini" || mode === "fallback") return mode;
  return "auto";
}

export interface UsageContext {
  organizationId: string;
  userId?: string | null;
  pmeSessionId?: string | null;
  operation: AiOperation;
}

async function logUsage(ctx: UsageContext, usage: AIUsageMeta | null, status: "SUCCESS" | "FAILED", errorMessage?: string) {
  try {
    await db.aiUsageLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId ?? null,
        pmeSessionId: ctx.pmeSessionId ?? null,
        provider: usage?.provider || "gemini",
        model: usage?.model || "unknown",
        operation: ctx.operation,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
        processingTimeMs: usage?.processingTimeMs ?? 0,
        status,
        errorMessage: errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch (e) {
    console.error("[ai-usage-log-failed]", e);
  }
}

/** Count successful AI operations for the organization in the current calendar month. */
export async function countMonthlyUsage(organizationId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return db.aiUsageLog.count({
    where: {
      organizationId,
      status: "SUCCESS",
      createdAt: { gte: monthStart },
      operation: { in: ["PDF_EXTRACTION", "PME_ANALYSIS", "REPORT_ANALYSIS"] },
    },
  });
}

export class QuotaExceededError extends Error {
  code = AI_ERROR_CODES.AI_USAGE_LIMIT_REACHED;
  constructor() {
    super("Kuota analisis AI bulan ini telah tercapai.");
  }
}

/** Throws AI_USAGE_LIMIT_REACHED when the organization has used up its monthly quota. */
export async function assertQuota(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new QuotaExceededError();
  const used = await countMonthlyUsage(organizationId);
  if (used >= org.monthlyAiLimit) throw new QuotaExceededError();
}

async function callWithFallback<T>(
  ctx: UsageContext,
  primary: AIProvider,
  secondary: AIProvider | null,
  run: (provider: AIProvider) => Promise<{ data: T; usage: AIUsageMeta }>
): Promise<{ data: T; usage: AIUsageMeta; providerName: string }> {
  try {
    const result = await run(primary);
    await logUsage(ctx, result.usage, "SUCCESS");
    return { ...result, providerName: primary.name };
  } catch (primaryErr) {
    const pErr =
      primaryErr instanceof AIError
        ? primaryErr
        : new AIError(AI_ERROR_CODES.INTERNAL_AI_ERROR, primaryErr instanceof Error ? primaryErr.message : String(primaryErr));
    await logUsage(ctx, null, "FAILED", `${primary.name}: ${pErr.code}: ${pErr.message}`);

    if (secondary && getMode() === "auto") {
      try {
        const result = await run(secondary);
        await logUsage(ctx, result.usage, "SUCCESS");
        return { ...result, providerName: secondary.name };
      } catch (secondaryErr) {
        const sErr =
          secondaryErr instanceof AIError
            ? secondaryErr
            : new AIError(AI_ERROR_CODES.INTERNAL_AI_ERROR, secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr));
        await logUsage(ctx, null, "FAILED", `${secondary.name}: ${sErr.code}: ${sErr.message}`);
        throw sErr;
      }
    }
    throw pErr;
  }
}

function selectPrimary(): AIProvider {
  const mode = getMode();
  if (mode === "fallback") return fallbackProvider;
  if (mode === "gemini") return geminiProvider;
  // auto: use Gemini only when an API key is configured; otherwise go straight to the internal AI
  return process.env.GEMINI_API_KEY ? geminiProvider : fallbackProvider;
}

function selectSecondary(): AIProvider | null {
  const mode = getMode();
  // forced single-provider mode: no fallback by design
  if (mode === "gemini" || mode === "fallback") return null;
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  if (!hasGeminiKey) return null; // primary is internal AI; Gemini cannot serve without a key
  // auto with key: whichever provider is not primary acts as fallback
  return selectPrimary() === geminiProvider ? fallbackProvider : geminiProvider;
}

export async function extractPMEData(
  input: DocumentInput,
  ctx: UsageContext
): Promise<{ extraction: PMEExtraction; usage: AIUsageMeta; providerName: string }> {
  await assertQuota(ctx.organizationId);
  const primary = selectPrimary();
  const secondary = selectSecondary();
  const res = await callWithFallback<PMEExtraction>(
    ctx,
    primary,
    secondary,
    (p) => p.extractPMEData(input)
  );
  return { extraction: res.data, usage: res.usage, providerName: res.providerName };
}

export async function analyzePMEResult(
  input: PMEAnalysisInput,
  ctx: UsageContext
): Promise<{ analysis: PMEAnalysis; usage: AIUsageMeta; providerName: string }> {
  await assertQuota(ctx.organizationId);
  const primary = selectPrimary();
  const secondary = selectSecondary();
  const res = await callWithFallback<PMEAnalysis>(
    ctx,
    primary,
    secondary,
    (p) => p.analyzePMEResult(input)
  );
  return { analysis: res.data, usage: res.usage, providerName: res.providerName };
}

export interface ProviderStatus {
  gemini: { configured: boolean; ok: boolean; error?: string };
  fallback: { ok: boolean; error?: string };
  mode: string;
  model: string;
  keyMasked: string;
}

/** Health check for the AI Configuration admin page (PRD section #46). Never exposes the raw key. */
export async function checkProvidersHealth(): Promise<ProviderStatus> {
  const key = process.env.GEMINI_API_KEY || "";
  const keyMasked = key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : "";
  const [gemini, fallback] = await Promise.all([
    key ? geminiProvider.healthCheck() : Promise.resolve({ ok: false, error: "GEMINI_API_KEY not configured" }),
    fallbackProvider.healthCheck(),
  ]);
  return {
    gemini: { configured: Boolean(key), ok: gemini.ok, error: gemini.error },
    fallback: { ok: fallback.ok, error: fallback.error },
    mode: getMode(),
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    keyMasked,
  };
}
