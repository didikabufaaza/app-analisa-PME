import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

const DEFAULT_CONFIG = {
  activeCycle: "Siklus 1 2026",
  activePeriod: "Tahap 1",
  infoTitle: "Informasi Resmi Pelaksanaan Program PME",
  infoContent:
    "Selamat datang di Program Pemantapan Mutu Eksternal (PME). Mohon seluruh laboratorium peserta memastikan pendaftaran, pemilihan paket pemeriksaan, serta pengisian hasil pengujian dilakukan secara teliti sebelum batas akhir yang ditentukan. Pastikan sampel kontrol diperlakukan sama seperti sampel pasien rutin sesuai SOP laboratorium.",
  runningText:
    "Selamat datang di Sistem Aplikasi di-dismartPME. Program Pemantapan Mutu Eksternal (PME) Siklus 1 2026 telah dibuka. Silakan masuk dengan akun laboratorium Anda untuk melakukan pendaftaran peserta, pemilihan paket, dan pengisian hasil pemeriksaan.",
};

/**
 * GET /api/pme-mgmt/config
 * Mengambil konfigurasi siklus aktif, periode/tahap, pengumuman PME, dan teks berjalan (running text).
 * Dapat diakses oleh pengguna terautentikasi maupun publik di halaman login (tanpa auth).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    let orgId = user ? getEffectiveOrgId(user, req) : undefined;
    if (orgId === "ALL") {
      orgId = user?.organizationId;
    }

    let config = null;
    if (orgId) {
      config = await db.pmeCycleConfig.findUnique({
        where: { organizationId: orgId },
      });
    }

    if (!config) {
      config = await db.pmeCycleConfig.findFirst();
    }

    return jsonOk({
      config: config || {
        ...DEFAULT_CONFIG,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: "Superadmin",
      },
    });
  } catch (err) {
    return jsonOk({
      config: {
        ...DEFAULT_CONFIG,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: "Superadmin",
      },
    });
  }
}

/**
 * POST /api/pme-mgmt/config
 * Menyimpan / memperbarui konfigurasi siklus aktif, periode/tahap, pengumuman PME, dan running text (Khusus Superadmin).
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
    const { activeCycle, activePeriod, infoTitle, infoContent, runningText } = body;

    if (!activeCycle || typeof activeCycle !== "string" || !activeCycle.trim()) {
      return jsonError("Siklus PME wajib diisi.", 400, "BAD_REQUEST");
    }

    const cycleVal = activeCycle.trim();
    const periodVal = activePeriod?.trim() || "Tahap 1";
    const titleVal = infoTitle?.trim() || DEFAULT_CONFIG.infoTitle;
    const contentVal = infoContent?.trim() || DEFAULT_CONFIG.infoContent;
    const runningVal = runningText?.trim() || DEFAULT_CONFIG.runningText;

    const saved = await db.pmeCycleConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        activeCycle: cycleVal,
        activePeriod: periodVal,
        infoTitle: titleVal,
        infoContent: contentVal,
        runningText: runningVal,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: user.name || "Superadmin",
      },
      update: {
        activeCycle: cycleVal,
        activePeriod: periodVal,
        infoTitle: titleVal,
        infoContent: contentVal,
        runningText: runningVal,
        infoUpdatedAt: new Date(),
        infoUpdatedBy: user.name || "Superadmin",
      },
    });

    return jsonOk({
      success: true,
      config: saved,
      message: "Konfigurasi Siklus, Periode, Informasi PME, dan Running Text berhasil disimpan.",
    });
  });
}
