import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

// Default Master Packages & Parameters sesuai instruksi user & PDF Kemenkes
const DEFAULT_PACKAGES = [
  {
    name: "Paket Kimia Klinik",
    code: "KIMIA_KLINIK",
    category: "Kimia Klinik",
    description: "Evaluasi mutu parameter kimia klinik rutin dan elektrolit",
    parameters: [
      { name: "Bilirubin Total", unit: "mg/dL", defaultMethodCode: "17", defaultInstrumentCode: "2202" },
      { name: "Kolesterol", unit: "mg/dL", defaultMethodCode: "021", defaultInstrumentCode: "2202" },
      { name: "Kreatinin", unit: "mg/dL", defaultMethodCode: "032", defaultInstrumentCode: "2202" },
      { name: "Glukosa", unit: "mg/dL", defaultMethodCode: "041", defaultInstrumentCode: "2202" },
      { name: "Protein Total", unit: "g/dL", defaultMethodCode: "051", defaultInstrumentCode: "2202" },
      { name: "Ureum", unit: "mg/dL", defaultMethodCode: "065", defaultInstrumentCode: "2202" },
      { name: "Asam Urat", unit: "mg/dL", defaultMethodCode: "099", defaultInstrumentCode: "2202" },
      { name: "Trigliserida", unit: "mg/dL", defaultMethodCode: "87", defaultInstrumentCode: "2202" },
      { name: "GOT/ASAT", unit: "U/L", defaultMethodCode: "95", defaultInstrumentCode: "2202" },
      { name: "GPT/ALAT", unit: "U/L", defaultMethodCode: "105", defaultInstrumentCode: "2202" },
      { name: "Kalsium", unit: "mg/dL", defaultMethodCode: "110", defaultInstrumentCode: "2202" },
      { name: "Albumin", unit: "g/dL", defaultMethodCode: "124", defaultInstrumentCode: "2202" },
      { name: "Fosfatase Alkali", unit: "U/L", defaultMethodCode: "130", defaultInstrumentCode: "2202" },
      { name: "Gamma GT (GGT)", unit: "U/L", defaultMethodCode: "140", defaultInstrumentCode: "2202" },
      { name: "Natrium", unit: "mmol/L", defaultMethodCode: "151", defaultInstrumentCode: "2922" },
      { name: "Kalium", unit: "mmol/L", defaultMethodCode: "161", defaultInstrumentCode: "2922" },
      { name: "Klorida (Chlorida)", unit: "mmol/L", defaultMethodCode: "171", defaultInstrumentCode: "2922" },
      { name: "CK", unit: "U/L", defaultMethodCode: "180", defaultInstrumentCode: "2202" },
      { name: "CK-MB", unit: "U/L", defaultMethodCode: "190", defaultInstrumentCode: "2202" },
      { name: "Iron", unit: "ug/dL", defaultMethodCode: "200", defaultInstrumentCode: "2202" },
      { name: "LDH", unit: "U/L", defaultMethodCode: "210", defaultInstrumentCode: "2202" },
    ],
  },
  {
    name: "Paket Hematologi",
    code: "HEMATOLOGI",
    category: "Hematologi",
    description: "Evaluasi mutu parameter darah rutin dan indeks eritrosit",
    parameters: [
      { name: "Hemoglobin (Hb)", unit: "g/dL", defaultMethodCode: "01", defaultInstrumentCode: "101" },
      { name: "Leukosit (WBC)", unit: "10^3/uL", defaultMethodCode: "02", defaultInstrumentCode: "101" },
      { name: "Trombosit (PLT)", unit: "10^3/uL", defaultMethodCode: "03", defaultInstrumentCode: "101" },
      { name: "Eritrosit (RBC)", unit: "10^6/uL", defaultMethodCode: "04", defaultInstrumentCode: "101" },
      { name: "Hematokrit (Ht/HCT)", unit: "%", defaultMethodCode: "05", defaultInstrumentCode: "101" },
      { name: "MCV", unit: "fL", defaultMethodCode: "06", defaultInstrumentCode: "101" },
      { name: "MCH", unit: "pg", defaultMethodCode: "07", defaultInstrumentCode: "101" },
      { name: "MCHC", unit: "g/dL", defaultMethodCode: "08", defaultInstrumentCode: "101" },
    ],
  },
  {
    name: "Paket Imunologi",
    code: "IMUNOLOGI",
    category: "Imunologi",
    description: "Evaluasi mutu penanda infeksi dan imunologi serologi",
    parameters: [
      { name: "HBsAg", unit: "S/CO", defaultMethodCode: "301", defaultInstrumentCode: "401" },
      { name: "Anti HIV", unit: "S/CO", defaultMethodCode: "302", defaultInstrumentCode: "401" },
      { name: "Anti HCV", unit: "S/CO", defaultMethodCode: "303", defaultInstrumentCode: "401" },
      { name: "Sifilis (TPHA/VDRL)", unit: "Titer", defaultMethodCode: "304", defaultInstrumentCode: "401" },
    ],
  },
];

