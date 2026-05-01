import { getTopicEnvelope } from "@/lib/datahub/core";
import type { TopicContext, TopicEnvelope } from "@/lib/datahub/types";
import { executeFlashOnlyAIRequest, MODEL_FLASH } from "@/lib/gemini";
import {
  applyMarketPriceScale,
  chooseMarketDisplayPrice,
  getMarketPayloadRows,
  latestClosePriceFromPayload,
  latestTurnoverPriceFromPayload,
  marketPriceScaleFromPayload,
} from "@/lib/market-price-normalization";
import { extractTickerCandidates as extractTickerCandidatesFromText } from "@/lib/ticker-text";
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

function compactJson(value: unknown, maxLength = 5200) {
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

function formatPrice(value: number | null) {
  return value == null ? null : value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatPct(value: number | null) {
  return value == null ? null : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function normalizePercentMetric(value: number | null) {
  if (value == null) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function lastRow(value: unknown) {
  const record = asRecord(value);
  const data = Array.isArray(record.data) ? record.data : [];
  return data.length > 0 ? data[data.length - 1] : null;
}

function readNestedNumber(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    current = asRecord(current)[key];
  }
  return asNumber(current);
}

function payloadRows(value: unknown) {
  return getMarketPayloadRows(value);
}

function normalizeHistoricalCandles(value: unknown) {
  const scale = marketPriceScaleFromPayload(value);
  return payloadRows(value)
    .map((row) => {
      const item = asRecord(row);
      const open = applyMarketPriceScale(asNumber(item.open ?? item.o), scale);
      const high = applyMarketPriceScale(asNumber(item.high ?? item.h), scale);
      const low = applyMarketPriceScale(asNumber(item.low ?? item.l), scale);
      const close = applyMarketPriceScale(asNumber(item.close ?? item.c ?? item.price), scale);
      const volume = asNumber(item.volume ?? item.v);
      const date = String(item.date ?? item.time ?? item.timestamp ?? "");
      if (open == null || high == null || low == null || close == null) return null;
      return { date, open, high, low, close, volume };
    })
    .filter((item): item is { date: string; open: number; high: number; low: number; close: number; volume: number | null } => item !== null);
}

function pctDiff(value: number | null, base: number | null) {
  if (value == null || base == null || base === 0) return null;
  return Number((((value - base) / base) * 100).toFixed(2));
}

function classifyLastCandle(candles: ReturnType<typeof normalizeHistoricalCandles>, volumeMa20: number | null) {
  const last = candles.at(-1);
  if (!last) return null;
  const range = Math.max(1, last.high - last.low);
  const body = Math.abs(last.close - last.open);
  const bodyPct = Number(((body / range) * 100).toFixed(1));
  const rangePct = last.close > 0 ? Number(((range / last.close) * 100).toFixed(2)) : null;
  const volumeVsMa20 = last.volume != null && volumeMa20 ? Number((last.volume / volumeMa20).toFixed(2)) : null;
  const direction = last.close > last.open ? "up" : last.close < last.open ? "down" : "neutral";
  let vsaWyckoff = "Biên độ và khối lượng ở trạng thái cân bằng.";
  if (volumeVsMa20 != null && volumeVsMa20 >= 1.4 && direction === "down") {
    vsaWyckoff = "Áp lực cung tăng, cần đề phòng phân phối hoặc selling climax nếu thủng hỗ trợ.";
  } else if (volumeVsMa20 != null && volumeVsMa20 >= 1.4 && direction === "up") {
    vsaWyckoff = "Cầu vào chủ động, phù hợp kịch bản hấp thụ cung nếu giữ được vùng hỗ trợ.";
  } else if (volumeVsMa20 != null && volumeVsMa20 < 0.8) {
    vsaWyckoff = "Thanh khoản thấp, tín hiệu bứt phá hoặc hồi phục cần thêm xác nhận.";
  }
  return { ...last, direction, bodyPct, rangePct, volumeVsMa20, vsaWyckoff };
}

function buildAnalysisMetrics(wb: JsonRecord, realtime: unknown, historical: unknown) {
  const ta = asRecord(wb.ta);
  const fa = asRecord(wb.fa);
  const signal = asRecord(wb.signal);
  const realtimeLast = asRecord(lastRow(realtime));
  const candles = normalizeHistoricalCandles(historical);
  const payloadScale = marketPriceScaleFromPayload(historical);
  const historicalMarketPrice = latestTurnoverPriceFromPayload(historical);
  const historicalClosePrice = latestClosePriceFromPayload(historical);
  const anchorPrice = chooseMarketDisplayPrice(historicalClosePrice, historicalMarketPrice);
  const rawCurrentPrice = asNumber(ta.currentPrice) ?? asNumber(realtimeLast.close ?? realtimeLast.price);
  const anchorScale = anchorPrice != null && rawCurrentPrice != null && rawCurrentPrice > 0
    ? anchorPrice / rawCurrentPrice
    : 1;
  const historicalScale = Math.abs(anchorScale - 1) >= 0.08
    ? anchorScale
    : payloadScale !== 1
      ? payloadScale
      : 1;
  const currentPrice = chooseMarketDisplayPrice(applyMarketPriceScale(rawCurrentPrice, historicalScale), anchorPrice);
  const ma20 = applyMarketPriceScale(asNumber(ta.sma20) ?? asNumber(ta.ema20), historicalScale);
  const ma50 = applyMarketPriceScale(asNumber(ta.sma50) ?? asNumber(ta.ema50), historicalScale);
  const ma200 = applyMarketPriceScale(asNumber(ta.sma200) ?? asNumber(ta.ema200), historicalScale);
  const volumeMa20 = asNumber(ta.avgVolume20);
  const volume10 = Array.isArray(ta.volume10) ? ta.volume10 : [];
  const latestVolume = asNumber(realtimeLast.volume) ?? asNumber(volume10.at(-1));
  const support = applyMarketPriceScale(asNumber(signal.stoploss), historicalScale)
    ?? applyMarketPriceScale(readNestedNumber(ta, ["bollinger", "lower"]), historicalScale)
    ?? applyMarketPriceScale(asNumber(ta.low52w), historicalScale);
  const resistance = applyMarketPriceScale(asNumber(signal.target), historicalScale)
    ?? applyMarketPriceScale(readNestedNumber(ta, ["bollinger", "upper"]), historicalScale)
    ?? applyMarketPriceScale(asNumber(ta.high52w), historicalScale);
  const entry = applyMarketPriceScale(asNumber(signal.entryPrice), historicalScale);
  const safeZoneLow = support;
  const safeZoneHigh = entry ?? ma20 ?? currentPrice;
  const macdHistogram = readNestedNumber(ta, ["macd", "histogram"]);
  const macdHistogramPrev = readNestedNumber(ta, ["macd", "histogramPrev"]);
  const rsi14 = asNumber(ta.rsi14);
  const volumeVsMa20 = latestVolume != null && volumeMa20 ? Number((latestVolume / volumeMa20).toFixed(2)) : null;
  const lastCandle = classifyLastCandle(candles, volumeMa20);

  return stripInternalFields({
    ticker: wb.ticker,
    price: currentPrice,
    changePct: asNumber(ta.changePct),
    movingAverages: {
      ma20,
      ma50,
      ma200,
      priceVsMa20Pct: pctDiff(currentPrice, ma20),
      priceVsMa50Pct: pctDiff(currentPrice, ma50),
      priceVsMa200Pct: pctDiff(currentPrice, ma200),
    },
    momentum: {
      rsi14,
      macdHistogram,
      macdHistogramPrev,
      macdHistogramChange: macdHistogram != null && macdHistogramPrev != null ? Number((macdHistogram - macdHistogramPrev).toFixed(2)) : null,
    },
    volume: {
      latestVolume,
      volumeMa20,
      volumeVsMa20,
    },
    priceZones: {
      support,
      resistance,
      safeZoneLow,
      safeZoneHigh,
      low52w: applyMarketPriceScale(asNumber(ta.low52w), historicalScale),
      high52w: applyMarketPriceScale(asNumber(ta.high52w), historicalScale),
    },
    radarAction: {
      status: signal.status ?? null,
      type: signal.type ?? null,
      entryPrice: entry,
      target: applyMarketPriceScale(asNumber(signal.target), historicalScale),
      stoploss: applyMarketPriceScale(asNumber(signal.stoploss), historicalScale),
      currentPnl: asNumber(signal.currentPnl),
      winRate: asNumber(signal.winRate),
      rrRatio: signal.rrRatio ?? null,
    },
    valuation: {
      pe: asNumber(fa.pe),
      pb: asNumber(fa.pb),
      eps: asNumber(fa.eps),
      bvps: asNumber(fa.bookValuePerShare),
      roe: normalizePercentMetric(asNumber(fa.roe)),
      roa: normalizePercentMetric(asNumber(fa.roa)),
      reportDate: fa.reportDate ?? null,
    },
    lastCandle,
    recentCandles: candles.slice(-6),
    adnCore: stripInternalFields(wb.adnCore ?? null),
    adnArt: stripInternalFields(wb.art ?? null),
    suggestedTextFacts: {
      maLine: currentPrice != null
        ? [
            ma20 != null ? `Giá ${formatPrice(currentPrice)} so với MA20 ${formatPrice(ma20)} (${formatPct(pctDiff(currentPrice, ma20))}%)` : null,
            ma50 != null ? `MA50 ${formatPrice(ma50)}` : null,
            ma200 != null ? `MA200 ${formatPrice(ma200)}` : null,
          ].filter(Boolean).join("; ")
        : null,
      riskTrigger: ma20 != null
        ? `Nếu giá mất MA20 ${formatPrice(ma20)} với volume vượt MA20 ${formatPrice(volumeMa20)}, rủi ro điều chỉnh sâu tăng lên.`
        : null,
      warningSupport: currentPrice != null && ma20 != null && currentPrice >= ma20
        ? `Giá đang trên MA20 ${formatPrice(ma20)}, xu hướng ngắn hạn còn được hỗ trợ.`
        : currentPrice != null && ma20 != null
          ? `Giá đang dưới MA20 ${formatPrice(ma20)}, cần chờ lấy lại MA20 trước khi tăng tỷ trọng.`
          : null,
    },
  });
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
  return extractTickerCandidatesFromText(message, currentTicker, 5);
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
  const historical = envelopes.find((item) => item.topic.startsWith("vn:historical:"))?.envelope.value;
  const wb = asRecord(workbench);

  return {
    ticker,
    analysisMetrics: buildAnalysisMetrics(wb, realtime, historical),
    ta: stripInternalFields(wb.ta ?? null),
    fa: stripInternalFields(wb.fa ?? null),
    signal: stripInternalFields(wb.signal ?? null),
    adnCore: stripInternalFields(wb.adnCore ?? null),
    adnArt: stripInternalFields(wb.art ?? null),
    market: stripInternalFields(wb.market ?? null),
    investor: stripInternalFields(wb.investor ?? null),
    news: stripInternalFields(Array.isArray(wb.news) ? wb.news.slice(0, 5) : []),
    realtimeSummary: stripInternalFields(asRecord(realtime).summary ?? null),
    realtimeLastBar: stripInternalFields(lastRow(realtime)),
    orderbook: stripInternalFields(depth ?? null),
    dataSummary: wb.summary ?? null,
    aiCaches: stripInternalFields(wb.aiCaches ?? null),
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
  const outputContract = `OUTPUT_CONTRACT:
- Bắt buộc dùng đúng 7 heading theo thứ tự: **Phân tích cấu trúc (Biểu đồ cổ phiếu)**, **Phân tích vùng giá**, **Chiến lược**, **Phân tích cơ bản**, **Kịch bản rủi ro**, **Cảnh báo**, **Kết luận**.
- Mỗi phần 2-5 bullet/câu ngắn. Không viết chung chung nếu context có số; phải đưa số cụ thể.
- Phân tích cấu trúc: nêu vị trí giá so với MA20, MA50, MA200; mẫu hình hiện tại; nến gần nhất theo VSA/Wyckoff dựa vào analysisMetrics.lastCandle/recentCandles/volume.
- Phân tích vùng giá: nêu hỗ trợ, kháng cự, vùng an toàn bằng số.
- Chiến lược: có 2 kịch bản rõ ràng: nếu đang lãi và nếu đang lỗ. Mỗi kịch bản có điểm chốt lời/giảm tỷ trọng và điểm cắt lỗ hoặc điều kiện giữ lại.
- Phân tích cơ bản: mở bằng **Chỉ số định giá:** nếu context có P/E/P/B/EPS/BVPS/ROE/ROA; so với giá hiện tại và bối cảnh thị trường để đánh giá hấp dẫn hay không.
- Kịch bản rủi ro: nêu điều kiện làm phân tích thất bại, ví dụ mất MA20/MA50, volume tăng, MACD histogram xấu đi, RSI suy yếu, selling climax hoặc phân phối.
- Cảnh báo: bắt buộc có 3 dòng **Ủng hộ:**, **Cảnh báo:**, **Note:**. Mỗi dòng phải có ít nhất một số liệu hoặc điều kiện rõ.
- Kết luận: nêu ADNCore và ADN ART nếu có trong context, sau đó phân loại hành động: quan sát, chờ mua, mua thăm dò, nắm giữ, giảm tỷ trọng, hoặc tránh mua.
- Kết thúc bằng đúng disclaimer:
⚠️ Phân tích tham khảo, không phải khuyến nghị đầu tư.
— ADN Capital 🤖`;
  return `INTERNAL_CONTEXT:
${compactJson(contexts)}

${outputContract}

Người dùng hỏi:
${message}

Yêu cầu trả lời:
${comparison ? "- So sánh trực diện các mã được hỏi." : "- Phân tích mã cổ phiếu chính được hỏi."}
- Gồm đúng 7 phần theo OUTPUT_CONTRACT, không quay lại cấu trúc slash-command cũ.
- Mỗi phần 2-5 dòng hoặc bullet ngắn, ưu tiên số liệu mới nhất trong ngữ cảnh.
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
  const roe = normalizePercentMetric(asNumber(fa.roe));
  const roa = normalizePercentMetric(asNumber(fa.roa));
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

const AIDEN_ANALYSIS_DISCLAIMER = "⚠️ Phân tích tham khảo, không phải khuyến nghị đầu tư.\n— ADN Capital 🤖";

function ensureDisclaimer(answer: string) {
  const cleaned = answer
    .replace(/⚠️?\s*Phân tích tham khảo,?\s*không phải khuyến nghị đầu tư\.?/giu, "")
    .replace(/—\s*ADN Capital\s*🤖?/giu, "")
    .trim();
  return `${cleaned}\n\n${AIDEN_ANALYSIS_DISCLAIMER}`.trim();
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
        `vn:historical:${ticker}:1d`,
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
    message: ensureDisclaimer(sanitizeCustomerAnswer(ensureValuationLine(answer.trim(), contexts))),
    ticker: tickers[0],
    tickers,
    usedTopics,
    model: MODEL_FLASH,
    dataFreshness,
  };
}
