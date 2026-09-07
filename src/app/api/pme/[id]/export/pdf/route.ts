import { NextRequest, NextResponse } from "next/server";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";
import { generatePdfReport } from "@/services/pme/report-service";

/** GET /api/pme/:id/export/pdf — generate and stream the PDF report Model 1 (Komprehensif Z-Score). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const orgId = getEffectiveOrgId(user, req);
    const buffer = await generatePdfReport(id, orgId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-pme-model1-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
