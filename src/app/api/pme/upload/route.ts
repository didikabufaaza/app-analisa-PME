import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit, jsonError } from "@/lib/api-helpers";
import { savePmePdf } from "@/lib/storage";
import { uploadPdfToDrive } from "@/services/storage/google-drive";
import { validateUploadMeta, validatePdfBuffer } from "@/services/pme/pdf-processor";
import { enqueueSession } from "@/services/pme/processor";

/** POST /api/pme/upload — upload a PME PDF, create session, enqueue processing. */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || !(file instanceof File)) {
      return jsonError("Hanya file PDF yang diperbolehkan untuk diunggah.", 400, "NO_FILE");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validasi ketat khusus format PDF (ekstensi, mime type, dan magic header)
    const metaCheck = validateUploadMeta({
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      sizeBytes: buffer.length,
    });
    if (!metaCheck.ok) return jsonError(metaCheck.error!, 400, metaCheck.code);

    const pdfCheck = await validatePdfBuffer(buffer);
    if (!pdfCheck.ok) return jsonError(pdfCheck.error!, 400, pdfCheck.code);

    const session = await db.pmeSession.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.id,
        status: "UPLOADED",
        statusDetail: "File diunggah, menyimpan ke Google Drive & menunggu pemrosesan AI...",
        file: {
          create: {
            fileName: file.name.slice(0, 255),
            filePath: "",
            mimeType: "application/pdf",
            sizeBytes: buffer.length,
            pageCount: pdfCheck.pageCount ?? null,
          },
        },
      },
      include: { file: true },
    });

    // 1. Simpan salinan lokal
    const filePath = await savePmePdf(buffer, user.organizationId, session.id);

    // 2. Simpan file ke Google Drive (Target Folder: 1pwCYPhj9MNQYK-TWmDQ4zbGi1CTZYXa2)
    const driveResult = await uploadPdfToDrive(buffer, file.name);

    await db.pmeFile.update({
      where: { id: session.file!.id },
      data: {
        filePath,
        driveFileId: driveResult.fileId,
        driveViewUrl: driveResult.driveViewUrl,
        driveDownloadUrl: driveResult.driveDownloadUrl,
      },
    });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "UPLOAD",
      entityType: "PmeSession",
      entityId: session.id,
      details: {
        fileName: file.name,
        sizeBytes: buffer.length,
        pageCount: pdfCheck.pageCount,
        driveFileId: driveResult.fileId,
        driveSource: driveResult.source,
      },
    });

    // Enqueue pipeline pemrosesan AI
    enqueueSession(session.id, user.organizationId, user.id);

    return NextResponse.json(
      {
        session: {
          id: session.id,
          status: session.status,
          driveFileId: driveResult.fileId,
          driveViewUrl: driveResult.driveViewUrl,
        },
      },
      { status: 201 }
    );
  });
}
