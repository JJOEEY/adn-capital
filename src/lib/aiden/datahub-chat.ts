import { getTopicEnvelope } from "@/lib/datahub/core";
import type { TopicContext, TopicEnvelope } from "@/lib/datahub/types";
import { executeFlashOnlyAIRequest, MODEL_FLASH } from "@/lib/gemini";
import { resolveMarketTicker } from "@/lib/ticker-resolver";

type JsonRecord = Record<string, unknown>;

export type AidenDatahubChatResult = {
  message: string;
  ticker?: string;
  tickers: string[];
  usedTopics: string[];
  model: string;
  dataFreshness: Record<string, TopicEnvelope["freshness"]>;
};

const TICKER_EXCLUSIONS = new Set([
  "ADN",
  "AIDEN",
  "AI",
  "API",
  "BOT",
  "CEO",
  "CFO",
  "GDP",
  "USD",
  "VND",
  "VN",
  "TA",
  "FA",
  "PTKT",
  "PTCB",
  "NEWS",
  "TAMLY",
]);

function compactJson(value: unknown, maxLength = 2400) {
  const raw = JSON.stringify(value, null, 2);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}\n... truncated`;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatDecimal(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function lastRow(value: unknown) {
  const record = asRecord(value);
  const data = Array.isArray(record.data) ? record.data : [];
  return data.length > 0 ? data[data.length - 1] : null;
}

function stripInternalFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripInternalFields);
  if (!value || typeof value !== "object") return value;

  const blocked = new Set([
    "source",
    "provider",
    "bridge",
    "endpoint",
    "url",
    "topic",
    "usedTopics",
    "cacheKey",
  ]);
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .filter(([key]) => !blocked.has(key))
      .map(([key, child]) => [key, stripInternalFields(child)]),
  );
}

function extractTickerCandidates(message: string, currentTicker?: string | null) {
  const candidates = new Set<string>();
  if (currentTicker) candidates.add(currentTicker.toUpperCase());
  const upper = message.toUpperCase();
  for (const match of upper.matchAll(/\b[A-Z][A-Z0-9._-]{1,11}\b/g)) {
    const token = match[0].replace(/[^A-Z0-9._-]/g, "");
    if (!token || TICKER_EXCLUSIONS.has(token)) continue;
    candidates.add(token);
  }
  return Array.from(candidates).slice(0, 5);
}

async function resolveTickers(message: string, currentTicker?: string | null) {
  const candidates = extractTickerCandidates(message, currentTicker);
  const resolved = await Promise.all(
    candidates.map(async (candidate) => {
      const result = await resolveMarketTicker(candidate);
      return result.valid ? result.ticker : null;
    }),
  );
  return Array.from(new Set(resolved.filter((ticker): ticker is string => Boolean(ticker)))).slice(0, 3);
}

async function readTopic(topic: string, context: TopicContext) {
  const envelope = await getTopicEnvelope(topic, context);
  return { topic, envelope };
}

function buildTickerContext(ticker: string, envelopes: Array<{ topic: string; envelope: TopicEnvelope }>) {
  const workbench = envelopes.find((item) => item.topic.startsWith("research:workbench:"))?.envelope.value;
  const realtime = envelopes.find((item) => item.topic.startsWith("vn:realtime:"))?.envelope.value;
  const depth = envelopes.find((item) => item.topic.startsWith("vn:depth:"))?.envelope.value;
  const wb = asRecord(workbench);

  return {
    ticker,
    ta: stripInternalFields(wb.ta ?? null),
    fa: stripInternalFields(wb.fa ?? null),
    signal: stripInternalFields(wb.signal ?? null),
    market: stripInternalFields(wb.market ?? null),
    investor: stripInternalFields(wb.investor ?? null),
    news: stripInternalFields(Array.isArray(wb.news) ? wb.news.slice(0, 5) : []),
    aiCaches: stripInternalFields(wb.aiCaches ?? null),
    realtimeSummary: stripInternalFields(asRecord(realtime).summary ?? null),
    realtimeLastBar: stripInternalFields(lastRow(realtime)),
    orderbook: stripInternalFields(depth ?? null),
    dataSummary: wb.summary ?? null,
  };
}

function stripSourceFraming(text: string) {
  return text
    .replace(
      /^(?:\s*Chào[^.\n]*[.!?]\s*)?(?:Dựa trên|Theo|Với)\s+(?:các\s+)?(?:dữ liệu|thông tin|hệ thống|nguồn)[^.\n]*[.!?]\s*/i,
      "",
    )
    .replace(
      /^(?:\s*Chào[^,\n]*,\s*)?(?:dựa trên|theo|với)\s+(?:các\s+)?(?:dữ liệu|thông tin|hệ thống|nguồn)[^,\n]*,\s*/i,
      "",
    );
}

function buildSystemInstruction() {
  return `Bạn là AIDEN của ADN Capital, trợ lý phân tích cổ phiếu Việt Nam.