async function ensureDefaultPackages(orgId: string) {
  const count = await db.pmePackage.count({ where: { organizationId: orgId } });
  if (count === 0) {
    for (const pkgData of DEFAULT_PACKAGES) {
      const createdPkg = await db.pmePackage.create({
        data: {
          organizationId: orgId,
          name: pkgData.name,
          code: pkgData.code,
          category: pkgData.category,
          description: pkgData.description,
        },
      });

      for (let i = 0; i < pkgData.parameters.length; i++) {
        const param = pkgData.parameters[i];
        await db.pmePackageParameter.create({
          data: {
            packageId: createdPkg.id,
            name: param.name,
            unit: param.unit,
            defaultMethodCode: param.defaultMethodCode,
            defaultInstrumentCode: param.defaultInstrumentCode,
            sortOrder: i + 1,
          },
        });
      }
    }
  }
}

export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    const orgId = getEffectiveOrgId(user, req) === "ALL" ? user.organizationId : getEffectiveOrgId(user, req);

    await ensureDefaultPackages(orgId);

    const packages = await db.pmePackage.findMany({
      where: { organizationId: orgId },
      include: {
        parameters: {
          orderBy: { sortOrder: "asc" },
        },
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return jsonOk({ packages });
  });
}

// Hanya Superadmin yang bisa menambah paket atau parameter baru
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Akses ditolak. Penambahan paket dan parameter hanya dapat dilakukan oleh Superadmin.", 403, "FORBIDDEN");
    }

    const orgId = getEffectiveOrgId(user, req) === "ALL" ? user.organizationId : getEffectiveOrgId(user, req);
    const body = await req.json();

    const { action } = body;

    // Action: Tambah Parameter ke Paket yang ada
    if (action === "ADD_PARAMETER") {
      const { packageId, name, unit, defaultMethodCode, defaultInstrumentCode } = body;
      if (!packageId || !name || !name.trim()) {
        return jsonError("ID Paket dan Nama Parameter wajib diisi.", 400);
      }

      const pkg = await db.pmePackage.findUnique({ where: { id: packageId } });
      if (!pkg || pkg.organizationId !== orgId) {
        return jsonError("Paket tidak ditemukan.", 404);
      }

      const paramCount = await db.pmePackageParameter.count({ where: { packageId } });

      const newParam = await db.pmePackageParameter.create({
        data: {
          packageId,
          name: name.trim(),
          unit: unit?.trim() || null,
          defaultMethodCode: defaultMethodCode?.trim() || null,
          defaultInstrumentCode: defaultInstrumentCode?.trim() || null,
          sortOrder: paramCount + 1,
        },
      });

      return jsonOk({ parameter: newParam });
    }

    // Action: Buat Paket Baru
    const { name, code, category, description, parameters } = body;
    if (!name || !name.trim()) {
      return jsonError("Nama paket wajib diisi.", 400);
    }

    const pkgCode = (code || name).toUpperCase().replace(/\s+/g, "_").slice(0, 30);

    const newPkg = await db.pmePackage.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        code: pkgCode,
        category: category?.trim() || "Lainnya",
        description: description?.trim() || null,
      },
    });

    if (Array.isArray(parameters) && parameters.length > 0) {
      for (let i = 0; i < parameters.length; i++) {
        const p = parameters[i];
        if (p.name && p.name.trim()) {
          await db.pmePackageParameter.create({
            data: {
              packageId: newPkg.id,
              name: p.name.trim(),
              unit: p.unit?.trim() || null,
              defaultMethodCode: p.defaultMethodCode?.trim() || null,
              defaultInstrumentCode: p.defaultInstrumentCode?.trim() || null,
              sortOrder: i + 1,
            },
          });
        }
      }
    }

    const createdWithParams = await db.pmePackage.findUnique({
      where: { id: newPkg.id },
      include: { parameters: { orderBy: { sortOrder: "asc" } } },
    });

    return jsonOk({ package: createdWithParams });
  });
}
