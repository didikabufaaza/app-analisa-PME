import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";
import { parseIssues, type IssueCode } from "@/services/pme/validation-engine";

/** Category mapping for the AI Review Center (PRD section #33). */
function categorize(issues: IssueCode[]): string {
  if (issues.includes("OCR_CONFLICT")) return "OCR Conflict";
  if (issues.includes("SIGN_CONFLICT")) return "Possible Numeric Error";
  if (issues.includes("DUPLICATE_PARAMETER")) return "Extraction Conflict";
  if (issues.includes("MISSING_Z_SCORE") || issues.includes("MISSING_VALUE") || issues.includes("INVALID_NUMBER")) return "Missing Data";
  if (issues.includes("LOW_CONFIDENCE")) return "Low Confidence";
  return "Other";
}

/** GET /api/review — all results requiring human review for the tenant. */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req);
    const orgFilter = orgId === "ALL" ? {} : { organizationId: orgId };

    const results = await db.pmeResult.findMany({
      where: {
        ...orgFilter,
        validationStatus: "REVIEW_REQUIRED",
        reviewStatus: { in: ["NONE", "EDITED"] },
      },
      include: {
        session: { select: { id: true, cycle: true, program: true, provider: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const items = results.map((r) => {
      const issues = parseIssues(r.issues);
      return {
        id: r.id,
        sessionId: r.sessionId,
        parameterName: r.parameterName,
        participantValue: r.participantValue,
        targetValue: r.targetValue,
        sdpa: r.sdpa,
        zScore: r.zScore,
        unit: r.unit,
        peerGroup: r.peerGroup,
        providerRemark: r.providerRemark,
        zStatus: r.zStatus,
        issues,
        categories: categorize(issues),
        confidences: {
          parameter: r.parameterConfidence,
          participant: r.participantConfidence,
          target: r.targetConfidence,
          zScore: r.zScoreConfidence,
        },
        sourcePage: r.sourcePage,
        sourceText: r.sourceText,
        reviewStatus: r.reviewStatus,
        session: r.session,
      };
    });

    const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.categories] = (acc[item.categories] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ items, categoryCounts, total: items.length });
  });
}
