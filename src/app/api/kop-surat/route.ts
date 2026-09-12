import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";

/**
 * GET /api/kop-surat
 * Mengambil data Kop Surat milik tenant/organisasi aktif secara privat.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    const [organization, kopSurat] = await Promise.all([
      db.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      }),
      db.kopSurat.findUnique({
        where: { organizationId: orgId },
      }),
    ]);

    if (!organization) {
      return jsonError("Organisasi tidak ditemukan", 404, "NOT_FOUND");
    }

    return jsonOk({
      organization,
      kopSurat: kopSurat || {
        logoKiri: null,
        logoKanan: null,
        pemda: "",
        namaRumahSakit: organization.name || "",
        alamatRumahSakit: "",
        kontakRumahSakit: "",
      },
    });
  });
}

/**
 * POST /api/kop-surat
 * Menyimpan / memperbarui data Kop Surat (logo kanan & kiri, 4 kolom identitas RS/Lab) milik tenant aktif.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    const body = await req.json().catch(() => ({}));
    const { logoKiri, logoKanan, pemda, namaRumahSakit, alamatRumahSakit, kontakRumahSakit } = body;

    const saved = await db.kopSurat.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        logoKiri: typeof logoKiri === "string" ? logoKiri : null,
        logoKanan: typeof logoKanan === "string" ? logoKanan : null,
        pemda: typeof pemda === "string" ? pemda.trim() : "",
        namaRumahSakit: typeof namaRumahSakit === "string" ? namaRumahSakit.trim() : "",
        alamatRumahSakit: typeof alamatRumahSakit === "string" ? alamatRumahSakit.trim() : "",
        kontakRumahSakit: typeof kontakRumahSakit === "string" ? kontakRumahSakit.trim() : "",
      },
      update: {
        logoKiri: typeof logoKiri === "string" ? logoKiri : null,
        logoKanan: typeof logoKanan === "string" ? logoKanan : null,
        pemda: typeof pemda === "string" ? pemda.trim() : "",
        namaRumahSakit: typeof namaRumahSakit === "string" ? namaRumahSakit.trim() : "",
        alamatRumahSakit: typeof alamatRumahSakit === "string" ? alamatRumahSakit.trim() : "",
        kontakRumahSakit: typeof kontakRumahSakit === "string" ? kontakRumahSakit.trim() : "",
      },
    });

    return jsonOk({
      success: true,
      message: "Pengaturan Kop Surat berhasil disimpan.",
      kopSurat: saved,
    });
  });
}
