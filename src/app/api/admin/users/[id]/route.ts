import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withSuperAdmin, writeAudit, jsonError, jsonOk } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/admin/users/[id] — Update user details, role, access, or status. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withSuperAdmin(req, async ({ user }) => {
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return jsonError("Pengguna tidak ditemukan", 404);

    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Data request tidak valid", 400);

    const dataToUpdate: Record<string, unknown> = {};

    if (body.name !== undefined) dataToUpdate.name = String(body.name).trim();
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (email !== existing.email) {
        const conflict = await db.user.findUnique({ where: { email } });
        if (conflict) return jsonError("Email sudah digunakan pengguna lain", 409);
        dataToUpdate.email = email;
      }
    }
    if (body.password && String(body.password).trim().length >= 6) {
      dataToUpdate.passwordHash = await bcrypt.hash(String(body.password).trim(), 10);
    }
    if (body.role !== undefined) {
      const role = String(body.role).toUpperCase();
      const validRoles = ["SUPERADMIN", "ADMIN", "SUPERVISOR", "ANALYST"];
      if (validRoles.includes(role)) dataToUpdate.role = role;
    }
    if (body.organizationId !== undefined) {
      const org = await db.organization.findUnique({ where: { id: body.organizationId } });
      if (org) dataToUpdate.organizationId = body.organizationId;
    }
    if (body.isActive !== undefined) {
      // Prevent disabling own superadmin account
      if (existing.id === user.id && body.isActive === false) {
        return jsonError("Tidak dapat menonaktifkan akun sendiri", 400);
      }
      dataToUpdate.isActive = Boolean(body.isActive);
    }
    if (body.menuAccess !== undefined) {
      dataToUpdate.menuAccess = Array.isArray(body.menuAccess) ? JSON.stringify(body.menuAccess) : null;
    }

    const updated = await db.user.update({
      where: { id },
      data: dataToUpdate,
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
      organizationId: existing.organizationId,
      userId: user.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: existing.id,
      details: { updatedFields: Object.keys(dataToUpdate) },
    });

    let menuAccess: string[] = [];
    try {
      menuAccess = updated.menuAccess ? JSON.parse(updated.menuAccess) : [];
    } catch {
      menuAccess = [];
    }

    return jsonOk({ user: { ...updated, menuAccess } });
  });
}

/** DELETE /api/admin/users/[id] — Delete user. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withSuperAdmin(req, async ({ user }) => {
    if (id === user.id) {
      return jsonError("Tidak dapat menghapus akun sendiri", 400);
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return jsonError("Pengguna tidak ditemukan", 404);

    await db.user.delete({ where: { id } });

    await writeAudit({
      organizationId: existing.organizationId,
      userId: user.id,
      action: "DELETE_USER",
      entityType: "User",
      entityId: id,
      details: { email: existing.email, name: existing.name },
    });

    return jsonOk({ ok: true });
  });
}
