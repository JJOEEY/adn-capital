import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenAI({ apiKey: apiKey ?? "" });

export const MODEL_FLASH = "gemini-2.5-flash";

// Wrapper tương thích với code cũ trong route.ts
// (giữ nguyên interface .generateContent() và .response.text())

export function getGeminiModel(modelName = MODEL_FLASH) {
  return {
    generateContent: async (prompt: string) => {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      return {
        response: {
          text: () => response.text ?? "",
        },
      };
    },
  };
}

export function getGeminiModelWithSearch(modelName = MODEL_FLASH) {
  return {
    generateContent: async (prompt: string) => {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      return {
        response: {
          text: () => response.text ?? "",
        },
      };
    },
  };
}

export async function generateText(prompt: string): Promise<string> {
  const response = await genAI.models.generateContent({
    model: MODEL_FLASH,
    contents: prompt,
  });
  return response.text ?? "";
}
