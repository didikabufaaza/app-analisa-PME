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

function canResubmitPme(user: { role: string; menuAccess?: string | null }) {
  if (user.role === "SUPERADMIN") return true;
  if (user.menuAccess) {
    try {
      const allowed: string[] = JSON.parse(user.menuAccess);
      if (allowed.includes("pme-resubmit")) return true;
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
        canEdit: false,
        isLocked: false,
        allowResubmit: false,
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
        canEdit: true,
        isLocked: false,
        allowResubmit: false,
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

    const isSuper = user.role === "SUPERADMIN";
    const hasResubmitPermission = canResubmitPme(user);

    const isDraft = existingSubmission?.status === "DRAFT";
    const isSubmitted = Boolean(existingSubmission && existingSubmission.status !== "DRAFT");
    const isLocked = existingSubmission?.isLocked ?? false;
    const isAllowedBySubmission = existingSubmission?.allowResubmit ?? false;
    const isAllowedByParticipant = participant.allowResubmit ?? false;

    // Ambil konfigurasi batas waktu PME
    const cycleConfig =
      (await db.pmeCycleConfig.findUnique({ where: { organizationId: participant.organizationId } })) ||
      (await db.pmeCycleConfig.findFirst());
    const effectiveDeadline = participant.customDeadline || cycleConfig?.submissionDeadline || null;
    const isSubmissionOpen = cycleConfig?.isSubmissionOpen ?? true;
    const isExpired = Boolean(
      effectiveDeadline && new Date() > new Date(effectiveDeadline) && !participant.allowExpiredInput
    );

    // canEdit bernilai true jika:
    // 1. Belum pernah submit (atau baru berstatus draft)
    // 2. Pengguna adalah Superadmin
    // 3. Pengguna memiliki izin khusus "pme-resubmit"
    // 4. Superadmin telah membuka kunci pada submission ini (allowResubmit === true)
    // 5. Superadmin telah membuka kunci pada laboratorium peserta ini (participant.allowResubmit === true)
    // Dan waktu pengisian belum expired (kecuali superadmin atau allowExpiredInput)
    const canEditDueToSubmission =
      !isSubmitted ||
      isSuper ||
      hasResubmitPermission ||
      isAllowedBySubmission ||
      isAllowedByParticipant ||
      !isLocked;

    const canEdit = isSuper ? true : canEditDueToSubmission && isSubmissionOpen && !isExpired;

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
      isDraft,
      isSubmitted,
      canEdit,
      isLocked: isSubmitted ? isLocked : false,
      allowResubmit: isAllowedBySubmission || isAllowedByParticipant,
      hasResubmitPermission,
      deadlineInfo: {
        submissionDeadline: cycleConfig?.submissionDeadline || null,
        customDeadline: participant.customDeadline || null,
        effectiveDeadline,
        isSubmissionOpen,
        allowExpiredInput: participant.allowExpiredInput,
        isExpired,
      },
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

    const { participantId, cycle, period, results, isDraft, action } = body;
    const savingDraft = Boolean(isDraft || action === "SAVE_DRAFT");

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
        "Pendaftaran laboratorium peserta belum disetujui oleh Superadmin. Pengisian hasil PME hanya dapat dilakukan setelah pendaftaran disetujui.",
        403,
        "NOT_APPROVED"
      );
    }

    const isSuper = user.role === "SUPERADMIN";
    const hasResubmitPermission = canResubmitPme(user);

    // Validasi Batas Waktu Pengisian (Deadline Check) jika bukan Superadmin
    if (!isSuper) {
      const cycleConfig =
        (await db.pmeCycleConfig.findUnique({ where: { organizationId: participant.organizationId } })) ||
        (await db.pmeCycleConfig.findFirst());

      if (cycleConfig && !cycleConfig.isSubmissionOpen && !participant.allowExpiredInput) {
        return jsonError("Pengisian hasil PME saat ini sedang dinonaktifkan oleh Superadmin.", 403, "SUBMISSION_CLOSED");
      }

      const effectiveDeadline = participant.customDeadline || cycleConfig?.submissionDeadline;
      if (effectiveDeadline && new Date() > new Date(effectiveDeadline) && !participant.allowExpiredInput) {
        return jsonError(
          `Batas waktu pengisian hasil PME untuk siklus ini telah berakhir pada ${new Date(
            effectiveDeadline
          ).toLocaleString("id-ID")}. Hubungi Superadmin untuk mengajukan perpanjangan batas waktu pengisian.`,
          403,
          "DEADLINE_EXPIRED"
        );
      }
    }

    // Cari submission yang sudah ada
    let submission = await db.pmeSubmission.findFirst({
      where: {
        participantId,
        cycle: cycle.trim(),
      },
    });

    if (submission) {
      // Jika submission sebelumnya berstatus DRAFT, user bebas menyimpan/mengedit kembali
      const wasDraft = submission.status === "DRAFT";

      if (!wasDraft) {
        // Validasi izin pengeditan ulang jika sebelumnya sudah SUBMITTED
        const isAllowed =
          isSuper ||
          hasResubmitPermission ||
          submission.allowResubmit ||
          participant.allowResubmit ||
          !submission.isLocked;

        if (!isAllowed) {
          return jsonError(
            "Hasil PME untuk siklus ini telah dikirim dan terkunci. Pengeditan ulang hanya dapat dibuka atas izin Superadmin.",
            403,
            "SUBMISSION_LOCKED"
          );
        }
      }

      // Update submission metadata
      const nextStatus = savingDraft ? "DRAFT" : "SUBMITTED";
      const nextLocked = savingDraft ? false : true;

      submission = await db.pmeSubmission.update({
        where: { id: submission.id },
        data: {
          period: period?.trim() || submission.period,
          status: nextStatus,
          isLocked: nextLocked,
          // Kunci kembali setelah berhasil kirim final
          allowResubmit: savingDraft ? submission.allowResubmit : false,
          allowReenroll: savingDraft ? submission.allowReenroll : false,
          submittedAt: savingDraft ? submission.submittedAt : new Date(),
        },
      });

      if (!savingDraft && (participant.allowResubmit || participant.allowReenroll)) {
        await db.pmeParticipant.update({
          where: { id: participant.id },
          data: { allowResubmit: false, allowReenroll: false },
        });
      }

      // Hapus hasil lama untuk di-replace dengan yang baru
      await db.pmeSubmissionResult.deleteMany({
        where: { submissionId: submission.id },
      });
    } else {
      const nextStatus = savingDraft ? "DRAFT" : "SUBMITTED";
      const nextLocked = savingDraft ? false : true;

      submission = await db.pmeSubmission.create({
        data: {
          organizationId: participant.organizationId,
          participantId,
          cycle: cycle.trim(),
          period: period?.trim() || null,
          status: nextStatus,
          isLocked: nextLocked,
          allowResubmit: false,
          allowReenroll: false,
          submittedAt: savingDraft ? null : new Date(),
        },
      });

      if (!savingDraft && participant.allowReenroll) {
        await db.pmeParticipant.update({
          where: { id: participant.id },
          data: { allowReenroll: false },
        });
      }
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
      isLocked: savingDraft ? false : true,
      isDraft: savingDraft,
      message: savingDraft
        ? `Draft hasil PME ${participant.labName} untuk ${cycle} berhasil disimpan (${savedCount} parameter tercatat). Formulir tetap dapat diedit sebelum dikirimkan secara final.`
        : `Hasil PME ${participant.labName} untuk ${cycle} berhasil dikirim (${savedCount} parameter tercatat). Formulir kini terkunci secara otomatis.`,
    });
  });
}

