import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit, jsonError } from "@/lib/api-helpers";
import { savePmePdf } from "@/lib/storage";
import { uploadPdfToDrive } from "@/services/storage/google-drive";
import { validateUploadMeta, validatePdfBuffer } from "@/services/pme/pdf-processor";
import { enqueueSession, pump } from "@/services/pme/processor";

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

    // 1. Buat sesi di basis data secara cepat
    const session = await db.pmeSession.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.id,
        status: "UPLOADED",
        statusDetail: "File diunggah, memproses dokumen dan sinkronisasi data...",
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

    // 2. Simpan salinan lokal langsung (< 5ms)
    const filePath = await savePmePdf(buffer, user.organizationId, session.id);
    await db.pmeFile.update({
      where: { id: session.file!.id },
      data: { filePath },
    });

    // 3. Catat audit
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
      },
    });

    // 4. Masukkan ke antrean pemrosesan
    enqueueSession(session.id, user.organizationId, user.id);

    // 5. Jalankan sinkronisasi Google Drive dan kelangsungan pemrosesan di background via after()
    // Ini memastikan respon HTTP 201 kembali dalam ~150ms tanpa tertahan latensi Google Drive
    after(async () => {
      const drivePromise = (async () => {
        try {
          const driveResult = await uploadPdfToDrive(buffer, file.name);
          if (driveResult.fileId) {
            await db.pmeFile.update({
              where: { id: session.file!.id },
              data: {
                driveFileId: driveResult.fileId,
                driveViewUrl: driveResult.driveViewUrl,
                driveDownloadUrl: driveResult.driveDownloadUrl,
              },
            });
            console.log(`[Upload] Google Drive sinkronisasi selesai untuk sesi ${session.id}: ${driveResult.fileId}`);
          }
        } catch (err) {
          console.error("[Upload] Gagal mengunggah berkas ke Google Drive di background:", err);
        }
      })();

      const pumpPromise = (async () => {
        try {
          await pump();
        } catch (err) {
          console.error("[Upload] Background pump pemrosesan galat:", err);
        }
      })();

      await Promise.allSettled([drivePromise, pumpPromise]);
    });

    return NextResponse.json(
      {
        session: {
          id: session.id,
          status: session.status,
        },
      },
      { status: 201 }
    );
  });
}