Quy tắc bắt buộc:
- Chỉ dùng dữ liệu trong INTERNAL_CONTEXT. Không tự bịa giá, P/E, P/B, target, stoploss, khối lượng hoặc tin tức.
- Không bao giờ nhắc DataHub, FiinQuant, bridge, provider, API, cache, backend hoặc tên nguồn nội bộ trong câu trả lời cho khách hàng.
- Không mở đầu bằng câu mô tả AIDEN đang dựa trên nguồn dữ liệu nào. Đi thẳng vào mã cổ phiếu và nhận định.
- Không được viết "chưa có dữ liệu FA", "không có dữ liệu FA", "FA null" hoặc các câu tương tự.
- Nếu kỳ báo cáo mới chưa đủ số liệu, dùng kỳ báo cáo gần nhất đang có trong ngữ cảnh và ghi rõ "theo kỳ báo cáo gần nhất"; không nói dữ liệu đến từ đâu.
- Nếu một chỉ số định giá vẫn không có số sau khi đã dùng ngữ cảnh, chuyển sang nhận định định tính dựa trên kỳ báo cáo gần nhất, giá hiện tại, vùng hỗ trợ/kháng cự, dòng tiền và rủi ro. Không được viết thiếu dữ liệu, thiếu chỉ số, thiếu vắng chỉ số, chưa đủ dữ liệu hoặc chưa có số liệu.
- Trong phần Định giá/PTCB, nếu có P/E, P/B, EPS, ROE hoặc ROA trong ngữ cảnh thì phải nêu các chỉ số đó ngay câu đầu.
- Không nhắc slash-command, không hướng người dùng dùng /ta, /fa, /news hoặc /hanhvi.
- Trả lời bằng Markdown GFM hợp lệ, tiêu đề ngắn, bullet rõ, không escape dấu *.
- Văn phong chuyên nghiệp, trực diện, không sao chép nguyên mẫu ví dụ.
- Kết luận phải phân biệt: quan sát, chờ mua, mua thăm dò, nắm giữ, giảm tỷ trọng, hoặc tránh mua.`;
}

function buildPrompt(message: string, contexts: unknown[]) {
  const comparison = contexts.length >= 2;
  return `INTERNAL_CONTEXT:
${compactJson(contexts)}

Người dùng hỏi:
${message}

