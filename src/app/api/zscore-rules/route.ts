import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, withAdmin, writeAudit } from "@/lib/api-helpers";
import { getActiveRule, computeZStatus } from "@/services/pme/zscore-engine";

/** GET /api/zscore-rules — active rule + version history. */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const [rules, active] = await Promise.all([
      db.zscoreRule.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { effectiveDate: "desc" },
        take: 20,
      }),
      getActiveRule(user.organizationId),
    ]);
    return NextResponse.json({ rules, active });
  });
}

/** PATCH /api/zscore-rules — create a new rule version (admin only) + optional re-evaluation. */
export async function PATCH(req: NextRequest) {
  return withAdmin(req, async ({ user }) => {
    const body = await req.json().catch(() => ({}));
    const satisfactoryLimit = Number(body?.satisfactoryLimit);
    const warningLimit = Number(body?.warningLimit);

    if (!Number.isFinite(satisfactoryLimit) || !Number.isFinite(warningLimit) || satisfactoryLimit <= 0 || warningLimit <= satisfactoryLimit) {
      return NextResponse.json(
        { error: "Batas tidak valid: satisfactoryLimit > 0 dan warningLimit > satisfactoryLimit." },
        { status: 400 }
      );
    }

    const activeRule = await getActiveRule(user.organizationId);
    const newVersion = `v${Date.now().toString(36)}`;

    await db.$transaction([
      db.zscoreRule.updateMany({ where: { organizationId: user.organizationId, isActive: true }, data: { isActive: false } }),
      db.zscoreRule.create({
        data: {
          organizationId: user.organizationId,
          ruleVersion: newVersion,
          satisfactoryLimit,
          warningLimit,
          isActive: true,
        },
      }),
    ]);

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "UPDATE_RULES",
      entityType: "ZscoreRule",
      details: { from: activeRule, to: { satisfactoryLimit, warningLimit, ruleVersion: newVersion } },
    });

    // optional deterministic re-evaluation of stored results (no AI involved)
    let reevaluated = 0;
    if (body?.reapply) {
      const results = await db.pmeResult.findMany({
        where: { organizationId: user.organizationId, zScore: { not: null } },
        select: { id: true, zScore: true },
      });
      for (const r of results) {
        await db.pmeResult.update({
          where: { id: r.id },
          data: { zStatus: computeZStatus(r.zScore, { ruleVersion: newVersion, satisfactoryLimit, warningLimit }) },
        });
        reevaluated += 1;
      }
    }

    return NextResponse.json({ ok: true, ruleVersion: newVersion, reevaluated });
  });
}
