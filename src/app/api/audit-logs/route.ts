import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";

/** GET /api/audit-logs — tenant audit trail (latest 100). */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req);
    const orgFilter = orgId === "ALL" ? {} : { organizationId: orgId };
    const logs = await db.auditLog.findMany({
      where: orgFilter,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        details: l.details ? JSON.parse(l.details) : null,
        user: l.user ? { name: l.user.name, email: l.user.email } : null,
        createdAt: l.createdAt,
      })),
    });
  });
}
