import { NextRequest } from "next/server";
import { withAuth, jsonOk, jsonError, getEffectiveOrgId } from "@/lib/api-helpers";
import { db } from "@/lib/db";

// Data default awal untuk memperkaya pilihan jika database masih kosong
const DEFAULT_INSTRUMENTS = [
  { code: "ALT-001", name: "Mindray BS-240 / BS-120 Chemistry Analyzer" },
  { code: "ALT-002", name: "Sysmex XN-Series / XP-100 Hematology Analyzer" },
  { code: "ALT-003", name: "Cobas c311 / c501 (Roche Diagnostics)" },
  { code: "ALT-004", name: "Dirui CS-T240 / CS-600B Auto Chemistry Analyzer" },
  { code: "ALT-005", name: "Sinnowa D280 / BS-3000M Chemistry Analyzer" },
  { code: "ALT-006", name: "Spektrofotometer UV-Vis Klinis Semi-Otomatis" },
  { code: "ALT-007", name: "Rayto RT-9200 Semi-Auto Chemistry Analyzer" },
  { code: "ALT-008", name: "Medonic M-Series Hematology Analyzer" },
];

const DEFAULT_METHODS = [
  { code: "MTD-001", name: "GOD-PAP (Glukosa Oksidase - Peroksidase)" },
  { code: "MTD-002", name: "Jaffe Kinetic Kompensasi (Kreatinin)" },
  { code: "MTD-003", name: "CHOD-PAP Enzimatik (Kolesterol Total)" },
  { code: "MTD-004", name: "Urease GLDH Kinetik (Ureum / BUN)" },
  { code: "MTD-005", name: "IFCC tanpa Pyridoxal Phosphate (SGOT / AST)" },
  { code: "MTD-006", name: "IFCC tanpa Pyridoxal Phosphate (SGPT / ALT)" },
  { code: "MTD-007", name: "Biuret Endpoint Kolorimetri (Protein Total)" },
  { code: "MTD-008", name: "BCG - Bromcresol Green (Albumin)" },
  { code: "MTD-009", name: "GPO-PAP Enzimatik (Trigliserida)" },
  { code: "MTD-010", name: "Impedansi Listrik / Flow Cytometry (Hematologi)" },
  { code: "MTD-011", name: "Fotometri Sianmethemoglobin / SLS Hemoglobin" },
];

const DEFAULT_REAGENTS = [
  { code: "RGN-001", name: "DiaSys Diagnostic Systems" },
  { code: "RGN-002", name: "Randox Laboratories" },
  { code: "RGN-003", name: "Biolabo Diagnostics" },
  { code: "RGN-004", name: "Spinreact Diagnostics" },
  { code: "RGN-005", name: "Elitech Clinical Systems" },
  { code: "RGN-006", name: "Human Diagnostic Reagents" },
  { code: "RGN-007", name: "Mindray Original Reagents" },
  { code: "RGN-008", name: "Reasol Diagnostics" },
];

/**
 * Generate next auto-code for Instrument (ALT-xxx), Method (MTD-xxx), Reagent (RGN-xxx)
 * across the entire database to ensure global uniqueness and continuous numbering.
 */
