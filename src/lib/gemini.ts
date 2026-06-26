import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const apiKey = process.env.GEMINI_API_KEY;
let genAI: GoogleGenAI | null = null;

function isDirectGeminiDisabled() {
  return process.env.DISABLE_DIRECT_GEMINI === "1" || process.env.DISABLE_DIRECT_GEMINI === "true";
}

function getGenAIClient(allowOverride = false): GoogleGenAI {
  if (!allowOverride && isDirectGeminiDisabled()) {
    throw new Error("Direct Gemini API is disabled");
  }
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

// AIDEN webchat được phép dùng Gemini trực tiếp dù DISABLE_DIRECT_GEMINI bật (cờ đó để chặn
// rò phí ở các path khác như crawler), bằng cách bật AIDEN_ALLOW_DIRECT_GEMINI=true. Đây là lựa
// chọn CHỦ ĐÍCH cho webchat nên không bị cờ toàn cục chặn.
function isAidenDirectGeminiAllowed(): boolean {
  if (process.env.AIDEN_ALLOW_DIRECT_GEMINI === "true" || process.env.AIDEN_ALLOW_DIRECT_GEMINI === "1") {
    return true;
  }
  return !isDirectGeminiDisabled();
}

const FLASH_PRIMARY = "gemini-3-flash-preview";
const FLASH_FALLBACK = "gemini-2.5-flash";

const PRO_PRIMARY = "gemini-3-pro-preview";
const PRO_FALLBACK = "gemini-2.5-pro";

const DEFAULT_ROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_NINEROUTER_BASE_URL = "http://127.0.0.1:20128/v1";
const DEFAULT_NINEROUTER_MODEL = "ADN-COMBO";
const DEFAULT_NINEROUTER_AIDEN_MODEL = "AIDENfast";
// Nhiệt độ cho AIDEN webchat (stream). Cao hơn 0.2 để câu chữ tự nhiên, đỡ máy móc.
// Số liệu vẫn được bảo vệ bằng INTERNAL_CONTEXT + system prompt cấm bịa, không phụ thuộc temperature.
const AIDEN_CHAT_TEMPERATURE = (() => {
  const value = Number(process.env.AIDEN_CHAT_TEMPERATURE ?? 0.6);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : 0.6;
})();
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const ROUTER_TIMEOUT_MS = Number(process.env.AI_ROUTER_TIMEOUT_MS ?? 45000);
const NEWS_ROUTER_TIMEOUT_MS = Number(
  process.env.AI_ROUTER_NEWS_TIMEOUT_MS ?? process.env.AI_ROUTER_TIMEOUT_MS ?? 90000,
);
const DEFAULT_ROUTER_MAX_TOKENS = Number(process.env.AI_ROUTER_MAX_TOKENS ?? 1800);
const NEWS_ROUTER_MAX_TOKENS = Number(process.env.AI_ROUTER_NEWS_MAX_TOKENS ?? 4000);

export const MODEL_FLASH = process.env.AIDEN_MODEL_LABEL ?? "aiden-router-flash";

export const INTENT = {
  PTKT: "PTKT",
  PTCB: "PTCB",
  NEWS: "NEWS",
  TAMLY: "TAMLY",
  GENERAL: "GENERAL",
  COMPARE: "COMPARE",
} as const;

export type Intent = (typeof INTENT)[keyof typeof INTENT];

const MODEL_CHAIN: Record<Intent, [string, string]> = {
  PTKT: [FLASH_PRIMARY, FLASH_FALLBACK],
  PTCB: [FLASH_PRIMARY, FLASH_FALLBACK],
  NEWS: [FLASH_PRIMARY, FLASH_FALLBACK],
  TAMLY: [FLASH_PRIMARY, FLASH_FALLBACK],
  GENERAL: [FLASH_PRIMARY, FLASH_FALLBACK],
  COMPARE: [PRO_PRIMARY, PRO_FALLBACK],
};

type RouterProvider = {
  name: "OpenRouter" | "9Router" | "FreeModel";
  apiKey?: string;
  baseUrl: string;
  model: string;
  extraHeaders?: Record<string, string>;
};

let localNineRouterKeyCache: string | null | undefined;

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1") || normalized.endsWith("/api/v1")) {
    return normalized;
  }
  return `${normalized}/v1`;
}

