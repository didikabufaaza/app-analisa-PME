import { NextRequest, NextResponse } from "next/server";
import { withAuth, writeAudit } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { enqueueSession, isProcessing } from "@/services/pme/processor";

/** POST /api/pme/:id/process — (re)process a session through the full pipeline. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const session = await db.pmeSession.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!session) return NextResponse.json({ error: "Sesi PME tidak ditemukan." }, { status: 404 });
    if (isProcessing(id)) return NextResponse.json({ error: "Sesi sedang diproses." }, { status: 409 });

    await db.pmeSession.update({
      where: { id },
      data: { status: "UPLOADED", statusDetail: "Reproses diminta pengguna...", errorMessage: null, errorCode: null },
    });
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "REPROCESS",
      entityType: "PmeSession",
      entityId: id,
    });
    enqueueSession(id, user.organizationId, user.id);
    return NextResponse.json({ ok: true, status: "UPLOADED" });
  });
}
