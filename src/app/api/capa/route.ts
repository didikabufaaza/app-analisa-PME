import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit, getEffectiveOrgId } from "@/lib/api-helpers";

/** GET /api/capa — list CAPA actions for the tenant. */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req);
    const orgFilter = orgId === "ALL" ? {} : { organizationId: orgId };
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const capas = await db.capaAction.findMany({
      where: {
        ...orgFilter,
        ...(status ? { status } : {}),
      },
      include: {
        result: { select: { parameterName: true, zScore: true, zStatus: true } },
        session: { select: { id: true, cycle: true, program: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      capas: capas.map((c) => ({
        id: c.id,
        problem: c.problem,
        finding: c.finding,
        rootCause: c.rootCause,
        immediateCorrection: c.immediateCorrection,
        correctiveAction: c.correctiveAction,
        preventiveAction: c.preventiveAction,
        pic: c.pic,
        dueDate: c.dueDate,
        verification: c.verification,
        evidence: c.evidence,
        status: c.status,
        closedAt: c.closedAt,
        createdAt: c.createdAt,
        result: c.result,
        session: c.session,
      })),
    });
  });
}

/** POST /api/capa — create CAPA (optionally pre-filled from an AI analysis). */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const body = await req.json().catch(() => ({}));
    const str = (v: unknown, max = 2000) => (v ? String(v).slice(0, max) : null);

    if (!body.problem || !String(body.problem).trim()) {
      return NextResponse.json({ error: "Deskripsi masalah wajib diisi." }, { status: 400 });
    }

    let resultId: string | null = null;
    let sessionId: string | null = null;
    if (body.resultId) {
      const result = await db.pmeResult.findFirst({
        where: { id: String(body.resultId), organizationId: user.organizationId },
      });
      if (result) {
        resultId = result.id;
        sessionId = result.sessionId;
      }
    }

    const capa = await db.capaAction.create({
      data: {
        organizationId: user.organizationId,
        sessionId,
        resultId,
        problem: String(body.problem).slice(0, 2000),
        finding: str(body.finding),
        rootCause: str(body.rootCause),
        immediateCorrection: str(body.immediateCorrection),
        correctiveAction: str(body.correctiveAction),
        preventiveAction: str(body.preventiveAction),
        pic: str(body.pic, 200),
        dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
        verification: str(body.verification),
        evidence: str(body.evidence),
        status: "OPEN",
      },
    });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "CREATE_CAPA",
      entityType: "CapaAction",
      entityId: capa.id,
      details: { problem: capa.problem },
    });

    return NextResponse.json({ capa: { id: capa.id } }, { status: 201 });
  });
}
