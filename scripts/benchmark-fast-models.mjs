import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const testModels = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
];

async function run() {
  console.log("=== BENCHMARK SPEED TEST MODELS ===");
  for (const m of testModels) {
    const s = Date.now();
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: "Return a 1-sentence interpretation of elevated blood glucose in JSON: {\"result\": string}",
        config: { responseMimeType: "application/json" },
      });
      console.log(` ${m}: ${Date.now() - s} ms | Tokens: ${res.usageMetadata?.totalTokenCount}`);
    } catch (err) {
      console.log(`❌ ${m}: FAIL (${err.status || err.message?.slice(0, 60)})`);
    }
  }
}

run();
