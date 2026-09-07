import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";
import { runAnalysisStage, isProcessing } from "@/services/pme/processor";
import { QuotaExceededError, countMonthlyUsage } from "@/services/ai/extraction-service";

/** POST /api/pme/:id/analyze — run AI analysis for all pending results of the session (async). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const session = await db.pmeSession.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!session) return NextResponse.json({ error: "Sesi PME tidak ditemukan." }, { status: 404 });
    if (isProcessing(id)) return NextResponse.json({ error: "Sesi sedang diproses." }, { status: 409 });

    const used = await countMonthlyUsage(user.organizationId);
    if (used >= user.organization.monthlyAiLimit) {
      return NextResponse.json(
        { error: "Kuota analisis AI bulan ini telah tercapai.", code: "AI_USAGE_LIMIT_REACHED" },
        { status: 429 }
      );
    }

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ANALYZE",
      entityType: "PmeSession",
      entityId: id,
    });

    // fire-and-forget; the UI polls GET /api/pme/:id for progress
    void runAnalysisStage(id, user.organizationId, user.id).catch((err) => {
      console.error("[analyze-session-async]", err);
      if (!(err instanceof QuotaExceededError)) {
        void db.pmeSession
          .update({ where: { id }, data: { status: "COMPLETED", statusDetail: "Analisis selesai dengan sebagian galat." } })
          .catch(() => undefined);
      }
    });

    return NextResponse.json({ ok: true, status: "ANALYZING" });
  });
}
