import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { deleteSessionStorage } from "@/lib/storage";
import { deletePdfFromDrive } from "@/services/storage/google-drive";
import { isProcessing } from "@/services/pme/processor";

/** GET /api/pme/:id — session detail with results + AI analyses. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const effectiveOrgId = getEffectiveOrgId(user, req);
    const orgFilter = effectiveOrgId === "ALL" ? {} : { organizationId: effectiveOrgId };

    const session = await db.pmeSession.findFirst({
      where: { id, ...orgFilter },
      include: {
        file: true,
        results: {
          include: { aiAnalysis: true },
          orderBy: [{ validationStatus: "desc" }, { parameterName: "asc" }],
        },
        _count: { select: { capaActions: true } },
      },
    });
    if (!session) return jsonError("Sesi PME tidak ditemukan.", 404, "NOT_FOUND");

    return NextResponse.json({
      session: {
        id: session.id,
        provider: session.provider,
        program: session.program,
        cycle: session.cycle,
        period: session.period,
        participantId: session.participantId,
        laboratoryName: session.laboratoryName,
        status: session.status,
        statusDetail: session.statusDetail,
        errorMessage: session.errorMessage,
        errorCode: session.errorCode,
        ruleVersion: session.ruleVersion,
        aiProvider: session.aiProvider,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        file: session.file
          ? {
              id: session.file.id,
              fileName: session.file.fileName,
              sizeBytes: session.file.sizeBytes,
              pageCount: session.file.pageCount,
              pdfClass: session.file.pdfClass,
              driveFileId: session.file.driveFileId,
              driveViewUrl: session.file.driveViewUrl,
              driveDownloadUrl: session.file.driveDownloadUrl,
            }
          : null,
        capaCount: session._count.capaActions,
        processing: isProcessing(session.id),
      },
      results: session.results.map((r) => ({
        id: r.id,
        parameterName: r.parameterName,
        participantValue: r.participantValue,
        targetValue: r.targetValue,
        sdpa: r.sdpa,
        zScore: r.zScore,
        unit: r.unit,
        method: r.method,
        instrument: r.instrument,
        peerGroup: r.peerGroup,
        providerRemark: r.providerRemark,
        allParticipantsCount: r.allParticipantsCount,
        allParticipantsTarget: r.allParticipantsTarget,
        allParticipantsSdpa: r.allParticipantsSdpa,
        allParticipantsZScore: r.allParticipantsZScore,
        allParticipantsStatus: r.allParticipantsStatus,
        methodCount: r.methodCount,
        methodTarget: r.methodTarget,
        methodSdpa: r.methodSdpa,
        methodZScore: r.methodZScore,
        methodStatus: r.methodStatus,
        instrumentCount: r.instrumentCount,
        instrumentTarget: r.instrumentTarget,
        instrumentSdpa: r.instrumentSdpa,
        instrumentZScore: r.instrumentZScore,
        instrumentStatus: r.instrumentStatus,
        parameterConfidence: r.parameterConfidence,
        participantConfidence: r.participantConfidence,
        targetConfidence: r.targetConfidence,
        zScoreConfidence: r.zScoreConfidence,
        sourcePage: r.sourcePage,
        sourceText: r.sourceText,
        sourceBbox: r.sourceBbox ? JSON.parse(r.sourceBbox) : null,
        validationStatus: r.validationStatus,
        analysisStatus: r.analysisStatus,
        reviewStatus: r.reviewStatus,
        issues: JSON.parse(r.issues || "[]"),
        zStatus: r.zStatus,
        aiAnalysis: r.aiAnalysis
          ? {
              interpretation: r.aiAnalysis.interpretation,
              possibleCauses: JSON.parse(r.aiAnalysis.possibleCauses || "[]"),
              investigationSteps: JSON.parse(r.aiAnalysis.investigationSteps || "[]"),
              correctiveActions: JSON.parse(r.aiAnalysis.correctiveActions || "[]"),
              preventiveActions: JSON.parse(r.aiAnalysis.preventiveActions || "[]"),
              instrumentEvaluation: r.aiAnalysis.instrumentEvaluation,
              methodEvaluation: r.aiAnalysis.methodEvaluation,
              biasAnalysis: r.aiAnalysis.biasAnalysis,
              provider: r.aiAnalysis.provider,
              model: r.aiAnalysis.model,
              promptVersion: r.aiAnalysis.promptVersion,
              createdAt: r.aiAnalysis.createdAt,
            }
          : null,
      })),
    });
  });
}

/** DELETE /api/pme/:id — tenant-scoped delete (admin or superadmin). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
      return jsonError("Hanya Administrator dapat menghapus sesi.", 403, "FORBIDDEN");
    }
    const { id } = await params;
    const effectiveOrgId = getEffectiveOrgId(user, req);
    const orgFilter = effectiveOrgId === "ALL" ? {} : { organizationId: effectiveOrgId };

    const session = await db.pmeSession.findFirst({
      where: {
        id,
        ...orgFilter,
      },
      include: { file: true },
    });
    if (!session) return jsonError("Sesi PME tidak ditemukan.", 404, "NOT_FOUND");
    if (isProcessing(id)) return jsonError("Sesi sedang diproses. Coba lagi nanti.", 409, "PROCESSING");

    // Hapus berkas dari Google Drive jika ada
    if (session.file?.driveFileId) {
      try {
        await deletePdfFromDrive(session.file.driveFileId);
      } catch (err) {
        console.error("[api-delete-session] Gagal menghapus berkas dari Google Drive:", err);
      }
    }

    await db.pmeSession.delete({ where: { id } });
    await deleteSessionStorage(session.organizationId, id);
    await writeAudit({
      organizationId: session.organizationId,
      userId: user.id,
      action: "DELETE_SESSION",
      entityType: "PmeSession",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  });
}
