import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, getEffectiveOrgId, jsonOk } from "@/lib/api-helpers";

/** GET /api/reports — Query PME results with full multi-dimensional filters for Reports view. */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req);
    const searchParams = req.nextUrl.searchParams;

    const sessionId = searchParams.get("sessionId");
    const program = searchParams.get("program");
    const cycle = searchParams.get("cycle");
    const period = searchParams.get("period");
    const zStatus = searchParams.get("zStatus");
    const q = searchParams.get("q")?.trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const orgFilter = orgId === "ALL" ? {} : { organizationId: orgId };

    // Fetch sessions for filter options
    const availableSessions = await db.pmeSession.findMany({
      where: {
        ...orgFilter,
        status: { in: ["COMPLETED", "REVIEW_REQUIRED"] },
      },
      select: {
        id: true,
        program: true,
        cycle: true,
        period: true,
        provider: true,
        laboratoryName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const sessionWhere: Record<string, unknown> = {
      ...orgFilter,
      status: { in: ["COMPLETED", "REVIEW_REQUIRED"] },
    };

    if (sessionId) sessionWhere.id = sessionId;
    if (program) sessionWhere.program = program;
    if (cycle) sessionWhere.cycle = cycle;
    if (period) sessionWhere.period = period;
    if (startDate || endDate) {
      sessionWhere.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) } : {}),
      };
    }

    const resultWhere: Record<string, unknown> = {
      session: sessionWhere,
    };

    if (zStatus) {
      if (zStatus === "REVIEW_REQUIRED") {
        resultWhere.validationStatus = "REVIEW_REQUIRED";
      } else {
        resultWhere.zStatus = zStatus;
      }
    }

    if (q) {
      resultWhere.parameterName = { contains: q };
    }

    const results = await db.pmeResult.findMany({
      where: resultWhere,
      include: {
        aiAnalysis: {
          select: {
            interpretation: true,
            possibleCauses: true,
            investigationSteps: true,
            correctiveActions: true,
            preventiveActions: true,
            provider: true,
            model: true,
          },
        },
        capaActions: {
          select: {
            id: true,
            status: true,
            pic: true,
            dueDate: true,
          },
        },
        session: {
          select: {
            id: true,
            program: true,
            cycle: true,
            period: true,
            provider: true,
            laboratoryName: true,
            createdAt: true,
            ruleVersion: true,
          },
        },
      },
      orderBy: [{ session: { createdAt: "desc" } }, { parameterName: "asc" }],
      take: 200,
    });

    // Compute summary metrics
    const summary = {
      total: results.length,
      satisfactory: results.filter((r) => r.zStatus === "SATISFACTORY").length,
      warning: results.filter((r) => r.zStatus === "WARNING").length,
      unsatisfactory: results.filter((r) => r.zStatus === "UNSATISFACTORY").length,
      reviewRequired: results.filter((r) => r.validationStatus === "REVIEW_REQUIRED").length,
    };

    // Extract unique filter options
    const uniquePrograms = Array.from(new Set(availableSessions.map((s) => s.program).filter(Boolean)));
    const uniqueCycles = Array.from(new Set(availableSessions.map((s) => s.cycle).filter(Boolean)));
    const uniquePeriods = Array.from(new Set(availableSessions.map((s) => s.period).filter(Boolean)));

    return jsonOk({
      items: results,
      summary,
      filterOptions: {
        sessions: availableSessions,
        programs: uniquePrograms,
        cycles: uniqueCycles,
        periods: uniquePeriods,
      },
    });
  });
}
