import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

const DEFAULT_CONFIG = {
  activeCycle: "Siklus 1 2026",
  activePeriod: "Tahap 1",
  infoTitle: "Informasi Resmi Pelaksanaan Program PME",
  infoContent:
    "Selamat datang di Program Pemantapan Mutu Eksternal (PME). Mohon seluruh laboratorium peserta memastikan pendaftaran, pemilihan paket pemeriksaan, serta pengisian hasil pengujian dilakukan secara teliti sebelum batas akhir yang ditentukan. Pastikan sampel kontrol diperlakukan sama seperti sampel pasien rutin sesuai SOP laboratorium.",
};

/**
 * GET /api/pme-mgmt/config
 * Mengambil konfigurasi siklus aktif, periode/tahap, dan pengumuman informasi PME.
 * Dapat diakses oleh semua pengguna terautentikasi (Peserta & Superadmin).
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    let config = await db.pmeCycleConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      config = await db.pmeCycleConfig.findFirst();
    }

    return jsonOk({
      config: config || {
        organizationId: orgId,
        ...DEFAULT_CONFIG,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: "Superadmin",
      },
    });
  });
}

/**
 * POST /api/pme-mgmt/config
 * Menyimpan / memperbarui konfigurasi siklus aktif, periode/tahap, dan pengumuman PME (Khusus Superadmin).
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError(
        "Hanya Superadmin yang memiliki hak akses untuk mengubah konfigurasi siklus dan informasi PME.",
        403,
        "FORBIDDEN"
      );
    }

    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    const body = await req.json().catch(() => ({}));
    const { activeCycle, activePeriod, infoTitle, infoContent } = body;

    if (!activeCycle || typeof activeCycle !== "string" || !activeCycle.trim()) {
      return jsonError("Siklus PME wajib diisi.", 400, "BAD_REQUEST");
    }

    const cycleVal = activeCycle.trim();
    const periodVal = activePeriod?.trim() || "Tahap 1";
    const titleVal = infoTitle?.trim() || DEFAULT_CONFIG.infoTitle;
    const contentVal = infoContent?.trim() || DEFAULT_CONFIG.infoContent;

    const saved = await db.pmeCycleConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        activeCycle: cycleVal,
        activePeriod: periodVal,
        infoTitle: titleVal,
        infoContent: contentVal,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: user.name || "Superadmin",
      },
      update: {
        activeCycle: cycleVal,
        activePeriod: periodVal,
        infoTitle: titleVal,
        infoContent: contentVal,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: user.name || "Superadmin",
      },
    });

    return jsonOk({
      success: true,
      config: saved,
      message: "Konfigurasi Siklus, Periode, dan Informasi PME berhasil disimpan.",
    });
  });
}
