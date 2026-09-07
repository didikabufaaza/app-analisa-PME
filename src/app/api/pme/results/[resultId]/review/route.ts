import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";
import { enqueueSession } from "@/services/pme/processor";

/**
 * POST /api/pme/results/:resultId/review
 * Body: { action: "ACCEPT" | "REJECT" | "REPROCESS" }
 * All review decisions are recorded in the audit log (PRD section #33).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { resultId } = await params;
    const result = await db.pmeResult.findFirst({
      where: { id: resultId, organizationId: user.organizationId },
    });
    if (!result) return NextResponse.json({ error: "Hasil tidak ditemukan." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();

    if (action === "ACCEPT") {
      await db.pmeResult.update({
        where: { id: result.id },
        data: {
          validationStatus: "VALID",
          reviewStatus: "ACCEPTED",
          issues: JSON.stringify([]),
          updatedAt: new Date(),
        },
      });
      await writeAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: "REVIEW_ACCEPT",
        entityType: "PmeResult",
        entityId: result.id,
        details: { parameter: result.parameterName },
      });
    } else if (action === "REJECT") {
      await db.pmeResult.update({
        where: { id: result.id },
        data: { reviewStatus: "REJECTED", updatedAt: new Date() },
      });
      await writeAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: "REVIEW_REJECT",
        entityType: "PmeResult",
        entityId: result.id,
        details: { parameter: result.parameterName },
      });
    } else if (action === "REPROCESS") {
      const session = await db.pmeSession.findFirst({ where: { id: result.sessionId, organizationId: user.organizationId } });
      if (!session) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
      await db.pmeSession.update({
        where: { id: session.id },
        data: { status: "UPLOADED", statusDetail: "Reproses dari Review Center...", errorMessage: null, errorCode: null },
      });
      enqueueSession(session.id, user.organizationId, user.id);
      await writeAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: "REPROCESS",
        entityType: "PmeSession",
        entityId: session.id,
        details: { from: "REVIEW_CENTER" },
      });
      return NextResponse.json({ ok: true, action, status: "UPLOADED" });
    } else {
      return NextResponse.json({ error: "Aksi review tidak dikenal." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action });
  });
}
