import { NextRequest, NextResponse } from "next/server";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";
import { generateExcelReportModel2 } from "@/services/pme/report-service";

/** GET /api/pme/:id/export/excel2 — generate and stream the Excel export Model 2 (Format EVALUASI PME.xlsx 5 Kolom). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const orgId = getEffectiveOrgId(user, req);
    const buffer = await generateExcelReportModel2(id, orgId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="evaluasi-pme-model2-${id}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
