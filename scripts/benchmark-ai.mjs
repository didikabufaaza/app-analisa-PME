import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function benchmark() {
  console.log("=== BENCHMARK GEMINI AI ===");
  const start = Date.now();
  
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    contents: `Analyze this PME parameter: Glucose participant 120, target 100, z-score +2.5. Give concise interpretation and 2 causes in JSON: {"interpretation": string, "causes": string[]}`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const duration = Date.now() - start;
  console.log(`Durasi Response: ${duration} ms (${(duration / 1000).toFixed(2)} detik)`);
  console.log("Usage Metadata:", res.usageMetadata);
  console.log("Output Text:", res.text);
}

benchmark().catch(console.error);
