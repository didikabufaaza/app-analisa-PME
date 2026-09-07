import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const s = Date.now();
  const res = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: "Return 1 sentence in JSON: {\"text\": string}",
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.1,
    },
  });
  console.log(`With thinkingBudget 0 -> Time: ${Date.now() - s} ms, text:`, res.text);
}

test().catch(console.error);