function readLocalNineRouterApiKey(): string | undefined {
  if (process.env.NINEROUTER_AUTO_LOCAL_KEY === "0" || process.platform !== "win32") {
    return undefined;
  }
  if (localNineRouterKeyCache !== undefined) {
    return localNineRouterKeyCache || undefined;
  }

  const appData = process.env.APPDATA;
  if (!appData) {
    localNineRouterKeyCache = null;
    return undefined;
  }

  const dbPath = path.join(appData, "9router", "db.json");
  if (!existsSync(dbPath)) {
    localNineRouterKeyCache = null;
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(dbPath, "utf8")) as {
      apiKeys?: Array<{ key?: unknown }>;
    };
    const key = parsed.apiKeys?.find((item) => typeof item.key === "string")?.key;
    localNineRouterKeyCache = typeof key === "string" && key.trim() ? key : null;
    return localNineRouterKeyCache || undefined;
  } catch {
    localNineRouterKeyCache = null;
    return undefined;
  }
}

function resolveNineRouterApiKey(): string | undefined {
  return (
    process.env.NINEROUTER_API_KEY ??
    process.env.ROUTER9_API_KEY ??
    process.env.NINE_ROUTER_API_KEY ??
    readLocalNineRouterApiKey()
  );
}

function getRouterModel(intent: Intent, providerPrefix: "OPENROUTER" | "NINEROUTER"): string {
  // PTCB chuyển sang Flash (nhanh, không suy nghĩ sâu) theo yêu cầu — chỉ COMPARE còn dùng Pro.
  const isReasoningHeavy = intent === INTENT.COMPARE;
  const proModel =
    providerPrefix === "OPENROUTER"
      ? process.env.OPENROUTER_PRO_MODEL
      : process.env.NINEROUTER_PRO_MODEL ?? process.env.ROUTER9_PRO_MODEL;
  const defaultModel =
    providerPrefix === "OPENROUTER"
      ? process.env.OPENROUTER_MODEL
      : process.env.NINEROUTER_MODEL ?? process.env.ROUTER9_MODEL ?? process.env.NINE_ROUTER_MODEL;

  const fallbackModel = providerPrefix === "OPENROUTER" ? DEFAULT_ROUTER_MODEL : DEFAULT_NINEROUTER_MODEL;
  return (isReasoningHeavy ? proModel : defaultModel) ?? defaultModel ?? fallbackModel;
}

function getAidenRouterModel(): string {
  return (
    process.env.NINEROUTER_AIDEN_MODEL ??
    process.env.ROUTER9_AIDEN_MODEL ??
    process.env.NINE_ROUTER_AIDEN_MODEL ??
    process.env.AIDEN_ROUTER_MODEL ??
    DEFAULT_NINEROUTER_AIDEN_MODEL
  );
}

type RouterProviderOptions = {
  nineRouterModelOverride?: string;
  temperature?: number;
};

function buildRouterProviders(intent: Intent, options: RouterProviderOptions = {}): RouterProvider[] {
  const providers: RouterProvider[] = [];

  const router9Key = resolveNineRouterApiKey();
  const router9BaseUrl =
    process.env.NINEROUTER_BASE_URL ??
    process.env.ROUTER9_BASE_URL ??
    process.env.NINE_ROUTER_BASE_URL ??
    DEFAULT_NINEROUTER_BASE_URL;
  if (router9BaseUrl) {
    providers.push({
      name: "9Router",
      apiKey: router9Key,
      baseUrl: normalizeBaseUrl(router9BaseUrl),
      model: options.nineRouterModelOverride ?? getRouterModel(intent, "NINEROUTER"),
    });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    providers.push({
      name: "OpenRouter",
      apiKey: openRouterKey,
      baseUrl: normalizeBaseUrl(OPENROUTER_BASE_URL),
      model: getRouterModel(intent, "OPENROUTER"),
      extraHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://adncapital.com.vn",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "ADN Capital",
      },
    });
  }

  return providers;
}