async function generateNextCode(
  type: "INSTRUMENT" | "METHOD" | "REAGENT"
): Promise<string> {
  const prefix = type === "INSTRUMENT" ? "ALT" : type === "METHOD" ? "MTD" : "RGN";

  let existingCodes: string[] = [];
  if (type === "INSTRUMENT") {
    const list = await db.pmeMasterInstrument.findMany({
      select: { code: true },
    });
    existingCodes = list.map((x) => x.code);
  } else if (type === "METHOD") {
    const list = await db.pmeMasterMethod.findMany({
      select: { code: true },
    });
    existingCodes = list.map((x) => x.code);
  } else {
    const list = await db.pmeMasterReagent.findMany({
      select: { code: true },
    });
    existingCodes = list.map((x) => x.code);
  }

  // Cari angka tertinggi dari format PREFIX-XXX
  let maxNum = 0;
  for (const c of existingCodes) {
    const match = c.match(/^[A-Z]+-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}

/**
 * Deduplikasi daftar master data berdasarkan kode dan nama agar tidak ada duplikasi
 */
function deduplicateMasterItems<T extends { id: string; code: string; name: string; description?: string | null }>(
  items: T[]
): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = `${item.code.toUpperCase().trim()}:::${item.name.toLowerCase().trim()}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" })
  );
}

/**
 * GET /api/pme-mgmt/master
 * Mengambil master data Alat, Metode, dan Reagen secara global untuk seluruh laboratorium peserta dan superadmin.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL") {
      orgId = user.organizationId;
    }
    if (!orgId) {
      const firstOrg = await db.organization.findFirst();
      orgId = firstOrg?.id || "";
    }

    // Ambil master data aktif dari seluruh database (global bagi seluruh peserta PME)
    let [rawInstruments, rawMethods, rawReagents] = await Promise.all([
      db.pmeMasterInstrument.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      db.pmeMasterMethod.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      db.pmeMasterReagent.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
    ]);

    // Jika database masih benar-benar kosong, lakukan seeding default awal
    if (rawInstruments.length === 0 && rawMethods.length === 0 && rawReagents.length === 0 && orgId) {
      await Promise.all([
        ...DEFAULT_INSTRUMENTS.map((item) =>
          db.pmeMasterInstrument.create({
            data: { organizationId: orgId, code: item.code, name: item.name },
          })
        ),
        ...DEFAULT_METHODS.map((item) =>
          db.pmeMasterMethod.create({
            data: { organizationId: orgId, code: item.code, name: item.name },
          })
        ),
        ...DEFAULT_REAGENTS.map((item) =>
          db.pmeMasterReagent.create({
            data: { organizationId: orgId, code: item.code, name: item.name },
          })
        ),
      ]);

      [rawInstruments, rawMethods, rawReagents] = await Promise.all([
        db.pmeMasterInstrument.findMany({
          where: { isActive: true },
          orderBy: { code: "asc" },
        }),
        db.pmeMasterMethod.findMany({
          where: { isActive: true },
          orderBy: { code: "asc" },
        }),
        db.pmeMasterReagent.findMany({
          where: { isActive: true },
          orderBy: { code: "asc" },
        }),
      ]);
    }

    const instruments = deduplicateMasterItems(rawInstruments);
    const methods = deduplicateMasterItems(rawMethods);
    const reagents = deduplicateMasterItems(rawReagents);

    // Hitung next code untuk tiap kategori (global)
    const [nextInstrumentCode, nextMethodCode, nextReagentCode] = await Promise.all([
      generateNextCode("INSTRUMENT"),
      generateNextCode("METHOD"),
      generateNextCode("REAGENT"),
    ]);

    return jsonOk({
      instruments,
      methods,
      reagents,
      nextCodes: {
        INSTRUMENT: nextInstrumentCode,
        METHOD: nextMethodCode,
        REAGENT: nextReagentCode,
      },
    });
  });
}

/**
 * POST /api/pme-mgmt/master
 * Menambah, Mengubah, atau Menghapus Master Data (Khusus Superadmin).
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Hanya Superadmin yang berhak mengelola Master Data.", 403, "FORBIDDEN");
    }

    let orgId = getEffectiveOrgId(user, req);
    if (orgId === "ALL" || !orgId) {
      orgId = user.organizationId;
    }
    if (!orgId) {
      const firstOrg = await db.organization.findFirst();
      orgId = firstOrg?.id || "";
    }

    const body = await req.json().catch(() => ({}));
    const { action, type, id, name, code, description } = body;

    // Validasi tipe
    if (!["INSTRUMENT", "METHOD", "REAGENT"].includes(type)) {
      return jsonError("Tipe master data tidak valid (Pilih: INSTRUMENT, METHOD, atau REAGENT).", 400);
    }

    // Aksi: CREATE
    if (action === "CREATE") {
      if (!name || typeof name !== "string" || !name.trim()) {
        return jsonError("Nama master data wajib diisi.", 400);
      }

      // Gunakan kode yang diberikan atau generate otomatis secara global
      let finalCode = code?.trim();
      if (!finalCode) {
        finalCode = await generateNextCode(type);
      }

      let created;
      if (type === "INSTRUMENT") {
        created = await db.pmeMasterInstrument.create({
          data: {
            organizationId: orgId,
            code: finalCode,
            name: name.trim(),
            description: description?.trim() || null,
          },
        });
      } else if (type === "METHOD") {
        created = await db.pmeMasterMethod.create({
          data: {
            organizationId: orgId,
            code: finalCode,
            name: name.trim(),
            description: description?.trim() || null,
          },
        });
      } else {
        created = await db.pmeMasterReagent.create({
          data: {
            organizationId: orgId,
            code: finalCode,
            name: name.trim(),
            description: description?.trim() || null,
          },
        });
      }

      return jsonOk({
        success: true,
        message: `Data ${type === "INSTRUMENT" ? "Alat" : type === "METHOD" ? "Metode" : "Reagen"} dengan kode ${finalCode} berhasil ditambahkan.`,
        item: created,
      });
    }

    // Aksi: UPDATE
    if (action === "UPDATE") {
      if (!id) return jsonError("ID item wajib disertakan.", 400);
      if (!name || typeof name !== "string" || !name.trim()) {
        return jsonError("Nama master data wajib diisi.", 400);
      }

      let updated;
      if (type === "INSTRUMENT") {
        updated = await db.pmeMasterInstrument.update({
          where: { id },
          data: {
            name: name.trim(),
            ...(code?.trim() ? { code: code.trim() } : {}),
            description: description?.trim() || null,
          },
        });
      } else if (type === "METHOD") {
        updated = await db.pmeMasterMethod.update({
          where: { id },
          data: {
            name: name.trim(),
            ...(code?.trim() ? { code: code.trim() } : {}),
            description: description?.trim() || null,
          },
        });
      } else {
        updated = await db.pmeMasterReagent.update({
          where: { id },
          data: {
            name: name.trim(),
            ...(code?.trim() ? { code: code.trim() } : {}),
            description: description?.trim() || null,
          },
        });
      }

      return jsonOk({
        success: true,
        message: "Master data berhasil diperbarui.",
        item: updated,
      });
    }

    // Aksi: DELETE
    if (action === "DELETE") {
      if (!id) return jsonError("ID item wajib disertakan.", 400);

      if (type === "INSTRUMENT") {
        await db.pmeMasterInstrument.delete({ where: { id } });
      } else if (type === "METHOD") {
        await db.pmeMasterMethod.delete({ where: { id } });
      } else {
        await db.pmeMasterReagent.delete({ where: { id } });
      }

      return jsonOk({
        success: true,
        message: "Master data berhasil dihapus.",
      });
    }

    return jsonError("Aksi tidak dikenali.", 400);
  });
}
