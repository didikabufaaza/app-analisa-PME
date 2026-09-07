import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, getEffectiveOrgId } from "@/lib/api-helpers";
import { readPmePdf } from "@/lib/storage";
import { downloadPdfFromDrive } from "@/services/storage/google-drive";

/**
 * GET /api/files/:fileId — serve the stored original PDF (tenant-scoped or superadmin).
 * Prioritizes downloading and serving directly from Google Drive.
 * Supports ?page=N hint for the viewer (client-side scroll handled by the browser).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { fileId } = await params;
    const effectiveOrgId = getEffectiveOrgId(user, req);

    const file = await db.pmeFile.findFirst({
      where: {
        id: fileId,
        session: effectiveOrgId && effectiveOrgId !== "ALL" ? { organizationId: effectiveOrgId } : undefined,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    }

    // 1. Baca langsung dari penyimpanan lokal (cepat < 1ms, tanpa latensi jaringan)
    if (file.filePath) {
      try {
        const buffer = await readPmePdf(file.filePath);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
            "Cache-Control": "private, max-age=3600",
            "X-Storage-Source": "Local-Fast",
          },
        });
      } catch (localErr) {
        console.warn("[FilesAPI] Berkas tidak ditemukan di penyimpanan lokal, mencoba unduh dari Google Drive:", localErr);
      }
    }

    // 2. Cadangan: unduh langsung dari Google Drive jika ada
    if (file.driveFileId) {
      try {
        const driveBuffer = await downloadPdfFromDrive(file.driveFileId);
        if (driveBuffer && driveBuffer.length > 0) {
          return new NextResponse(new Uint8Array(driveBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
              "Cache-Control": "private, max-age=1800",
              "X-Storage-Source": "Google-Drive",
            },
          });
        }
      } catch (driveErr) {
        console.warn("[FilesAPI] Gagal mengambil berkas dari Google Drive:", driveErr);
      }
    }

    return NextResponse.json({ error: "Berkas tidak dapat ditemukan di penyimpanan." }, { status: 404 });
  });
}
