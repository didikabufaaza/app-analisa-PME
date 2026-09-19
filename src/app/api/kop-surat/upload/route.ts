import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { uploadImageToDrive } from "@/services/storage/google-drive";

/**
 * POST /api/kop-surat/upload
 * Endpoint untuk mengunggah gambar logo KOP Surat (kiri / kanan) ke Google Drive
 * dan menyimpannya di konfigurasi KOP Surat organisasi.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const type = (formData.get("type") as string) || "kiri"; // "kiri" | "kanan"

      if (!file) {
        return jsonError("Berkas gambar logo wajib diunggah.", 400);
      }

      if (!file.type.startsWith("image/")) {
        return jsonError("Format berkas harus berupa gambar (PNG, JPG, JPEG, WebP, SVG).", 400);
      }

      // Batasi ukuran logo maksimal 5MB
      if (file.size > 5 * 1024 * 1024) {
        return jsonError("Ukuran logo maksimal 5 MB.", 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "png";
      const fileName = `kop_logo_${type}_${Date.now()}.${ext}`;

      // 1. Unggah ke Google Drive di folder PME
      const driveResult = await uploadImageToDrive(buffer, fileName, file.type);

      // 2. Buat data URI base64 agar dapat digambar langsung di jsPDF & HTML tanpa kendala CORS
      const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

      // 3. Simpan ke database kopSurat
      const updateData: Record<string, string> = {};
      if (type === "kiri") {
        updateData.logoKiri = dataUrl;
      } else {
        updateData.logoKanan = dataUrl;
      }

      const saved = await db.kopSurat.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          pemda: "Kementerian Kesehatan Republik Indonesia",
          namaRumahSakit: "Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)",
          alamatRumahSakit: "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang",
          kontakRumahSakit: "Telp: (0711) 352 683 | Email: bblabkesmaspalembang@kemkes.go.id",
          ...updateData,
        },
        update: updateData,
      });

      return jsonOk({
        success: true,
        type,
        logoUrl: dataUrl,
        driveFileId: driveResult.fileId,
        driveViewUrl: driveResult.driveViewUrl,
        kopSurat: saved,
        message: `Logo surat ${type} berhasil diunggah ke Google Drive dan disimpan.`,
      });
    } catch (err) {
      console.error("[KopSuratUpload] Error:", err);
      return jsonError("Terjadi kesalahan saat mengunggah logo ke Google Drive.", 500);
    }
  });
}
