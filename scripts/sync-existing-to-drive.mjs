// scripts/sync-existing-to-drive.mjs
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import { uploadPdfToDrive } from "../src/services/storage/google-drive.ts";

const db = new PrismaClient();

async function syncExisting() {
  console.log("=== SINKRONISASI FILE LOKAL KE GOOGLE DRIVE ===");
  
  const files = await db.pmeFile.findMany({
    where: {
      OR: [
        { driveFileId: null },
        { driveFileId: { startsWith: "local_" } },
      ],
    },
    include: { session: true },
  });

  console.log(`Ditemukan ${files.length} file lokal yang perlu disinkronkan ke Google Drive.`);

  for (const f of files) {
    if (!f.filePath) continue;
    try {
      console.log(`\nMemproses sinkronisasi: ${f.fileName} (Sesi: ${f.sessionId})...`);
      const buffer = await fs.readFile(f.filePath);
      const result = await uploadPdfToDrive(buffer, f.fileName);

      if (result.fileId && !result.fileId.startsWith("local_")) {
        await db.pmeFile.update({
          where: { id: f.id },
          data: {
            driveFileId: result.fileId,
            driveViewUrl: result.driveViewUrl,
            driveDownloadUrl: result.driveDownloadUrl,
          },
        });
        console.log(` Berhasil diunggah ke Google Drive! Drive ID: ${result.fileId}`);
      } else {
        console.warn(`⚠️ Gagal mendapatkan Drive ID asli untuk ${f.fileName}`);
      }
    } catch (err) {
      console.error(`❌ Gagal sinkronisasi ${f.fileName}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n=== SINKRONISASI SELESAI ===");
  await db.$disconnect();
}

syncExisting().catch(console.error);
