import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenAI({ apiKey: apiKey ?? "" });

export const MODEL_FLASH = "gemini-2.5-flash";
// Fallback models khi primary bị quá tải (503 UNAVAILABLE)
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

function isOverloadedError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("overloaded");
}

async function generateWithFallback(
  prompt: string,
  primaryModel: string,
  useSearch = false,
): Promise<string> {
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];
  let lastErr: unknown;

  for (const model of modelsToTry) {
    try {
      const cfg = useSearch ? { tools: [{ googleSearch: {} }] } : undefined;
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        ...(cfg ? { config: cfg } : {}),
      });
      if (model !== primaryModel) {
        console.warn(`[Gemini] Dùng fallback model: ${model} (primary ${primaryModel} quá tải)`);
      }
      return response.text ?? "";
    } catch (err) {
      lastErr = err;
      if (isOverloadedError(err)) {
        console.warn(`[Gemini] Model ${model} quá tải (503), thử model tiếp theo...`);
        continue;
      }
      // Lỗi khác (auth, quota thực sự...) → ném ngay
      throw err;
    }
  }
  throw lastErr;
}

// Wrapper tương thích với code cũ trong route.ts
// (giữ nguyên interface .generateContent() và .response.text())

export function getGeminiModel(modelName = MODEL_FLASH) {
  return {
    generateContent: async (prompt: string) => {
      const text = await generateWithFallback(prompt, modelName, false);
      return { response: { text: () => text } };
    },
  };
}

export function getGeminiModelWithSearch(modelName = MODEL_FLASH) {
  return {
    generateContent: async (prompt: string) => {
      const text = await generateWithFallback(prompt, modelName, true);
      return { response: { text: () => text } };
    },
  };
}

export async function generateText(prompt: string): Promise<string> {
  return generateWithFallback(prompt, MODEL_FLASH, false);
}
