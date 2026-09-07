// scripts/test-pipeline-speed.mjs
import { promises as fs } from "fs";
import { PrismaClient } from "@prisma/client";
import { processSession } from "../src/services/pme/processor.ts";

const db = new PrismaClient();

async function testPipeline() {
  console.log("=== MENGUJI KECEPATAN PIPELINE ANALISIS AI TERBARU ===");
  
  // Ambil salah satu sesi yang memiliki file asli
  const samplePdfPath = "d:/project/smartpme/storage/cmtjbvpzq0000nza173ro3bcm/pme/cmto23ftt0005vzhwoucyq5oi/original.pdf";
  const buffer = await fs.readFile(samplePdfPath);

  const org = await db.organization.findFirst();
  const user = await db.user.findFirst();

  // Buat sesi pengujian
  const session = await db.pmeSession.create({
    data: {
      organizationId: org.id,
      uploadedById: user.id,
      status: "UPLOADED",
      file: {
        create: {
          fileName: "Uji_Kecepatan_PME.pdf",
          filePath: samplePdfPath,
          mimeType: "application/pdf",
          sizeBytes: buffer.length,
          pageCount: 5,
        },
      },
    },
    include: { file: true },
  });

  console.log("Sesi dibuat:", session.id);
  console.log("Memulai pemrosesan pipeline...");
  const t0 = Date.now();

  await processSession({
    sessionId: session.id,
    organizationId: org.id,
    userId: user.id,
  });

  const totalDuration = Date.now() - t0;
  console.log(`\n🎉 PIPELINE SELESAI DALAM: ${totalDuration} ms (${(totalDuration / 1000).toFixed(2)} detik)!`);

  const updatedSession = await db.pmeSession.findUnique({
    where: { id: session.id },
    include: { results: { include: { aiAnalysis: true } }, extractionLogs: true },
  });

  console.log("Status Akhir Sesi:", updatedSession.status);
  console.log("Total Parameter Terekstraksi:", updatedSession.results.length);
  const analyzedCount = updatedSession.results.filter(r => r.aiAnalysis).length;
  console.log("Total Parameter Dianalisis AI:", analyzedCount);
  console.log("\nLog Tahapan:");
  for (const log of updatedSession.extractionLogs) {
    console.log(` - [${log.stage}] ${log.status}: ${log.message || ""}`);
  }

  // Bersihkan sesi pengujian
  await db.pmeSession.delete({ where: { id: session.id } });
  console.log("\nSesi pengujian dibersihkan.");
  await db.$disconnect();
}

testPipeline().catch(console.error);
