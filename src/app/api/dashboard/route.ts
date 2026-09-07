import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";

/**
 * GET /api/dashboard — aggregate KPIs + chart data for the tenant.
 * Includes: totals, z-score distribution, parameter status, PME trend,
 * worst z-scores and AI confidence stats (PRD section #30).
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req);
    const orgFilter = orgId === "ALL" ? {} : { organizationId: orgId };

    const [totalSessions, results, recentSessions] = await Promise.all([
      db.pmeSession.count({ where: orgFilter }),
      db.pmeResult.findMany({
        where: { ...orgFilter, reviewStatus: { not: "REJECTED" } },
        select: {
          id: true,
          parameterName: true,
          zScore: true,
          zStatus: true,
          validationStatus: true,
          zScoreConfidence: true,
          participantConfidence: true,
          targetConfidence: true,
          parameterConfidence: true,
          sessionId: true,
          session: { select: { createdAt: true, cycle: true, provider: true } },
        },
      }),
      db.pmeSession.findMany({
        where: orgFilter,
        select: { id: true, createdAt: true, cycle: true, provider: true, program: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const counts = {
      totalPme: totalSessions,
      totalParameter: results.length,
      satisfactory: results.filter((r) => r.zStatus === "SATISFACTORY").length,
      warning: results.filter((r) => r.zStatus === "WARNING").length,
      unsatisfactory: results.filter((r) => r.zStatus === "UNSATISFACTORY").length,
      reviewRequired: results.filter((r) => r.validationStatus === "REVIEW_REQUIRED").length,
    };

    // z-score distribution buckets
    const buckets = [
      { range: "≤ -3", label: "≤ -3", count: 0 },
      { range: "-3 s/d -2", label: "-3 s/d -2", count: 0 },
      { range: "-2 s/d 0", label: "-2 s/d 0", count: 0 },
      { range: "0 s/d 2", label: "0 s/d 2", count: 0 },
      { range: "2 s/d 3", label: "2 s/d 3", count: 0 },
      { range: "≥ 3", label: "≥ 3", count: 0 },
    ];
    for (const r of results) {
      const z = r.zScore;
      if (z === null) continue;
      if (z <= -3) buckets[0].count++;
      else if (z < -2) buckets[1].count++;
      else if (z < 0) buckets[2].count++;
      else if (z <= 2) buckets[3].count++;
      else if (z < 3) buckets[4].count++;
      else buckets[5].count++;
    }

    // trend per session (chronological)
    const trendMap = new Map<string, { name: string; avgAbsZ: number; warning: number; unsatisfactory: number; total: number }>();
    for (const r of results) {
      if (!r.session) continue;
      const key = r.sessionId;
      const name = r.session.cycle || r.session.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const entry = trendMap.get(key) || { name, avgAbsZ: 0, warning: 0, unsatisfactory: 0, total: 0 };
      if (r.zScore !== null) {
        entry.avgAbsZ += Math.abs(r.zScore);
        entry.total += 1;
      }
      if (r.zStatus === "WARNING") entry.warning += 1;
      if (r.zStatus === "UNSATISFACTORY") entry.unsatisfactory += 1;
      trendMap.set(key, entry);
    }
    const trend = Array.from(trendMap.entries())
      .map(([id, e]) => ({
        id,
        name: e.name,
        avgAbsZ: e.total > 0 ? Number((e.avgAbsZ / e.total).toFixed(2)) : 0,
        warning: e.warning,
        unsatisfactory: e.unsatisfactory,
      }))
      .slice(-10);

    // worst z-scores (top 8 by abs value)
    const worst = results
      .filter((r) => r.zScore !== null)
      .sort((a, b) => Math.abs(b.zScore!) - Math.abs(a.zScore!))
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        parameter: r.parameterName,
        zScore: Number(r.zScore!.toFixed(3)),
        zStatus: r.zStatus,
        cycle: r.session?.cycle || null,
      }));

    // AI confidence: average of min confidence per result
    const confidences = results.map((r) =>
      Math.min(r.parameterConfidence, r.participantConfidence, r.targetConfidence, r.zScoreConfidence)
    );
    const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    const confidenceBuckets = [
      { name: "High (≥95%)", count: confidences.filter((c) => c >= 0.95).length },
      { name: "Medium (85-95%)", count: confidences.filter((c) => c >= 0.85 && c < 0.95).length },
      { name: "Low (<85%)", count: confidences.filter((c) => c < 0.85).length },
    ];

    // parameter status pie
    const parameterStatus = [
      { name: "Memuaskan", value: counts.satisfactory, key: "SATISFACTORY" },
      { name: "Waspada", value: counts.warning, key: "WARNING" },
      { name: "Tidak Memuaskan", value: counts.unsatisfactory, key: "UNSATISFACTORY" },
      { name: "Perlu Review", value: counts.reviewRequired, key: "REVIEW" },
    ].filter((s) => s.value > 0);

    return NextResponse.json({
      counts,
      zDistribution: buckets,
      parameterStatus,
      trend,
      worst,
      aiConfidence: { average: Number(avgConfidence.toFixed(3)), buckets: confidenceBuckets },
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        cycle: s.cycle,
        provider: s.provider,
        program: s.program,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  });
}
