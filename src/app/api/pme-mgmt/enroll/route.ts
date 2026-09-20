import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

function canAccessPmeMgmt(user: { role: string; menuAccess?: string | null }) {
  if (user.role === "SUPERADMIN") return true;
  if (user.menuAccess) {
    try {
      const allowed: string[] = JSON.parse(user.menuAccess);
      if (allowed.includes("pme-management") || allowed.includes("pme-packages")) return true;
    } catch {}
  }
  return false;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak.", 403, "FORBIDDEN");
    }

    const effectiveOrgId = getEffectiveOrgId(user, req);
    const participantId = req.nextUrl.searchParams.get("participantId");
    const cycle = req.nextUrl.searchParams.get("cycle");

    const whereClause: {
      organizationId?: string;
      participantId?: string;
      cycle?: string;
    } = {};

    if (effectiveOrgId !== "ALL") {
      whereClause.organizationId = effectiveOrgId;
    }
    if (participantId) whereClause.participantId = participantId;
    if (cycle) whereClause.cycle = cycle.trim();

    const registrations = await db.pmePackageRegistration.findMany({
      where: whereClause,
      include: {
        participant: true,
        package: {
          include: {
            parameters: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
      orderBy: { registeredAt: "desc" },
    });

    return jsonOk({ registrations });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak.", 403, "FORBIDDEN");
    }

    const orgId = getEffectiveOrgId(user, req) === "ALL" ? user.organizationId : getEffectiveOrgId(user, req);
    const body = await req.json();

    const { participantId, packageIds, cycle, period, year } = body;

    if (!participantId) {
      return jsonError("Peserta laboratorium wajib dipilih.", 400);
    }
    if (!cycle || !cycle.trim()) {
      return jsonError("Siklus PME wajib diisi (misal: Siklus 2 2025).", 400);
    }
    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      return jsonError("Minimal pilih satu paket PME.", 400);
    }

    // Pastikan participant terdaftar dalam org
    const participant = await db.pmeParticipant.findUnique({ where: { id: participantId } });
    if (!participant || (user.role !== "SUPERADMIN" && participant.organizationId !== user.organizationId)) {
      return jsonError("Data peserta tidak ditemukan.", 404);
    }

    // Validasi: Peserta harus disetujui oleh Superadmin terlebih dahulu
    if (participant.status !== "APPROVED") {
      return jsonError(
        "Pendaftaran laboratorium peserta belum disetujui oleh Superadmin. Pemilihan paket PME hanya dapat dilakukan setelah pendaftaran berstatus Disetujui.",
        403,
        "NOT_APPROVED"
      );
    }

    // Validasi: Penguncian pemilihan paket jika hasil input PME sudah pernah dikirimkan
    const existingSubmission = await db.pmeSubmission.findFirst({
      where: {
        participantId,
        cycle: cycle.trim(),
      },
    });

    const isReenrollAllowed = participant.allowReenroll || existingSubmission?.allowReenroll || false;

    if (existingSubmission && !isReenrollAllowed && user.role !== "SUPERADMIN") {
      return jsonError(
        "Laboratorium telah mengirimkan hasil input pemeriksaan PME pada siklus ini sehingga pemilihan paket PME telah dikunci. Hubungi Superadmin untuk mendapatkan izin/akses memilih paket kembali.",
        403,
        "PACKAGE_SELECTION_LOCKED"
      );
    }

    const createdRegistrations = [];

    for (const pkgId of packageIds) {
      // Cek apakah sudah terdaftar untuk siklus ini
      const existing = await db.pmePackageRegistration.findFirst({
        where: {
          participantId,
          packageId: pkgId,
          cycle: cycle.trim(),
        },
      });

      if (existing) {
        createdRegistrations.push(existing);
      } else {
        const reg = await db.pmePackageRegistration.create({
          data: {
            organizationId: participant.organizationId,
            participantId,
            packageId: pkgId,
            cycle: cycle.trim(),
            period: period?.trim() || null,
            year: Number(year) || new Date().getFullYear(),
            status: "REGISTERED",
          },
        });
        createdRegistrations.push(reg);
      }
    }

    return jsonOk({ success: true, count: createdRegistrations.length, registrations: createdRegistrations });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak.", 403, "FORBIDDEN");
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return jsonError("ID pendaftaran diperlukan.", 400);

    const existing = await db.pmePackageRegistration.findUnique({
      where: { id },
      include: { participant: true },
    });
    if (!existing || (user.role !== "SUPERADMIN" && existing.organizationId !== user.organizationId)) {
      return jsonError("Pendaftaran tidak ditemukan.", 404);
    }

    // Cek apakah hasil pemeriksaan sudah dikirimkan
    const existingSubmission = await db.pmeSubmission.findFirst({
      where: {
        participantId: existing.participantId,
        cycle: existing.cycle,
      },
    });

    const isReenrollAllowed = existing.participant?.allowReenroll || existingSubmission?.allowReenroll || false;

    if (existingSubmission && !isReenrollAllowed && user.role !== "SUPERADMIN") {
      return jsonError(
        "Paket pemeriksaan PME tidak dapat dibatalkan karena laboratorium telah mengirimkan hasil input pemeriksaan pada siklus ini. Hubungi Superadmin untuk mendapatkan izin.",
        403,
        "PACKAGE_SELECTION_LOCKED"
      );
    }

    await db.pmePackageRegistration.delete({ where: { id } });
    return jsonOk({ success: true, id });
  });
}

/**
 * PATCH /api/pme-mgmt/enroll
 * Mengatur izin akses pemilihan paket PME kembali bagi laboratorium tertentu oleh Superadmin.
 */
export async function PATCH(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Hanya Superadmin yang berhak memberikan izin pemilihan paket PME kembali.", 403, "FORBIDDEN");
    }

    const body = await req.json().catch(() => ({}));
    const { action, participantId, cycle } = body;

    if (!participantId) {
      return jsonError("participantId wajib ditentukan.", 400);
    }

    const participant = await db.pmeParticipant.findUnique({ where: { id: participantId } });
    if (!participant) {
      return jsonError("Peserta laboratorium tidak ditemukan.", 404);
    }

    const grantPermission = action === "ALLOW_REENROLL" || action === "UNLOCK_PACKAGES";

    await db.pmeParticipant.update({
      where: { id: participantId },
      data: { allowReenroll: grantPermission },
    });

    if (cycle) {
      await db.pmeSubmission.updateMany({
        where: { participantId, cycle: cycle.trim() },
        data: { allowReenroll: grantPermission },
      });
    }

    return jsonOk({
      success: true,
      allowReenroll: grantPermission,
      message: grantPermission
        ? `Izin pemilihan paket PME berhasil diberikan kepada ${participant.labName}. Laboratorium kini dapat memilih atau mengubah paket kembali.`
        : `Pemilihan paket PME untuk ${participant.labName} berhasil dikunci kembali.`,
    });
  });
}