const INTENT_USE_SEARCH: Record<Intent, boolean> = {
  PTKT: false,
  PTCB: true,
  NEWS: true,
  TAMLY: false,
  GENERAL: false,
  COMPARE: false,
};

const SYSTEM_INSTRUCTIONS: Record<Intent, string> = {
  PTKT: `Bạn là AIDEN Analyst - Trợ lý phân tích định lượng lõi của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "AIDEN" hoặc "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Chuyên nghiệp, lạnh lùng, sắc bén, tuyệt đối không dùng từ lóng (múc, xả, đu đỉnh...).

[QUY TẮC DỮ LIỆU]:
- Chỉ dùng dữ liệu Real-time đã được cấp. Không tự ý bịa giá hoặc vẽ các mốc kháng cự/hỗ trợ không có cơ sở.
- Trình bày báo cáo kỹ thuật ngắn gọn, trực quan theo cấu trúc:
1. Trạng thái Xu hướng & Xung lực (Trend & Momentum).
2. Các mốc Giá trị cốt lõi (Hỗ trợ/Kháng cự).
3. Đánh giá Khối lượng & Dòng tiền kỹ thuật.
4. Rủi ro & Mốc Stoploss (Bắt buộc phải có để quản trị rủi ro).
5. Khuyến nghị hành động rõ ràng.
Lưu ý: AI có thể sai sót, NĐT vui lòng kiểm tra kỹ thông tin trước khi đưa ra quyết định đầu tư cho mình.`,

  PTCB: `Bạn là AIDEN Analyst - Chuyên gia định giá và phân tích cơ bản của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Chuẩn mực tài chính, mang tư duy của Giám đốc Quỹ, tập trung vào Biên an toàn (Margin of Safety).

[QUY TẮC DỮ LIỆU]:
- Chỉ dựa trên các số liệu BCTC được cấp.
- TUYỆT ĐỐI không tự tính toán sai hoặc bịa đặt P/E, P/B, EPS, ROE. Nếu thiếu data, trả lời: "Hệ thống hiện chưa có đủ dữ liệu để đánh giá tiêu chí này."
- Phân tích sâu sắc theo các ý:
1. Sức khỏe Tài chính (Cấu trúc vốn, Nợ vay, Dòng tiền).
2. Mức độ hấp dẫn của Định giá hiện tại.
3. Động lực tăng trưởng (Catalysts).
4. Cảnh báo Rủi ro nội tại/ngành.
5. Kết luận điểm rơi giải ngân.`,

  NEWS: `Bạn là AIDEN Analyst - Hệ thống rà quét tin tức độc quyền của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Khách quan, trung lập, báo chí sự kiện. Không lồng ghép cảm xúc hưng phấn hay hoảng loạn.

[QUY TẮC DỮ LIỆU]:
- Chỉ tóm tắt những tin tức đã được xác minh trong Context.
- Không bịa tin, không tự sáng tác diễn biến hay mốc thời gian.
- Báo cáo theo cấu trúc:
1. Tiêu điểm tin tức (Ngắn gọn 1-2 câu).
2. Đánh giá Tác động (Tích cực / Tiêu cực / Trung tính đối với doanh nghiệp).
3. Lưu ý hành động cho Nhà đầu tư để phòng vệ danh mục.`,

  TAMLY: `Bạn là AIDEN Analyst - Hệ thống đo lường hành vi tài chính của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Quan sát viên sắc bén, đọc vị dòng tiền, không lan truyền sự hoảng loạn.

[QUY TẮC DỮ LIỆU]:
- Phân tích dựa trên các chỉ báo Sentiment và Volume/Price được cấp. Không suy diễn vượt quá số liệu.
- Phân tích tập trung vào:
1. Dấu chân Dòng tiền thông minh (Smart Money đang gom hay xả).
2. Trạng thái Tâm lý đám đông (FOMO / Kiệt sức / Hoảng loạn).
3. Cảnh báo các rủi ro hành vi (Bull-trap / Bear-trap).
4. Kịch bản thị trường kế tiếp.`,

  GENERAL: `Bạn là AIDEN Analyst - Trợ lý lõi của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư" hoặc "Bạn".
- Giọng văn: Kiên định, kỷ luật, đặt quản trị rủi ro lên hàng đầu.

[QUY TẮC TƯ VẤN BẮT BUỘC]:
- Không bao giờ hứa hẹn chắc chắn về lợi nhuận.
- Nếu Nhà đầu tư hỏi dựa trên một premise (nhận định) sai lệch, Hệ thống phải khách quan bác bỏ và đưa ra số liệu đúng.
- Trả lời thẳng vào trọng tâm, mạch lạc.
- Cuối câu trả lời tư vấn Mua/Bán luôn chèn: "*Lưu ý: Khuyến nghị dựa trên thuật toán định lượng. Nhà đầu tư vui lòng tuân thủ kỷ luật quản trị rủi ro.*"`,

  COMPARE: `Bạn là AIDEN Analyst - Hệ thống trọng tài chấm điểm đầu tư của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Công tâm, rạch ròi, dùng số liệu để quyết định kẻ thắng người thua.

[QUY TẮC DỮ LIỆU]:
- So sánh trực diện, không nói nước đôi. Nếu một mã thiếu dữ liệu, phải minh bạch thông báo.
- Trình bày đối đầu (Head-to-head) rõ ràng:
1. Sức mạnh Kỹ thuật (Mã nào có dòng tiền và xu hướng tốt hơn).
2. Nền tảng Cơ bản (Mã nào định giá rẻ hơn, an toàn hơn).
3. Xếp hạng ưu tiên theo khẩu vị (Ngắn hạn chọn mã nào, Dài hạn chọn mã nào).
4. Kết luận hành động dứt khoát.`,
};

