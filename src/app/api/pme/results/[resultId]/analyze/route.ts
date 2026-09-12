import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";
import { runAnalysisStage } from "@/services/pme/processor";
import { QuotaExceededError } from "@/services/ai/extraction-service";

/** POST /api/pme/results/:resultId/analyze — on-demand AI analysis for a single result (async). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { resultId } = await params;
    const result = await db.pmeResult.findFirst({
      where: { id: resultId, organizationId: user.organizationId },
      include: { session: true },
    });
    if (!result) return NextResponse.json({ error: "Hasil tidak ditemukan." }, { status: 404 });

    const hasZ = [result.zScore, result.instrumentZScore, result.methodZScore, result.allParticipantsZScore].some(
      (z) => typeof z === "number" && !isNaN(z)
    );
    if (!hasZ) {
      return NextResponse.json(
        { error: "Parameter ini tidak dianalisa nilai Z-Score oleh penyelenggara PME sehingga tidak dapat dianalisa oleh AI." },
        { status: 400 }
      );
    }

    await db.pmeResult.update({ where: { id: result.id }, data: { analysisStatus: "PENDING" } });
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ANALYZE",
      entityType: "PmeResult",
      entityId: result.id,
      details: { parameter: result.parameterName },
    });

    try {
      await runAnalysisStage(result.sessionId, user.organizationId, user.id, 1, result.id);
      const updated = await db.pmeResult.findUnique({
        where: { id: result.id },
        include: { aiAnalysis: true },
      });

      return NextResponse.json({
        ok: true,
        status: "DONE",
        aiAnalysis: updated?.aiAnalysis
          ? {
              interpretation: updated.aiAnalysis.interpretation,
              possibleCauses: updated.aiAnalysis.possibleCauses,
              investigationSteps: updated.aiAnalysis.investigationSteps,
              correctiveActions: updated.aiAnalysis.correctiveActions,
              preventiveActions: updated.aiAnalysis.preventiveActions,
            }
          : null,
      });
    } catch (err) {
      console.error("[analyze-result-sync]", err);
      if (!(err instanceof QuotaExceededError)) {
        await db.pmeResult
          .update({ where: { id: result.id }, data: { analysisStatus: "SKIPPED" } })
          .catch(() => undefined);
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Gagal melakukan analisis AI." },
        { status: err instanceof QuotaExceededError ? 429 : 500 }
      );
    }
  });
}
