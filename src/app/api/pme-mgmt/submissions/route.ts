import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

function canAccessPmeMgmt(user: { role: string; menuAccess?: string | null }) {
  if (user.role === "SUPERADMIN") return true;
  if (user.menuAccess) {
    try {
      const allowed: string[] = JSON.parse(user.menuAccess);
      if (allowed.includes("pme-management") || allowed.includes("pme-input")) return true;
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
    const orgFilter = effectiveOrgId === "ALL" ? {} : { organizationId: effectiveOrgId };
    const participantId = req.nextUrl.searchParams.get("participantId");
    const cycle = req.nextUrl.searchParams.get("cycle");

    if (!participantId) {
      // Jika tanpa participantId, kembalikan daftar semua submission untuk list view
      const submissions = await db.pmeSubmission.findMany({
        where: {
          ...orgFilter,
          ...(cycle ? { cycle: cycle.trim() } : {}),
        },
        include: {
          participant: true,
          results: true,
        },
        orderBy: { submittedAt: "desc" },
      });
      return jsonOk({ submissions });
    }

    // Ambil data peserta
    const participant = await db.pmeParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant || (user.role !== "SUPERADMIN" && participant.organizationId !== user.organizationId)) {
      return jsonError("Peserta tidak ditemukan.", 404);
    }

    // Validasi: Status persetujuan Superadmin
    if (participant.status !== "APPROVED") {
      return jsonOk({
        participant,
        cycle,
        isApproved: false,
        participantStatus: participant.status,
        registeredPackages: [],
        parameters: [],
        submission: null,
        message: `Pendaftaran laboratorium ${participant.labName} berstatus "${participant.status === "REJECTED" ? "Ditolak" : "Menunggu Persetujuan Superadmin"}". Pengisian hasil PME hanya dapat dilakukan setelah pendaftaran disetujui oleh Superadmin.`,
      });
    }

    // Ambil paket yang dipilih oleh peserta pada siklus ini
    const registrations = await db.pmePackageRegistration.findMany({
      where: {
        participantId,
        ...(cycle ? { cycle: cycle.trim() } : {}),
      },
      include: {
        package: {
          include: {
            parameters: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (registrations.length === 0) {
      return jsonOk({
        participant,
        cycle,
        registeredPackages: [],
        parameters: [],
        submission: null,
        message: "Peserta belum memilih paket PME pada siklus ini. Silakan pilih paket terlebih dahulu di menu Pemilihan Paket PME.",
      });
    }

    // Kumpulkan semua parameter unik dari paket-paket yang telah dipilih
    const paramMap = new Map<string, {
      id: string;
      name: string;
      unit: string | null;
      packageName: string;
      defaultMethodCode: string | null;
      defaultInstrumentCode: string | null;
      sortOrder: number;
    }>();

    for (const reg of registrations) {
      for (const p of reg.package.parameters) {
        if (!paramMap.has(p.name.toLowerCase().trim())) {
          paramMap.set(p.name.toLowerCase().trim(), {
            id: p.id,
            name: p.name,
            unit: p.unit,
            packageName: reg.package.name,
            defaultMethodCode: p.defaultMethodCode,
            defaultInstrumentCode: p.defaultInstrumentCode,
            sortOrder: p.sortOrder,
          });
        }
      }
    }

    const parameters = Array.from(paramMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

    // Ambil data submission yang sudah pernah disimpan sebelumnya (jika ada)
    const existingSubmission = await db.pmeSubmission.findFirst({
      where: {
        participantId,
        ...(cycle ? { cycle: cycle.trim() } : {}),
      },
      include: {
        results: true,
      },
      orderBy: { submittedAt: "desc" },
    });

    return jsonOk({
      participant,
      cycle,
      registeredPackages: registrations.map((r) => ({
        id: r.package.id,
        name: r.package.name,
        code: r.package.code,
        category: r.package.category,
      })),
      parameters,
      submission: existingSubmission,
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (!canAccessPmeMgmt(user)) {
      return jsonError("Akses ditolak.", 403, "FORBIDDEN");
    }

    const orgId = getEffectiveOrgId(user, req) === "ALL" ? user.organizationId : getEffectiveOrgId(user, req);
    const body = await req.json();

    const { participantId, cycle, period, results } = body;

    if (!participantId) {
      return jsonError("Peserta wajib ditentukan.", 400);
    }
    if (!cycle || !cycle.trim()) {
      return jsonError("Siklus PME wajib diisi.", 400);
    }
    if (!Array.isArray(results) || results.length === 0) {
      return jsonError("Data hasil pemeriksaan belum diisi.", 400);
    }

    const participant = await db.pmeParticipant.findUnique({ where: { id: participantId } });
    if (!participant || (user.role !== "SUPERADMIN" && participant.organizationId !== user.organizationId)) {
      return jsonError("Peserta tidak ditemukan.", 404);
    }

    if (participant.status !== "APPROVED") {
      return jsonError(
        "Pendaftaran laboratorium peserta belum disetujui oleh Superadmin. Pengiriman hasil PME hanya dapat dilakukan setelah pendaftaran disetujui.",
        403,
        "NOT_APPROVED"
      );
    }

    // Cari atau buat submission
    let submission = await db.pmeSubmission.findFirst({
      where: {
        participantId,
        cycle: cycle.trim(),
      },
    });

    if (submission) {
      // Update submission metadata
      submission = await db.pmeSubmission.update({
        where: { id: submission.id },
        data: {
          period: period?.trim() || submission.period,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });

      // Hapus hasil lama untuk di-replace dengan yang baru dikirim
      await db.pmeSubmissionResult.deleteMany({
        where: { submissionId: submission.id },
      });
    } else {
      submission = await db.pmeSubmission.create({
        data: {
          organizationId: participant.organizationId,
          participantId,
          cycle: cycle.trim(),
          period: period?.trim() || null,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    }

    // Simpan rincian hasil per parameter
    let savedCount = 0;
    for (const r of results) {
      if (r.parameterName && (r.value !== null && r.value !== undefined && r.value !== "")) {
        const numVal = parseFloat(String(r.value).replace(/,/g, "."));
        if (!isNaN(numVal)) {
          await db.pmeSubmissionResult.create({
            data: {
              submissionId: submission.id,
              parameterId: r.parameterId || null,
              parameterName: r.parameterName.trim(),
              unit: r.unit?.trim() || null,
              value: numVal,
              methodCode: r.methodCode?.trim() || null,
              methodName: r.methodName?.trim() || null,
              instrumentCode: r.instrumentCode?.trim() || null,
              instrumentName: r.instrumentName?.trim() || null,
              reagentName: r.reagentName?.trim() || null,
            },
          });
          savedCount++;
        }
      }
    }

    return jsonOk({
      success: true,
      submissionId: submission.id,
      savedCount,
      message: `Hasil PME ${participant.labName} untuk ${cycle} berhasil dikirim (${savedCount} parameter tercatat).`,
    });
  });
}
