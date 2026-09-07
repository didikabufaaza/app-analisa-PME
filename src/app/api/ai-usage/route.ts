import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, estimateCost } from "@/lib/api-helpers";
import { countMonthlyUsage } from "@/services/ai/extraction-service";

/** GET /api/ai-usage — monthly AI usage, token stats and estimated cost (PRD sections #11, #48). */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [logs, byOperation, used] = await Promise.all([
      db.aiUsageLog.findMany({
        where: { organizationId: user.organizationId, createdAt: { gte: monthStart } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.aiUsageLog.groupBy({
        by: ["operation"],
        where: { organizationId: user.organizationId, createdAt: { gte: monthStart }, status: "SUCCESS" },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true, processingTimeMs: true },
      }),
      countMonthlyUsage(user.organizationId),
    ]);

    const totals = byOperation.reduce(
      (acc, op) => {
        acc.requests += op._count._all;
        acc.inputTokens += op._sum.inputTokens || 0;
        acc.outputTokens += op._sum.outputTokens || 0;
        acc.totalTokens += op._sum.totalTokens || 0;
        acc.errors += 0;
        return acc;
      },
      { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, errors: 0 }
    );

    const [failedCount] = await Promise.all([
      db.aiUsageLog.count({ where: { organizationId: user.organizationId, createdAt: { gte: monthStart }, status: "FAILED" } }),
    ]);
    totals.errors = failedCount;

    // quota usage alerts (80% / 90% / 100%)
    const limit = user.organization.monthlyAiLimit;
    const usagePct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const alerts: string[] = [];
    if (usagePct >= 100) alerts.push("Kuota AI bulan ini telah tercapai (100%).");
    else if (usagePct >= 90) alerts.push(`Penggunaan AI mencapai ${usagePct}% dari kuota bulanan.`);
    else if (usagePct >= 80) alerts.push(`Penggunaan AI mencapai ${usagePct}% dari kuota bulanan.`);

    return NextResponse.json({
      summary: {
        ...totals,
        successfulRequests: used,
        limit,
        usagePct,
        estimatedCost: Number(estimateCost(totals.inputTokens, totals.outputTokens).toFixed(4)),
        alerts,
      },
      byOperation: byOperation.map((op) => ({
        operation: op.operation,
        requests: op._count._all,
        totalTokens: op._sum.totalTokens || 0,
        processingTimeMs: op._sum.processingTimeMs || 0,
      })),
      recentLogs: logs.slice(0, 30).map((l) => ({
        id: l.id,
        provider: l.provider,
        model: l.model,
        operation: l.operation,
        inputTokens: l.inputTokens,
        outputTokens: l.outputTokens,
        totalTokens: l.totalTokens,
        processingTimeMs: l.processingTimeMs,
        status: l.status,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt,
      })),
    });
  });
}