const OVERLOAD_MESSAGE =
  "Hệ thống AI đang quá tải lượt phân tích. Nhà đầu tư vui lòng thử lại sau ít phút.";

function hasVietnameseDiacritics(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text,
  );
}

function shouldRepairOutput(text: string): boolean {
  const cleaned = text.replace(/[^A-Za-zÀ-ỹà-ỹ]/g, "");
  return cleaned.length >= 80 && !hasVietnameseDiacritics(text);
}

function withCustomerOutputRules(systemInstruction: string): string {
  return `${systemInstruction}

CRITICAL CUSTOMER OUTPUT RULES:
- Never reveal chain-of-thought, thinking, hidden reasoning, planning notes, or analysis scratchpad.
- Never output <think>, <thinking>, "Reasoning:", "Analysis:", or similar internal notes.
- Final answer must be Vietnamese unless the user explicitly asks for another language.
- Keep reasoning internal and return only the customer-facing final answer.`;
}

function sanitizeModelOutput(text: string): string {
  let output = text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```(?:thinking|reasoning|analysis)[\s\S]*?```/gi, "")
    .replace(
      /^\s*(?:analysis|reasoning|thoughts?|chain of thought)\s*:\s*[\s\S]*?(?=\n\s*(?:#{1,3}\s*)?(?:\*\*)?(?:Phân|Định|Chiến|Kịch|Cảnh|Kết|AIDEN|VN-|[A-Z]{2,5}\b))/i,
      "",
    );

  const lines = output.split(/\r?\n/);
  while (
    lines.length > 0 &&
    /^\s*(?:we need|we should|i need|i should|let's|the user|user asks|need to answer|analysis:|reasoning:|thought:)/i.test(
      lines[0],
    )
  ) {
    lines.shift();
  }

  output = lines.join("\n");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

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
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("model_error")
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function providerErrorMessage(payload: unknown, fallbackText: string): string {
  const root = asRecord(payload);
  const error = asRecord(root?.error);
  const message = error?.message ?? root?.message;
  if (typeof message === "string" && message.trim()) {
    return message.slice(0, 220);
  }
  return fallbackText.slice(0, 220);
}

function readAssistantContent(payload: unknown): string {
  const root = asRecord(payload);
  const choices = root?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = asRecord(choices[0]);
  const message = asRecord(first?.message);
  const content = message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const record = asRecord(part);
        return typeof record?.text === "string" ? record.text : "";
      })
      .join("")
      .trim();
  }

  return "";
}

