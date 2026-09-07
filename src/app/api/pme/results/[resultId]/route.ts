import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";
import { getActiveRule, computeZStatus } from "@/services/pme/zscore-engine";
import { revalidateStoredResult } from "@/services/pme/validation-engine";

/** PATCH /api/pme/results/:resultId — human review edit (Review Center / detail page). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { resultId } = await params;
    const result = await db.pmeResult.findFirst({
      where: { id: resultId, organizationId: user.organizationId },
    });
    if (!result) return NextResponse.json({ error: "Hasil tidak ditemukan." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    const updated = {
      parameterName: body.parameterName !== undefined ? String(body.parameterName).trim().slice(0, 300) : result.parameterName,
      participantValue: body.participantValue !== undefined ? num(body.participantValue) : result.participantValue,
      targetValue: body.targetValue !== undefined ? num(body.targetValue) : result.targetValue,
      sdpa: body.sdpa !== undefined ? num(body.sdpa) : result.sdpa,
      zScore: body.zScore !== undefined ? num(body.zScore) : result.zScore,
      unit: body.unit !== undefined ? (body.unit ? String(body.unit).slice(0, 100) : null) : result.unit,
      method: body.method !== undefined ? (body.method ? String(body.method).slice(0, 200) : null) : result.method,
      instrument: body.instrument !== undefined ? (body.instrument ? String(body.instrument).slice(0, 200) : null) : result.instrument,
    };

    // re-run deterministic validation (PRD: validation engine always re-checks human edits)
    const issues = revalidateStoredResult({
      parameterName: updated.parameterName,
      participantValue: updated.participantValue,
      targetValue: updated.targetValue,
      zScore: updated.zScore,
      parameterConfidence: Math.max(result.parameterConfidence, body.parameterName !== undefined ? 1 : 0),
      participantConfidence: Math.max(result.participantConfidence, body.participantValue !== undefined ? 1 : 0),
      targetConfidence: Math.max(result.targetConfidence, body.targetValue !== undefined ? 1 : 0),
      zScoreConfidence: Math.max(result.zScoreConfidence, body.zScore !== undefined ? 1 : 0),
      sourcePage: result.sourcePage,
    });
    const critical = ["LOW_CONFIDENCE", "MISSING_Z_SCORE", "MISSING_VALUE", "INVALID_NUMBER", "SIGN_CONFLICT", "OCR_CONFLICT"];
    const validationStatus = issues.some((i) => critical.includes(i)) ? "REVIEW_REQUIRED" : "VALID";

    const rule = await getActiveRule(user.organizationId);
    const zStatus = computeZStatus(updated.zScore, rule);

    const saved = await db.pmeResult.update({
      where: { id: result.id },
      data: {
        ...updated,
        issues: JSON.stringify(issues),
        validationStatus,
        zStatus,
        reviewStatus: "EDITED",
        updatedAt: new Date(),
      },
    });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "EDIT_RESULT",
      entityType: "PmeResult",
      entityId: result.id,
      details: { before: { participantValue: result.participantValue, targetValue: result.targetValue, zScore: result.zScore }, after: { participantValue: saved.participantValue, targetValue: saved.targetValue, zScore: saved.zScore } },
    });

    return NextResponse.json({
      result: {
        id: saved.id,
        parameterName: saved.parameterName,
        participantValue: saved.participantValue,
        targetValue: saved.targetValue,
        sdpa: saved.sdpa,
        zScore: saved.zScore,
        zStatus: saved.zStatus,
        validationStatus: saved.validationStatus,
        reviewStatus: saved.reviewStatus,
        issues: JSON.parse(saved.issues || "[]"),
      },
    });
  });
}
