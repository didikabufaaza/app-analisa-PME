import { NextRequest, NextResponse } from "next/server";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";
import { generateExcelReport } from "@/services/pme/report-service";

/** GET /api/pme/:id/export/excel — generate and stream the Excel export Model 1 (Teknis). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const orgId = getEffectiveOrgId(user, req);
    const buffer = await generateExcelReport(id, orgId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="hasil-pme-model1-${id}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
