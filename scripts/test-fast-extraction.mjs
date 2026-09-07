import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "fs";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_SCHEMA_JSON } from "../src/services/ai/prompts.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testExtraction() {
  console.log("=== TESTING EXTRACTION WITH gemini-flash-lite-latest ===");
  // Cari salah satu file PDF PME yang ada di storage
  const samplePdfPath = "d:/project/smartpme/storage/cmtjbvpzq0000nza173ro3bcm/pme/cmto23ftt0005vzhwoucyq5oi/original.pdf";
  const buffer = await fs.readFile(samplePdfPath);
  console.log("Ukuran buffer:", buffer.length, "bytes");

  const start = Date.now();
  const res = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
          { text: `Extract structured PME data following this schema:\n${EXTRACTION_SCHEMA_JSON}` },
        ],
      },
    ],
    config: {
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const duration = Date.now() - start;
  console.log(` Ekstraksi selesai dalam: ${duration} ms (${(duration / 1000).toFixed(2)} detik)!`);
  console.log("Total Tokens:", res.usageMetadata?.totalTokenCount);
  const data = JSON.parse(res.text);
  console.log("Provider:", data.pme?.provider);
  console.log("Program:", data.pme?.program);
  console.log("Jumlah Parameter Hasil:", data.results?.length);
  if (data.results?.length > 0) {
    console.log("Sample Result 0:", data.results[0]);
  }
}

testExtraction().catch(console.error);
