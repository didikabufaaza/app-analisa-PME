import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";

/** POST /api/pme/:id/report — register a report generation (audit + metadata). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const session = await db.pmeSession.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!session) return NextResponse.json({ error: "Sesi PME tidak ditemukan." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const format = String(body?.format || "PDF").toUpperCase() === "EXCEL" ? "EXCEL" : "PDF";
    const fileName = `laporan-pme-${session.cycle || session.id}.${format === "EXCEL" ? "xlsx" : "pdf"}`;

    const report = await db.report.create({
      data: {
        organizationId: user.organizationId,
        sessionId: session.id,
        format,
        fileName,
        generatedById: user.id,
      },
    });
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "GENERATE_REPORT",
      entityType: "Report",
      entityId: report.id,
      details: { format, sessionId: session.id },
    });

    return NextResponse.json({ report: { id: report.id, format: report.format, fileName: report.fileName } }, { status: 201 });
  });
}
