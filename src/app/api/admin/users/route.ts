import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withSuperAdmin, writeAudit, jsonError, jsonOk } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";

/** GET /api/admin/users — List all users (Superadmin only). */
export async function GET(req: NextRequest) {
  return withSuperAdmin(req, async ({ user }) => {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        menuAccess: true,
        createdAt: true,
        organizationId: true,
        organization: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = users.map((u) => {
      let menuAccess: string[] = [];
      try {
        menuAccess = u.menuAccess ? JSON.parse(u.menuAccess) : [];
      } catch {
        menuAccess = [];
      }
      return {
        ...u,
        menuAccess,
      };
    });

    return jsonOk({ users: mapped });
  });
}

/** POST /api/admin/users — Create a new user (Superadmin only). */
export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async ({ user }) => {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Data request tidak valid", 400);

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "ANALYST").toUpperCase();
    const organizationId = String(body.organizationId || "").trim();
    const menuAccess = Array.isArray(body.menuAccess) ? JSON.stringify(body.menuAccess) : null;
    const isActive = body.isActive !== false;

    if (!name || !email || !password || !organizationId) {
      return jsonError("Nama, email, password, dan organisasi wajib diisi", 400);
    }

    if (password.length < 6) {
      return jsonError("Password minimal 6 karakter", 400);
    }

    const validRoles = ["SUPERADMIN", "ADMIN", "SUPERVISOR", "ANALYST"];
    if (!validRoles.includes(role)) {
      return jsonError("Peran pengguna tidak valid", 400);
    }

    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return jsonError("Organisasi / Tenant tidak ditemukan", 404);
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email sudah terdaftar pada sistem", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        organizationId,
        menuAccess,
        isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        menuAccess: true,
        organizationId: true,
      },
    });

    await writeAudit({
      organizationId,
      userId: user.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: newUser.id,
      details: { name, email, role, organizationName: org.name },
    });

    return jsonOk({ user: newUser }, { status: 201 });
  });
}