/**
 * PATCH /api/pme-mgmt/submissions
 * Mengatur status buka/tutup kunci hasil PME oleh Superadmin.
 */
export async function PATCH(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Hanya Superadmin yang berhak mengatur status penguncian input hasil PME.", 403, "FORBIDDEN");
    }

    const body = await req.json().catch(() => ({}));
    const { action, submissionId, participantId, cycle } = body;

    if (action === "UNLOCK_SUBMISSION") {
      if (submissionId) {
        const sub = await db.pmeSubmission.update({
          where: { id: submissionId },
          data: { allowResubmit: true, isLocked: false },
          include: { participant: true },
        });
        return jsonOk({
          success: true,
          message: `Kunci input hasil PME untuk ${sub.participant.labName} (${sub.cycle}) berhasil dibuka. Peserta kini dapat mengedit dan mengirim ulang hasil.`,
          submission: sub,
        });
      } else if (participantId) {
        await db.pmeParticipant.update({
          where: { id: participantId },
          data: { allowResubmit: true },
        });
        if (cycle) {
          await db.pmeSubmission.updateMany({
            where: { participantId, cycle: cycle.trim() },
            data: { allowResubmit: true, isLocked: false },
          });
        }
        return jsonOk({
          success: true,
          message: "Kunci input hasil PME berhasil dibuka. Peserta dapat mengedit hasil kembali.",
        });
      }
      return jsonError("submissionId atau participantId wajib ditentukan.", 400);
    }

    if (action === "LOCK_SUBMISSION") {
      if (submissionId) {
        const sub = await db.pmeSubmission.update({
          where: { id: submissionId },
          data: { allowResubmit: false, isLocked: true },
          include: { participant: true },
        });
        return jsonOk({
          success: true,
          message: `Input hasil PME untuk ${sub.participant.labName} (${sub.cycle}) berhasil dikunci kembali.`,
          submission: sub,
        });
      } else if (participantId) {
        await db.pmeParticipant.update({
          where: { id: participantId },
          data: { allowResubmit: false },
        });
        if (cycle) {
          await db.pmeSubmission.updateMany({
            where: { participantId, cycle: cycle.trim() },
            data: { allowResubmit: false, isLocked: true },
          });
        }
        return jsonOk({
          success: true,
          message: "Input hasil PME berhasil dikunci kembali.",
        });
      }
      return jsonError("submissionId atau participantId wajib ditentukan.", 400);
    }

    return jsonError("Aksi tidak dikenali.", 400);
  });
}
