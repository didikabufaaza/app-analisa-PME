import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, estimateCost } from "@/lib/api-helpers";
import { checkProvidersHealth } from "@/services/ai/extraction-service";

/**
 * GET /api/admin/ai-config — AI Configuration page (PRD section #46).
 * Shows provider/model/status/last success/usage — NEVER the full API key.
 */
export async function GET(req: NextRequest) {
  return withAdmin(req, async ({ user }) => {
    const health = await checkProvidersHealth();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyCount, tokenAgg, lastSuccess] = await Promise.all([
      db.aiUsageLog.count({ where: { organizationId: user.organizationId, createdAt: { gte: monthStart } } }),
      db.aiUsageLog.aggregate({
        where: { organizationId: user.organizationId, createdAt: { gte: monthStart }, status: "SUCCESS" },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      db.aiUsageLog.findFirst({
        where: { organizationId: user.organizationId, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, provider: true, model: true },
      }),
    ]);

    const activeProvider =
      health.mode === "fallback" ? "internal-ai" : health.mode === "gemini" ? "gemini" : health.gemini.ok ? "gemini" : "internal-ai (fallback)";

    return NextResponse.json({
      provider: "Gemini (primary) + internal fallback",
      activeProvider,
      model: health.model,
      mode: health.mode,
      apiKeyMasked: health.keyMasked,
      apiStatus: health.gemini.ok ? "Connected" : health.gemini.configured ? "Error" : "Not configured",
      apiStatusDetail: health.gemini.ok ? null : health.gemini.error || "Gemini endpoint tidak dapat dijangkau dari jaringan ini. Sistem otomatis menggunakan AI fallback sehingga seluruh fitur tetap berfungsi.",
      fallbackStatus: health.fallback.ok ? "Connected" : "Error",
      fallbackDetail: health.fallback.error || null,
      lastSuccessfulRequest: lastSuccess,
      monthlyRequests: monthlyCount,
      monthlyTokenUsage: {
        input: tokenAgg._sum.inputTokens || 0,
        output: tokenAgg._sum.outputTokens || 0,
      },
      estimatedCost: Number(
        estimateCost(tokenAgg._sum.inputTokens || 0, tokenAgg._sum.outputTokens || 0).toFixed(4)
      ),
    });
  });
}
