import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey ?? "");

export const MODEL_FLASH = "gemini-2.5-flash";

export function getGeminiModel(modelName = MODEL_FLASH) {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Lấy model Gemini có tích hợp Google Search (dùng cho /fa, /news, /tamly).
 * Sử dụng google_search tool thay vì google_search_retrieval (đã deprecated).
 */
export function getGeminiModelWithSearch(modelName = MODEL_FLASH) {
  return genAI.getGenerativeModel({
    model: modelName,
    tools: [{ googleSearch: {} } as any],
  });
}

export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}
