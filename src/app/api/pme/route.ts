import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";

const pmeCache = new Map<string, { data: unknown; expiresAt: number }>();

/** GET /api/pme — list PME sessions for the authenticated tenant (or selected tenant if Superadmin). */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req);
    const orgFilter = orgId === "ALL" ? {} : { organizationId: orgId };

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

    const cacheKey = `pme:${orgId}:${q}:${status}:${limit}`;
    const cached = pmeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { "X-Cache": "HIT", "Cache-Control": "private, max-age=3" },
      });
    }

    const [sessions, statusCounts] = await Promise.all([
      db.pmeSession.findMany({
        where: {
          ...orgFilter,
          ...(status ? { status } : {}),
          ...(q
            ? {
                OR: [
                  { provider: { contains: q } },
                  { program: { contains: q } },
                  { cycle: { contains: q } },
                  { period: { contains: q } },
                  { laboratoryName: { contains: q } },
                  { file: { fileName: { contains: q } } },
                ],
              }
            : {}),
        },
        include: {
          file: { select: { fileName: true, sizeBytes: true, pageCount: true, pdfClass: true } },
          _count: { select: { results: true, capaActions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.pmeSession.groupBy({
        by: ["status"],
        where: orgFilter,
        _count: { _all: true },
      }),
    ]);

    const payload = {
      sessions: sessions.map((s) => ({
        id: s.id,
        provider: s.provider,
        program: s.program,
        cycle: s.cycle,
        period: s.period,
        laboratoryName: s.laboratoryName,
        participantId: s.participantId,
        status: s.status,
        statusDetail: s.statusDetail,
        errorMessage: s.errorMessage,
        errorCode: s.errorCode,
        ruleVersion: s.ruleVersion,
        aiProvider: s.aiProvider,
        createdAt: s.createdAt,
        file: s.file,
        resultCount: s._count.results,
        capaCount: s._count.capaActions,
      })),
      statusCounts: Object.fromEntries(statusCounts.map((c) => [c.status, c._count._all])),
    };

    pmeCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 3000 });

    return NextResponse.json(payload, {
      headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=3" },
    });
  });
}
