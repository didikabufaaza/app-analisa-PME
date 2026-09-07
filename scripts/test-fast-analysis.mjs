import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_SYSTEM_PROMPT } from "../src/services/ai/prompts.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testAnalysis() {
  console.log("=== TESTING ANALYSIS WITH gemini-flash-lite-latest ===");
  const input = {
    parameter: "Bilirubin Total",
    participant_value: 1.85,
    target_value: 1.23,
    z_score: 3.88,
    status: "UNSATISFACTORY",
    unit: "mg/dL",
    method: "17",
    instrument: "2202",
    history: []
  };

  const start = Date.now();
  const res = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: [
      {
        role: "user",
        parts: [{ text: `Analyze this VALIDATED PME result:\n${JSON.stringify(input, null, 2)}` }],
      },
    ],
    config: {
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const duration = Date.now() - start;
  console.log(` Analisis parameter selesai dalam: ${duration} ms (${(duration / 1000).toFixed(2)} detik)!`);
  console.log("Total Tokens:", res.usageMetadata?.totalTokenCount);
  console.log("Hasil Analisis:", JSON.parse(res.text));
}

testAnalysis().catch(console.error);
