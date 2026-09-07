import { NextRequest, NextResponse } from "next/server";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";
import { generatePdfReportModel2 } from "@/services/pme/report-service";

/** GET /api/pme/:id/export/pdf2 — generate and stream the PDF report Model 2 (Format Evaluasi 5 Kolom). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const orgId = getEffectiveOrgId(user, req);
    const buffer = await generatePdfReportModel2(id, orgId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-pme-model2-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
