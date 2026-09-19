import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

function canAccessPmeMgmt(user: { role: string; menuAccess?: string | null }) {
  if (user.role === "SUPERADMIN") return true;
  if (user.menuAccess) {
    try {
      const allowed: string[] = JSON.parse(user.menuAccess);
      if (allowed.includes("pme-management") || allowed.includes("pme-registration")) return true;
    } catch {}
  }
  return false;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak. Anda tidak memiliki izin Manajemen Data PME.", 403, "FORBIDDEN");
    }

    const orgId = getEffectiveOrgId(user, req);
    const whereClause: { organizationId?: string } = {};
    if (orgId !== "ALL") {
      whereClause.organizationId = orgId;
    }

    const participants = await db.pmeParticipant.findMany({
      where: whereClause,
      include: {
        packageRegistrations: {
          include: {
            package: true,
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk({ participants });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak. Anda tidak memiliki izin Manajemen Data PME.", 403, "FORBIDDEN");
    }

    const orgId = getEffectiveOrgId(user, req) === "ALL" ? user.organizationId : getEffectiveOrgId(user, req);
    const body = await req.json();

    const { id, participantCode, labName, phone, email, address, contactPerson, cycle, status, action } = body;

    // Aksi Persetujuan oleh Superadmin
    if (action) {
      if (user.role !== "SUPERADMIN") {
        return jsonError("Hanya Superadmin yang berhak menyetujui atau menolak pendaftaran peserta PME.", 403, "FORBIDDEN");
      }
      if (!id) return jsonError("ID peserta diperlukan.", 400);

      const existing = await db.pmeParticipant.findUnique({ where: { id } });
      if (!existing || (user.role !== "SUPERADMIN" && existing.organizationId !== user.organizationId)) {
        return jsonError("Peserta tidak ditemukan.", 404);
      }

      let newStatus = "PENDING";
      let approvedAt: Date | null = null;
      let approvedBy: string | null = null;

      if (action === "approve") {
        newStatus = "APPROVED";
        approvedAt = new Date();
        approvedBy = user.name || user.email || "Superadmin";
      } else if (action === "reject") {
        newStatus = "REJECTED";
        approvedAt = null;
        approvedBy = user.name || user.email || "Superadmin";
      } else if (action === "pending") {
        newStatus = "PENDING";
        approvedAt = null;
        approvedBy = null;
      } else {
        return jsonError("Aksi tidak valid (gunakan: approve, reject, atau pending).", 400);
      }

      const updated = await db.pmeParticipant.update({
        where: { id },
        data: {
          status: newStatus,
          approvedAt,
          approvedBy,
        },
      });

      return jsonOk({ participant: updated, message: `Status peserta berhasil diubah menjadi ${newStatus}.` });
    }

    if (!labName || !labName.trim()) {
      return jsonError("Nama Laboratorium Peserta wajib diisi.", 400);
    }

    // Auto-generate code if empty
    let code = participantCode?.trim();
    if (!code) {
      const count = await db.pmeParticipant.count({ where: { organizationId: orgId } });
      code = `LAB-${String(count + 1).padStart(3, "0")}`;
    }

    const assignedCycle = cycle?.trim() || "Siklus 1 2026";

    if (id) {
      // Update existing
      const existing = await db.pmeParticipant.findUnique({ where: { id } });
      if (!existing || (user.role !== "SUPERADMIN" && existing.organizationId !== user.organizationId)) {
        return jsonError("Peserta tidak ditemukan.", 404);
      }

      // Jika Superadmin, boleh update status secara manual
      const updateStatus = user.role === "SUPERADMIN" && status ? status : existing.status;

      const updated = await db.pmeParticipant.update({
        where: { id },
        data: {
          participantCode: code,
          labName: labName.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
          contactPerson: contactPerson?.trim() || null,
          cycle: assignedCycle,
          status: updateStatus,
        },
      });

      return jsonOk({ participant: updated });
    }

    // Create new participant
    // Status awal adalah PENDING menunggu persetujuan Superadmin
    // (Kecuali jika dibuat langsung oleh Superadmin dan ditentukan disetujui)
    const initialStatus = user.role === "SUPERADMIN" && status === "APPROVED" ? "APPROVED" : "PENDING";
    const approvedAt = initialStatus === "APPROVED" ? new Date() : null;
    const approvedBy = initialStatus === "APPROVED" ? (user.name || user.email || "Superadmin") : null;

    const created = await db.pmeParticipant.create({
      data: {
        organizationId: orgId,
        participantCode: code,
        labName: labName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        cycle: assignedCycle,
        status: initialStatus,
        approvedAt,
        approvedBy,
      },
    });

    return jsonOk({ participant: created });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Hanya Superadmin yang dapat menyetujui atau menolak pendaftaran peserta PME.", 403, "FORBIDDEN");
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id) return jsonError("ID peserta diperlukan.", 400);

    const existing = await db.pmeParticipant.findUnique({ where: { id } });
    if (!existing) return jsonError("Peserta tidak ditemukan.", 404);

    let newStatus = "PENDING";
    let approvedAt: Date | null = null;
    let approvedBy: string | null = null;

    if (action === "approve") {
      newStatus = "APPROVED";
      approvedAt = new Date();
      approvedBy = user.name || user.email || "Superadmin";
    } else if (action === "reject") {
      newStatus = "REJECTED";
      approvedAt = null;
      approvedBy = user.name || user.email || "Superadmin";
    } else if (action === "pending") {
      newStatus = "PENDING";
      approvedAt = null;
      approvedBy = null;
    } else {
      return jsonError("Aksi tidak valid (approve | reject | pending).", 400);
    }

    const updated = await db.pmeParticipant.update({
      where: { id },
      data: {
        status: newStatus,
        approvedAt,
        approvedBy,
      },
    });

    return jsonOk({ participant: updated, message: `Status peserta berhasil diubah menjadi ${newStatus}.` });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak.", 403, "FORBIDDEN");
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return jsonError("ID peserta diperlukan.", 400);

    const existing = await db.pmeParticipant.findUnique({ where: { id } });
    if (!existing || (user.role !== "SUPERADMIN" && existing.organizationId !== user.organizationId)) {
      return jsonError("Peserta tidak ditemukan.", 404);
    }

    await db.pmeParticipant.delete({ where: { id } });
    return jsonOk({ success: true, id });
  });
}
