/**
 * gemini.ts — Intent-based Model Routing + Graceful Fallback
 *
 * Quy tắc:
 *   - Flash group  → PTKT, NEWS, TAMLY, GENERAL (nhanh, nhẹ, rẻ)
 *   - Pro group    → PTCB (phân tích sâu, BCTC, định giá)
 *   - Fallback tự động: Primary → Fallback1 → thông báo lịch sự
 *   - SystemInstruction động theo intent
 *   - Backward-compat wrappers giữ nguyên API cũ
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.warn("[Gemini] GEMINI_API_KEY chưa được cấu hình");

const genAI = new GoogleGenAI({ apiKey: apiKey ?? "" });

// ── [QUY TẮC 1] MODEL CONSTANTS ──────────────────────────────────────────────

/** Nhóm Flash: Nhanh/Nhẹ — PTKT, Tin tức, Tâm lý, Chat thông thường */
const FLASH_PRIMARY  = "gemini-2.5-flash";
const FLASH_FALLBACK = "gemini-2.5-flash-lite";    // Dự phòng khi primary 429/503

/** Nhóm Pro: Phân tích Sâu — PTCB, BCTC, Định giá */
const PRO_PRIMARY    = "gemini-2.5-pro";           // Mạnh, đọc JSON FiinQuant xuất sắc
const PRO_FALLBACK   = "gemini-2.5-flash";         // Giảm cấp về Flash nếu Pro quá tải

// Backward-compat export
export const MODEL_FLASH = FLASH_PRIMARY;

// ── [QUY TẮC 2] INTENT ENUM & ROUTING ────────────────────────────────────────

export const INTENT = {
  PTKT:    "PTKT",    // Phân tích Kỹ thuật
  PTCB:    "PTCB",    // Phân tích Cơ bản / BCTC / Định giá
  NEWS:    "NEWS",    // Tin tức
  TAMLY:   "TAMLY",  // Tâm lý hành vi dòng tiền
  GENERAL: "GENERAL", // Chat thông thường
} as const;

export type Intent = typeof INTENT[keyof typeof INTENT];

/** Model chain [primary, fallback] theo intent */
const MODEL_CHAIN: Record<Intent, [string, string]> = {
  PTKT:    [FLASH_PRIMARY, FLASH_FALLBACK],
  PTCB:    [PRO_PRIMARY,   PRO_FALLBACK],
  NEWS:    [FLASH_PRIMARY, FLASH_FALLBACK],
  TAMLY:   [FLASH_PRIMARY, FLASH_FALLBACK],
  GENERAL: [FLASH_PRIMARY, FLASH_FALLBACK],
};

/** Các intent cần Google Search grounding */
const INTENT_USE_SEARCH: Record<Intent, boolean> = {
  PTKT:    false,
  PTCB:    true,
  NEWS:    true,
  TAMLY:   true,
  GENERAL: true,
};

// ── [QUY TẮC 3] SYSTEM INSTRUCTION THEO NGỮ CẢNH ────────────────────────────

const SYSTEM_INSTRUCTIONS: Record<Intent, string> = {
  PTKT: `Bạn là chuyên gia phân tích kỹ thuật chứng khoán Việt Nam hàng đầu.
Xưng "em", gọi khách là "đại ca". Trả lời ngắn gọn, có cấu trúc Markdown.
TUYỆT ĐỐI chỉ dùng số liệu từ dữ liệu real-time đã cung cấp — không bịa giá, EMA, RSI.
Không tiết lộ nguồn API hay tên thư viện.`,

  PTCB: `Bạn là chuyên gia phân tích cơ bản và định giá doanh nghiệp niêm yết Việt Nam.
Xưng "em", gọi khách là "đại ca".
KHI CÓ ĐẦY ĐỦ DỮ LIỆU: Kết thúc phân tích bằng JSON block sau (không thêm text sau JSON):
\`\`\`json
{"recommendation":"BUY|HOLD|SELL","targetPrice":0,"fairValueLow":0,"fairValueHigh":0,"upside":0,"keyRisks":[],"keyCatalysts":[]}
\`\`\`
Tuyệt đối không tự bịa số P/E, ROE, EPS — chỉ dùng số từ dữ liệu đã cung cấp.`,

  NEWS: `Bạn là trợ lý tổng hợp tin tức chứng khoán Việt Nam.
Xưng "em", gọi khách là "đại ca".
Chỉ báo cáo tin đã xác minh qua Google Search. KHÔNG bịa tin hay ngày tháng.
Format Markdown, ngắn gọn, thực tế.`,

  TAMLY: `Bạn là chuyên gia phân tích tâm lý hành vi và dòng tiền thông minh (Smart Money) tại TTCK Việt Nam.
Xưng "em", gọi khách là "đại ca".
Sử dụng framework VSA, Wyckoff. Phân biệt dòng tiền bán lẻ vs tổ chức.
Chỉ dùng volume/price data đã cung cấp — không bịa số.`,

  GENERAL: `Bạn là ADN AI Bot System — trợ lý chứng khoán Việt Nam của ADN CAPITAL.
Xưng "em", gọi khách là "đại ca". Phong cách: chuyên nghiệp nhưng gần gũi.
Không tiết lộ tên API, thư viện hay cơ sở hạ tầng. Chỉ nói "dữ liệu real-time" hoặc "hệ thống quant".
Khi có data thị trường, luôn bám sát số liệu thực — không suy đoán.`,
};