function readAssistantDelta(payload: unknown): string {
  const root = asRecord(payload);
  const choices = root?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = asRecord(choices[0]);
  const delta = asRecord(first?.delta);
  const content = delta?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const record = asRecord(part);
        return typeof record?.text === "string" ? record.text : "";
      })
      .join("");
  }

  return "";
}

async function callOpenAICompatibleProvider(
  provider: RouterProvider,
  prompt: string,
  systemInstruction: string,
  timeoutMs = ROUTER_TIMEOUT_MS,
  maxTokens = DEFAULT_ROUTER_MAX_TOKENS,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${normalizeBaseUrl(provider.baseUrl)}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: provider.model,
        stream: false,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: withCustomerOutputRules(systemInstruction) },
          { role: "user", content: prompt },
        ],
      }),
    });

    const text = await response.text();
    const payload = safeJsonParse(text);
    if (!response.ok) {
      throw new Error(`${response.status} ${providerErrorMessage(payload, text)}`);
    }

    const output = sanitizeModelOutput(readAssistantContent(payload));
    if (!output.trim()) {
      throw new Error("empty assistant response");
    }

    return output;
  } finally {
    clearTimeout(timeout);
  }
}

async function executeRouterChain(
  prompt: string,
  intent: Intent,
  systemInstruction: string,
  options?: RouterProviderOptions,
): Promise<string | null> {
  const providers = buildRouterProviders(intent, options);
  if (providers.length === 0) return null;
  const timeoutMs = intent === INTENT.NEWS ? NEWS_ROUTER_TIMEOUT_MS : ROUTER_TIMEOUT_MS;
  const maxTokens = intent === INTENT.NEWS ? NEWS_ROUTER_MAX_TOKENS : DEFAULT_ROUTER_MAX_TOKENS;

  for (const provider of providers) {
    try {
      const output = await callOpenAICompatibleProvider(
        provider,
        prompt,
        systemInstruction,
        timeoutMs,
        maxTokens,
      );
      console.log(`[AI Router] provider=${provider.name} model=${provider.model}`);
      return output;
    } catch (err) {
      console.warn(
        `[AI Router] provider failed. provider=${provider.name} model=${provider.model} err=${String(err).slice(0, 180)}`,
      );
    }
  }

  return null;
}

