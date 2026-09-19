import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

const DEFAULT_SIGNER = {
  namaPejabat: "M.Didik Wahyudi, S.Tr.Kes",
  jabatan: "Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan",
  tempat: "OKU Timur",
  tanggal: "14 November 2027",
  nip: "198408152009041001",
};

/**
 * GET /api/pme-mgmt/signer
 * Mengambil data penandatangan laporan hasil PME resmi.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    let signer = await db.pmeSigner.findUnique({
      where: { organizationId: orgId },
    });

    if (!signer) {
      signer = await db.pmeSigner.findFirst();
    }

    return jsonOk({
      signer: signer || {
        organizationId: orgId,
        ...DEFAULT_SIGNER,
      },
    });
  });
}

/**
 * POST /api/pme-mgmt/signer
 * Menyimpan / memperbarui informasi penandatangan laporan (Superadmin).
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Hanya Superadmin yang berhak mengatur penandatangan laporan hasil PME.", 403, "FORBIDDEN");
    }

    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }

    const body = await req.json().catch(() => ({}));
    const { namaPejabat, jabatan, tempat, tanggal, nip } = body;

    const saved = await db.pmeSigner.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        namaPejabat: namaPejabat?.trim() || DEFAULT_SIGNER.namaPejabat,
        jabatan: jabatan?.trim() || DEFAULT_SIGNER.jabatan,
        tempat: tempat?.trim() || DEFAULT_SIGNER.tempat,
        tanggal: tanggal?.trim() || DEFAULT_SIGNER.tanggal,
        nip: nip?.trim() || DEFAULT_SIGNER.nip,
      },
      update: {
        namaPejabat: namaPejabat?.trim() || DEFAULT_SIGNER.namaPejabat,
        jabatan: jabatan?.trim() || DEFAULT_SIGNER.jabatan,
        tempat: tempat?.trim() || DEFAULT_SIGNER.tempat,
        tanggal: tanggal?.trim() || DEFAULT_SIGNER.tanggal,
        nip: nip?.trim() || DEFAULT_SIGNER.nip,
      },
    });

    return jsonOk({
      success: true,
      signer: saved,
      message: "Data penandatangan laporan berhasil disimpan.",
    });
  });
}