const OVERLOAD_MESSAGE =
  "Hệ thống AI đang quá tải lượt phân tích. Quý khách vui lòng thử lại sau ít phút 🙏";

// ── Error detection ───────────────────────────────────────────────────────────

function isRetryableError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("unavailable") ||
    msg.includes("resource_exhausted") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("quota") ||
    // Model không tồn tại → thử fallback
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("model_error")
  );
}

// ── [QUY TẮC 2] CORE EXECUTOR ────────────────────────────────────────────────

/**
 * executeAIRequest — Hàm trung tâm gọi Gemini API với intent routing + fallback.
 *
 * @param prompt            Nội dung prompt đầy đủ
 * @param intent            Mục đích → xác định model group và search mode
 * @param systemInstruction Override system instruction (tuỳ chọn)
 */
export async function executeAIRequest(
  prompt: string,
  intent: Intent = INTENT.GENERAL,
  systemInstruction?: string,
): Promise<string> {
  const [primary, fallback] = MODEL_CHAIN[intent];
  const useSearch = INTENT_USE_SEARCH[intent];
  const sysInstr = systemInstruction ?? SYSTEM_INSTRUCTIONS[intent];
  const modelsToTry: string[] = [primary, fallback];
  let lastErr: unknown;

  for (const model of modelsToTry) {
    try {
      const cfg: Record<string, unknown> = { systemInstruction: sysInstr };
      if (useSearch) cfg.tools = [{ googleSearch: {} }];

      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: cfg,
      });

      if (model !== primary) {
        console.warn(`[Gemini] ⚠️ Intent=${intent} → fallback ${model} (${primary} không khả dụng)`);
      } else {
        console.log(`[Gemini] Intent=${intent} model=${model}`);
      }

      return response.text ?? "";
    } catch (err) {
      lastErr = err;
      if (isRetryableError(err)) {
        console.warn(`[Gemini] ⚠️ Model ${model} (intent=${intent}) lỗi ${String(err).slice(0, 80)}, thử tiếp...`);
        continue;
      }
      // Lỗi nghiêm trọng (auth, invalid key...) → ném ngay, không retry
      throw err;
    }
  }

  console.error(`[Gemini] ❌ Tất cả model đều thất bại cho intent=${intent}:`, lastErr);
  return OVERLOAD_MESSAGE;
}

// ── BACKWARD-COMPAT WRAPPERS (giữ nguyên API cũ trong route.ts) ──────────────

/** Dùng cho /ta (PTKT) — Flash, không search */
export function getGeminiModel(_modelName?: string) {
  return {
    generateContent: async (prompt: string) => {
      const text = await executeAIRequest(prompt, INTENT.PTKT);
      return { response: { text: () => text } };
    },
  };
}

/** Dùng cho /news, /fa, /tamly, general — Flash, có search */
export function getGeminiModelWithSearch(_modelName?: string) {
  return {
    generateContent: async (prompt: string) => {
      const text = await executeAIRequest(prompt, INTENT.GENERAL);
      return { response: { text: () => text } };
    },
  };
}

/** Dùng cho các module ngoài route.ts (market-news, crawler...) */
export async function generateText(
  prompt: string,
  intent: Intent = INTENT.GENERAL,
): Promise<string> {
  return executeAIRequest(prompt, intent);
}