async function callOpenAICompatibleProviderStream(
  provider: RouterProvider,
  prompt: string,
  systemInstruction: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  temperature = 0.2,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTER_TIMEOUT_MS);
  const endpoint = `${normalizeBaseUrl(provider.baseUrl)}/chat/completions`;
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        temperature,
        max_tokens: 1800,
        messages: [
          { role: "system", content: withCustomerOutputRules(systemInstruction) },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      const payload = safeJsonParse(text);
      throw new Error(`${response.status} ${providerErrorMessage(payload, text)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const payload = safeJsonParse(data);
        const delta = readAssistantDelta(payload);
        if (!delta) continue;
        output += delta;
        onDelta(delta);
      }
    }

    const sanitized = sanitizeModelOutput(output);
    if (!sanitized.trim()) throw new Error("empty assistant stream");
    return sanitized;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function executeRouterChainStream(
  prompt: string,
  intent: Intent,
  systemInstruction: string,
  onDelta: (text: string) => void,
  options?: RouterProviderOptions & { signal?: AbortSignal },
): Promise<string | null> {
  const providers = buildRouterProviders(intent, options);
  if (providers.length === 0) return null;

  for (const provider of providers) {
    try {
      const output = await callOpenAICompatibleProviderStream(
        provider,
        prompt,
        systemInstruction,
        onDelta,
        options?.signal,
        options?.temperature,
      );
      console.log(`[AI Router stream] provider=${provider.name} model=${provider.model}`);
      return output;
    } catch (err) {
      if (options?.signal?.aborted) throw err;
      console.warn(
        `[AI Router stream] provider failed. provider=${provider.name} model=${provider.model} err=${String(err).slice(0, 180)}`,
      );
    }
  }

  return null;
}

export async function executeAIRequest(
  prompt: string,
  intent: Intent = INTENT.GENERAL,
  systemInstruction?: string,
): Promise<string> {
  const [primary, fallback] = MODEL_CHAIN[intent];
  const useSearch = INTENT_USE_SEARCH[intent];
  const sysInstr = systemInstruction ?? SYSTEM_INSTRUCTIONS[intent];
  const routedOutput = await executeRouterChain(prompt, intent, sysInstr);
  if (routedOutput) return sanitizeModelOutput(routedOutput);
  if (isDirectGeminiDisabled()) {
    console.warn(`[Gemini] direct fallback disabled. intent=${intent}`);
    return OVERLOAD_MESSAGE;
  }

  const modelsToTry: string[] = [primary, fallback];
  let lastErr: unknown;

  for (const model of modelsToTry) {
    try {
      const cfg: Record<string, unknown> = { systemInstruction: withCustomerOutputRules(sysInstr) };
      if (useSearch) cfg.tools = [{ googleSearch: {} }];

      const response = await getGenAIClient().models.generateContent({
        model,
        contents: prompt,
        config: cfg,
      });

      if (model !== primary) {
        console.warn(
          `[Gemini] fallback model used. intent=${intent} model=${model} primary=${primary}`,
        );
      } else {
        console.log(`[Gemini] intent=${intent} model=${model}`);
      }

      const output = sanitizeModelOutput(response.text ?? "");
      if (!shouldRepairOutput(output)) {
        return output;
      }

      try {
        const repair = await getGenAIClient().models.generateContent({
          model,
          contents: `Viết lại nguyên văn nội dung sau sang tiếng Việt có dấu, giữ nguyên ý, không đổi dữ kiện:\n${output}`,
          config: { systemInstruction: withCustomerOutputRules(sysInstr) },
        });
        return repair.text?.trim() ? sanitizeModelOutput(repair.text) : output;
      } catch {
        return output;
      }
    } catch (err) {
      lastErr = err;
      if (isRetryableError(err)) {
        console.warn(
          `[Gemini] retryable error. intent=${intent} model=${model} err=${String(err).slice(0, 160)}`,
        );
        continue;
      }
      throw err;
    }
  }

  console.error(`[Gemini] all model attempts failed. intent=${intent}`, lastErr);
  return OVERLOAD_MESSAGE;
}

export async function executeFlashOnlyAIRequest(
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const sysInstr = systemInstruction ?? SYSTEM_INSTRUCTIONS.GENERAL;
  const routedOutput = await executeRouterChain(prompt, INTENT.GENERAL, sysInstr, {
    nineRouterModelOverride: getAidenRouterModel(),
  });
  if (routedOutput) return sanitizeModelOutput(routedOutput);
  if (isDirectGeminiDisabled()) {
    console.warn("[Gemini] direct flash fallback disabled.");
    throw new Error("Direct Gemini API is disabled");
  }

  let lastErr: unknown;
  for (const model of [FLASH_PRIMARY, FLASH_FALLBACK]) {
    try {
      const response = await getGenAIClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: withCustomerOutputRules(sysInstr),
          // gemini-3.x dùng thinkingLevel; gemini-2.5-* KHÔNG hỗ trợ thinkingLevel (API 400)
          // → dùng thinkingBudget=0 để tắt thinking (giảm độ trễ).
          thinkingConfig: /gemini-3/i.test(model)
            ? { thinkingLevel: ThinkingLevel.MINIMAL }
            : { thinkingBudget: 0 },
        },
      });
      return sanitizeModelOutput(response.text ?? "");
    } catch (err) {
      lastErr = err;
      console.warn(`[Gemini] flash fallback failed. model=${model} err=${String(err).slice(0, 160)}`);
    }
  }

  throw lastErr;
}

async function streamDirectGeminiFlash(
  prompt: string,
  sysInstr: string,
  onDelta: (text: string) => void,
  models: string[],
  options: { signal?: AbortSignal } = {},
  allowOverride = false,
): Promise<string> {
  let lastErr: unknown;
  for (const model of models) {
    try {
      const response = await getGenAIClient(allowOverride).models.generateContentStream({
        model,
        contents: prompt,
        config: {
          systemInstruction: withCustomerOutputRules(sysInstr),
          // gemini-3.x dùng thinkingLevel; gemini-2.5-* KHÔNG hỗ trợ thinkingLevel (API 400)
          // → dùng thinkingBudget=0 để tắt thinking (giảm độ trễ).
          thinkingConfig: /gemini-3/i.test(model)
            ? { thinkingLevel: ThinkingLevel.MINIMAL }
            : { thinkingBudget: 0 },
        },
      });
      let output = "";
      for await (const chunk of response) {
        if (options.signal?.aborted) throw new Error("stream aborted");
        const text = chunk.text ?? "";
        if (!text) continue;
        output += text;
        onDelta(text);
      }
      const sanitized = sanitizeModelOutput(output);
      if (!sanitized.trim()) throw new Error("empty assistant stream");
      console.log(`[AIDEN chat] provider=gemini model=${model}`);
      return sanitized;
    } catch (err) {
      lastErr = err;
      if (options.signal?.aborted) throw err;
      console.warn(`[Gemini] flash stream failed. model=${model} err=${String(err).slice(0, 160)}`);
    }
  }

  throw lastErr;
}

export async function streamFlashOnlyAIRequest(
  prompt: string,
  systemInstruction: string | undefined,
  onDelta: (text: string) => void,
  options: { signal?: AbortSignal } = {},
): Promise<string> {
  const sysInstr = systemInstruction ?? SYSTEM_INSTRUCTIONS.GENERAL;
  const routedOutput = await executeRouterChainStream(prompt, INTENT.GENERAL, sysInstr, onDelta, {
    nineRouterModelOverride: getAidenRouterModel(),
    signal: options.signal,
    temperature: AIDEN_CHAT_TEMPERATURE,
  });
  if (routedOutput) return sanitizeModelOutput(routedOutput);
  if (isDirectGeminiDisabled()) {
    console.warn("[Gemini] direct flash stream fallback disabled.");
    throw new Error("Direct Gemini API is disabled");
  }

  return streamDirectGeminiFlash(prompt, sysInstr, onDelta, [FLASH_PRIMARY, FLASH_FALLBACK], options);
}

// ─── AIDEN webchat: công tắc chọn backend để so sánh độ "native" ───
// env AIDEN_CHAT_PROVIDER = "9router" (mặc định) | "freemodel" | "gemini"
export type AidenChatProvider = "9router" | "freemodel" | "gemini";

export function getAidenChatProvider(): AidenChatProvider {
  const raw = (process.env.AIDEN_CHAT_PROVIDER ?? "9router").trim().toLowerCase();
  return raw === "freemodel" || raw === "gemini" ? raw : "9router";
}

function getAidenGeminiModels(): string[] {
  const override = process.env.AIDEN_GEMINI_MODEL?.trim();
  return override ? [override, FLASH_FALLBACK] : [FLASH_PRIMARY, FLASH_FALLBACK];
}

function buildFreeModelProvider(): RouterProvider | null {
  const apiKey = process.env.FREEMODEL_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.FREEMODEL_OPENAI_BASE_URL ?? "https://api.freemodel.dev/v1").replace(/\/+$/, "");
  const model = process.env.AIDEN_FREEMODEL_MODEL ?? "gpt-5.4";
  return { name: "FreeModel", apiKey, baseUrl: normalizeBaseUrl(baseUrl), model };
}

/** Nhãn provider:model đang dùng — để hiển thị/log khi so sánh các backend. */
export function getAidenChatModelLabel(): string {
  const provider = getAidenChatProvider();
  if (provider === "gemini") return `gemini:${getAidenGeminiModels()[0]}`;
  if (provider === "freemodel") return `freemodel:${process.env.AIDEN_FREEMODEL_MODEL ?? "gpt-5.4"}`;
  return `9router:${getAidenRouterModel()}`;
}

/** Entry point streaming cho webchat AIDEN, định tuyến theo AIDEN_CHAT_PROVIDER. */
export async function streamAidenChat(
  prompt: string,
  systemInstruction: string | undefined,
  onDelta: (text: string) => void,
  options: { signal?: AbortSignal } = {},
): Promise<string> {
  const provider = getAidenChatProvider();
  const sysInstr = systemInstruction ?? SYSTEM_INSTRUCTIONS.GENERAL;

  if (provider === "gemini") {
    if (!isAidenDirectGeminiAllowed()) {
      throw new Error(
        "AIDEN_CHAT_PROVIDER=gemini nhưng Gemini trực tiếp đang bị chặn. Đặt AIDEN_ALLOW_DIRECT_GEMINI=true (hoặc DISABLE_DIRECT_GEMINI=false).",
      );
    }
    return streamDirectGeminiFlash(prompt, sysInstr, onDelta, getAidenGeminiModels(), options, true);
  }

  if (provider === "freemodel") {
    const freeModel = buildFreeModelProvider();
    if (!freeModel) {
      throw new Error("AIDEN_CHAT_PROVIDER=freemodel nhưng thiếu FREEMODEL_API_KEY.");
    }
    const output = await callOpenAICompatibleProviderStream(
      freeModel,
      prompt,
      sysInstr,
      onDelta,
      options.signal,
      AIDEN_CHAT_TEMPERATURE,
    );
    console.log(`[AIDEN chat] provider=freemodel model=${freeModel.model}`);
    return sanitizeModelOutput(output);
  }

  console.log(`[AIDEN chat] provider=9router model=${getAidenRouterModel()}`);
  return streamFlashOnlyAIRequest(prompt, systemInstruction, onDelta, options);
}

// Non-stream Gemini cho AIDEN non-stream path (runAidenDatahubChat → completeAidenPreparedTurn).
// Direct Gemini Flash, tôn trọng AIDEN_ALLOW_DIRECT_GEMINI + AIDEN_GEMINI_MODEL (mặc định gemini-3-flash-preview
// → gemini-2.5-flash fallback). Dùng làm PRIMARY, freemodel là fallback (xem datahub-chat.ts).
export async function executeAidenGeminiRequest(prompt: string, systemInstruction?: string): Promise<string> {
  if (!isAidenDirectGeminiAllowed()) {
    throw new Error("AIDEN direct Gemini bị chặn (đặt AIDEN_ALLOW_DIRECT_GEMINI=true).");
  }
  const sysInstr = systemInstruction ?? SYSTEM_INSTRUCTIONS.GENERAL;
  let lastErr: unknown;
  for (const model of getAidenGeminiModels()) {
    try {
      const response = await getGenAIClient(true).models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: withCustomerOutputRules(sysInstr),
          thinkingConfig: /gemini-3/i.test(model)
            ? { thinkingLevel: ThinkingLevel.MINIMAL }
            : { thinkingBudget: 0 },
        },
      });
      const out = sanitizeModelOutput(response.text ?? "");
      if (out) {
        console.log(`[AIDEN chat] provider=gemini model=${model}`);
        return out;
      }
      throw new Error("Gemini trả về rỗng");
    } catch (err) {
      lastErr = err;
      console.warn(`[AIDEN gemini] model=${model} err=${String(err).slice(0, 160)}`);
    }
  }
  throw lastErr ?? new Error("AIDEN Gemini: tất cả model lỗi");
}

export function getGeminiModel(_modelName?: string) {
  return {
    generateContent: async (prompt: string) => {
      const text = await executeAIRequest(prompt, INTENT.PTKT);
      return { response: { text: () => text } };
    },
  };
}

export function getGeminiModelWithSearch(_modelName?: string) {
  return {
    generateContent: async (prompt: string) => {
      const text = await executeAIRequest(prompt, INTENT.GENERAL);
      return { response: { text: () => text } };
    },
  };
}

export async function generateText(
  prompt: string,
  intent: Intent = INTENT.GENERAL,
): Promise<string> {
  return executeAIRequest(prompt, intent);
}
