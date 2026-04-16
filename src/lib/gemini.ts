import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[Gemini] GEMINI_API_KEY is missing");
}

const genAI = new GoogleGenAI({ apiKey: apiKey ?? "" });

const FLASH_PRIMARY = "gemini-3-flash-preview";
const FLASH_FALLBACK = "gemini-2.5-flash";

const PRO_PRIMARY = "gemini-3-pro-preview";
const PRO_FALLBACK = "gemini-2.5-pro";

export const MODEL_FLASH = FLASH_PRIMARY;

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
  PTCB: [PRO_PRIMARY, PRO_FALLBACK],
  NEWS: [FLASH_PRIMARY, FLASH_FALLBACK],
  TAMLY: [FLASH_PRIMARY, FLASH_FALLBACK],
  GENERAL: [FLASH_PRIMARY, FLASH_FALLBACK],
  COMPARE: [PRO_PRIMARY, PRO_FALLBACK],
};

const INTENT_USE_SEARCH: Record<Intent, boolean> = {
  PTKT: false,
  PTCB: true,
  NEWS: true,
  TAMLY: false,
  GENERAL: true,
  COMPARE: false,
};

const SYSTEM_INSTRUCTIONS: Record<Intent, string> = {
  PTKT: `Bạn là ADN AI Broker - Trợ lý phân tích định lượng lõi của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống" hoặc "AI Broker".
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

  PTCB: `Bạn là ADN AI Broker - Chuyên gia định giá và phân tích cơ bản của ADN Capital.
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

  NEWS: `Bạn là ADN AI Broker - Hệ thống rà quét tin tức độc quyền của ADN Capital.
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

  TAMLY: `Bạn là ADN AI Broker - Hệ thống đo lường hành vi tài chính của ADN Capital.
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

  GENERAL: `Bạn là ADN AI Broker - Trợ lý lõi của nền tảng Quant Trading ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư" hoặc "Bạn".
- Giọng văn: Kiên định, kỷ luật, đặt quản trị rủi ro lên hàng đầu.

[QUY TẮC TƯ VẤN BẮT BUỘC]:
- Không bao giờ hứa hẹn chắc chắn về lợi nhuận.
- Nếu Nhà đầu tư hỏi dựa trên một premise (nhận định) sai lệch, Hệ thống phải khách quan bác bỏ và đưa ra số liệu đúng.
- Trả lời thẳng vào trọng tâm, mạch lạc.
- Cuối câu trả lời tư vấn Mua/Bán luôn chèn: "*Lưu ý: Khuyến nghị dựa trên thuật toán định lượng. Nhà đầu tư vui lòng tuân thủ kỷ luật quản trị rủi ro.*"`,

  COMPARE: `Bạn là ADN AI Broker - Hệ thống trọng tài chấm điểm đầu tư của ADN Capital.
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
        console.warn(
          `[Gemini] fallback model used. intent=${intent} model=${model} primary=${primary}`,
        );
      } else {
        console.log(`[Gemini] intent=${intent} model=${model}`);
      }

      return response.text ?? "";
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