Yêu cầu trả lời:
${comparison ? "- So sánh trực diện các mã được hỏi." : "- Phân tích mã cổ phiếu chính được hỏi."}
- Gồm 4 phần: PTKT, Định giá/PTCB, Hành vi dòng tiền/ATC hoặc sổ lệnh mua/bán nếu có, Kết luận hành động.
- Mỗi phần 2-4 dòng, ưu tiên số liệu mới nhất trong ngữ cảnh.
- Phần Định giá/PTCB bắt buộc mở bằng dòng **Chỉ số định giá:** nếu ngữ cảnh có P/E/P/B/EPS/ROE/ROA.
- Không nhắc tên nguồn nội bộ hoặc trạng thái backend.
- Nếu dùng kỳ báo cáo trước đó, viết ngắn gọn "theo kỳ báo cáo gần nhất" và tiếp tục phân tích.
- Nếu chưa có số định lượng trong ngữ cảnh, vẫn viết phần Định giá/PTCB bằng nhận định định tính; không nói thiếu dữ liệu hoặc thiếu chỉ số.
- Không đưa khuyến nghị chắc chắn; luôn nêu điều kiện quản trị rủi ro.`;
}

function buildFlashUnavailableMessage(contexts: unknown[]) {
  const statusLines = contexts.map((item) => {
    const record = asRecord(item);
    const ticker = String(record.ticker ?? "Mã cổ phiếu");
    const summary = asRecord(record.dataSummary);
    const parts = [
      `PTKT ${summary.hasTA ? "đã sẵn sàng" : "đang cập nhật"}`,
      `định giá ${summary.hasFA ? "đã sẵn sàng" : "theo kỳ báo cáo gần nhất"}`,
      `dòng tiền ${summary.hasInvestorFlow ? "đã sẵn sàng" : "đang cập nhật"}`,
      `tín hiệu ${summary.hasSignal ? "đã sẵn sàng" : "đang cập nhật"}`,
    ];
    return `- **${ticker}:** ${parts.join("; ")}.`;
  });

  return `### AIDEN đang xử lý chậm

Hệ thống đang mất nhiều thời gian hơn bình thường, nên AIDEN chưa đưa ra kết luận đầu tư để tránh suy đoán ngoài dữ liệu đã kiểm chứng.

**Trạng thái phân tích**
${statusLines.join("\n")}

