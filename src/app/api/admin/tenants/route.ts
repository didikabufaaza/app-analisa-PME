import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, withSuperAdmin, writeAudit, jsonError, jsonOk } from "@/lib/api-helpers";

/** GET /api/admin/tenants — List all organizations / tenants. */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    // If not superadmin, only return user's own organization
    if (user.role !== "SUPERADMIN") {
      const org = await db.organization.findUnique({
        where: { id: user.organizationId },
        select: { id: true, name: true, slug: true, plan: true, monthlyAiLimit: true },
      });
      return jsonOk({ tenants: org ? [org] : [] });
    }

    const organizations = await db.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        monthlyAiLimit: true,
        createdAt: true,
        _count: {
          select: { users: true, pmeSessions: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return jsonOk({ tenants: organizations });
  });
}

/** POST /api/admin/tenants — Create a new organization / tenant (Superadmin only). */
export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async ({ user }) => {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Data request tidak valid", 400);

    const name = String(body.name || "").trim();
    let slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const plan = String(body.plan || "PRO").toUpperCase();
    const monthlyAiLimit = Number(body.monthlyAiLimit) || 100;

    if (!name) return jsonError("Nama organisasi wajib diisi", 400);
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 50);

    const existing = await db.organization.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const org = await db.organization.create({
      data: {
        name,
        slug,
        plan,
        monthlyAiLimit,
      },
    });

    await writeAudit({
      organizationId: org.id,
      userId: user.id,
      action: "CREATE_TENANT",
      entityType: "Organization",
      entityId: org.id,
      details: { name, slug, plan },
    });

    return jsonOk({ tenant: org }, { status: 201 });
  });
}
