import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";

/** PATCH /api/capa/:id — update CAPA (status transitions recorded in audit log). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const capa = await db.capaAction.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!capa) return NextResponse.json({ error: "CAPA tidak ditemukan." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const str = (v: unknown, max = 2000) => (v !== undefined ? (v ? String(v).slice(0, max) : null) : undefined);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.problem !== undefined) data.problem = str(body.problem) ?? capa.problem;
    if (body.finding !== undefined) data.finding = str(body.finding);
    if (body.rootCause !== undefined) data.rootCause = str(body.rootCause);
    if (body.immediateCorrection !== undefined) data.immediateCorrection = str(body.immediateCorrection);
    if (body.correctiveAction !== undefined) data.correctiveAction = str(body.correctiveAction);
    if (body.preventiveAction !== undefined) data.preventiveAction = str(body.preventiveAction);
    if (body.pic !== undefined) data.pic = str(body.pic, 200);
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
    if (body.verification !== undefined) data.verification = str(body.verification);
    if (body.evidence !== undefined) data.evidence = str(body.evidence);
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (!["OPEN", "IN_PROGRESS", "CLOSED"].includes(status)) {
        return NextResponse.json({ error: "Status CAPA tidak valid." }, { status: 400 });
      }
      data.status = status;
      data.closedAt = status === "CLOSED" ? new Date() : null;
    }

    const updated = await db.capaAction.update({ where: { id }, data });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "UPDATE_CAPA",
      entityType: "CapaAction",
      entityId: id,
      details: { status: updated.status },
    });

    return NextResponse.json({ ok: true, status: updated.status });
  });
}

/** DELETE /api/capa/:id — delete CAPA action. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const capa = await db.capaAction.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!capa) return NextResponse.json({ error: "CAPA tidak ditemukan." }, { status: 404 });

    await db.capaAction.delete({ where: { id } });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "DELETE_CAPA",
      entityType: "CapaAction",
      entityId: id,
      details: { problem: capa.problem },
    });

    return NextResponse.json({ ok: true });
  });
}