Anh/chị gửi lại câu hỏi sau ít phút. AIDEN sẽ ưu tiên số liệu mới nhất và kỳ báo cáo gần nhất khi kỳ hiện tại chưa hoàn tất.`;
}

function sanitizeCustomerAnswer(text: string) {
  return stripSourceFraming(text)
    .replace(/Dựa trên dữ liệu phân tích nội bộ(?: đã được chuẩn hóa)?[,.]?\s*/gi, "")
    .replace(/dựa trên dữ liệu đã kiểm chứng[,.]?\s*/gi, "")
    .replace(/\bDataHub\b/gi, "")
    .replace(/\bFiinQuantX?\b/gi, "")
    .replace(/\bbridge\b/gi, "")
    .replace(/\bprovider\b/gi, "")
    .replace(/\bbackend\b/gi, "")
    .replace(/\bcache\b/gi, "")
    .replace(/\bAPI\b/g, "")
    .replace(/FA\s+null/gi, "phần định giá theo kỳ báo cáo gần nhất")
    .replace(
      /(?:mặc\s+dù\s*)?(?:thiếu|vắng|thiếu\s+vắng)[^.\n]*(?:chỉ\s*số|P\/E|P\/B|FA|cơ\s*bản|định\s*giá)[^.\n]*/gi,
      "Theo kỳ báo cáo gần nhất, phần định giá được đối chiếu với vùng giá hiện tại và chất lượng tăng trưởng",
    )
    .replace(
      /(?:hiện\s*)?(?:chưa|không)\s+(?:có|đủ)\s+dữ\s+liệu[^\n.]*/gi,
      "phần định giá sử dụng kỳ báo cáo gần nhất và giá thị trường hiện tại",
    )
    .replace(
      /(?:hiện\s*)?(?:chưa|không)\s+(?:có|đủ)\s+dữ\s+liệu\s+(?:FA|cơ\s*bản|P\/E|P\/B)[^\n.]*/gi,
      "Phần định giá sử dụng kỳ báo cáo gần nhất và giá thị trường hiện tại",
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildValuationLine(contexts: unknown[]) {
  const context = asRecord(contexts[0]);
  const fa = asRecord(context.fa);
  const pe = asNumber(fa.pe);
  const pb = asNumber(fa.pb);
  const eps = asNumber(fa.eps);
  const bvps = asNumber(fa.bookValuePerShare);
  const roe = asNumber(fa.roe);
  const roa = asNumber(fa.roa);
  const reportDate = typeof fa.reportDate === "string" && fa.reportDate.trim()
    ? ` theo kỳ báo cáo gần nhất ${fa.reportDate.trim()}`
    : " theo kỳ báo cáo gần nhất";

  const pieces = [
    pe != null ? `P/E ${formatDecimal(pe)}x` : null,
    pb != null ? `P/B ${formatDecimal(pb)}x` : null,
    eps != null ? `EPS ${formatDecimal(eps)} đồng/cp` : null,
    bvps != null ? `BVPS ${formatDecimal(bvps)} đồng/cp` : null,
    roe != null ? `ROE ${formatDecimal(roe)}%` : null,
    roa != null ? `ROA ${formatDecimal(roa)}%` : null,
  ].filter(Boolean);

  if (pieces.length === 0) {
    return "**Chỉ số định giá:** Theo kỳ báo cáo gần nhất, phần định giá được đối chiếu với vùng giá hiện tại, chất lượng lợi nhuận và rủi ro thị trường.";
  }
  return `**Chỉ số định giá:** ${pieces.join(" · ")}${reportDate}.`;
}

function ensureValuationLine(answer: string, contexts: unknown[]) {
  const valuationLine = buildValuationLine(contexts);
  if (/Chỉ số định giá:\s*.*(?:P\/E|P\/B|EPS|ROE|ROA)/i.test(answer)) return answer;

  const headingPattern = /(\*\*(?:Định giá|Phân tích Cơ bản|Định giá\/PTCB|Phân tích cơ bản)[^\n]*\*\*\s*\n?)/i;
  if (headingPattern.test(answer)) {
    return answer.replace(headingPattern, `$1${valuationLine}\n`);
  }

  return `${answer.trim()}\n\n**Định giá và Phân tích cơ bản**\n${valuationLine}`;
}

export async function runAidenDatahubChat(input: {
  message: string;
  currentTicker?: string | null;
  context?: TopicContext;
}): Promise<AidenDatahubChatResult> {
  const message = input.message.trim();
  const context = input.context ?? {};
  const tickers = await resolveTickers(message, input.currentTicker);

  if (tickers.length === 0) {
    return {
      message:
        "AIDEN cần một mã cổ phiếu hợp lệ để phân tích. Anh/chị có thể nhập trực tiếp như **SSI**, **HPG** hoặc hỏi: **Phân tích cho tôi SSI**.",
      tickers: [],
      usedTopics: [],
      model: MODEL_FLASH,
      dataFreshness: {},
    };
  }

  const perTicker = await Promise.all(
    tickers.map(async (ticker) => {
      const topics = [
        `research:workbench:${ticker}`,
        `vn:realtime:${ticker}:5m`,
        `vn:depth:${ticker}`,
      ];
      const envelopes = await Promise.all(topics.map((topic) => readTopic(topic, context)));
      return { ticker, topics, envelopes, context: buildTickerContext(ticker, envelopes) };
    }),
  );

  const usedTopics = perTicker.flatMap((item) => item.topics);
  const dataFreshness = Object.fromEntries(
    perTicker.flatMap((item) => item.envelopes.map(({ topic, envelope }) => [topic, envelope.freshness])),
  );

  const contexts = perTicker.map((item) => item.context);
  let answer: string;
  try {
    answer = await executeFlashOnlyAIRequest(
      buildPrompt(message, contexts),
      buildSystemInstruction(),
    );
  } catch (error) {
    console.warn("[AIDEN] Flash-only generation failed:", error);
    answer = buildFlashUnavailableMessage(contexts);
  }

  return {
    message: sanitizeCustomerAnswer(ensureValuationLine(answer.trim(), contexts)),
    ticker: tickers[0],
    tickers,
    usedTopics,
    model: MODEL_FLASH,
    dataFreshness,
  };
}
