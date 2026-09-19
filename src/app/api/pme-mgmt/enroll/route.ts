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

    const orgId = getEffectiveOrgId(user, req) === "ALL" ? user.organizationId : getEffectiveOrgId(user, req);
    const participantId = req.nextUrl.searchParams.get("participantId");
    const cycle = req.nextUrl.searchParams.get("cycle");

    const whereClause: {
      organizationId: string;
      participantId?: string;
      cycle?: string;
    } = { organizationId: orgId };

    if (participantId) whereClause.participantId = participantId;
    if (cycle) whereClause.cycle = cycle;

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

    const createdRegistrations = [];

    for (const pkgId of packageIds) {
      // Cek apakah sudah terdaftar untuk siklus ini
      const existing = await db.pmePackageRegistration.findFirst({
        where: {
          organizationId: orgId,
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
            organizationId: orgId,
            participantId,
            packageId: pkgId,
            cycle: cycle.trim(),
            period: period?.trim() || null,
            year: Number(year) || 2025,
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

    const existing = await db.pmePackageRegistration.findUnique({ where: { id } });
    if (!existing || (user.role !== "SUPERADMIN" && existing.organizationId !== user.organizationId)) {
      return jsonError("Pendaftaran tidak ditemukan.", 404);
    }

    await db.pmePackageRegistration.delete({ where: { id } });
    return jsonOk({ success: true, id });
  });
}
