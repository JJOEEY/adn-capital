import { getTopicEnvelope } from "@/lib/datahub/core";
import type { TopicContext, TopicEnvelope } from "@/lib/datahub/types";
import { MODEL_FLASH } from "@/lib/gemini";
import { emitObservabilityEvent, type ObservabilityMeta } from "@/lib/observability";
import {
  applyMarketPriceScale,
  alignMarketPriceToAnchor,
  chooseMarketDisplayPrice,
  getMarketPayloadRows,
  latestClosePriceFromPayload,
  latestTurnoverPriceFromPayload,
  marketPriceScaleFromPayload,
} from "@/lib/market-price-normalization";
import { normalizeHistoricalPriceWithSnapshot, type StockPriceSnapshot } from "@/lib/market-price-snapshot";
import { classifyAidenIntent, type AidenIntent } from "@/lib/aiden/intent";
import { extractTickerCandidates as extractTickerCandidatesFromText } from "@/lib/ticker-text";
import { resolveMarketTicker } from "@/lib/ticker-resolver";
import { prisma } from "@/lib/prisma";

type JsonRecord = Record<string, unknown>;
function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const GENERAL_CHAT_TIMEOUT_MS = readPositiveIntegerEnv("AIDEN_CHAT_TIMEOUT_MS", 25_000);
const AIDEN_FREEMODEL_TIMEOUT_MS = readPositiveIntegerEnv("AIDEN_FREEMODEL_TIMEOUT_MS", 10_000);
const AIDEN_FREEMODEL_MODEL = process.env.AIDEN_FREEMODEL_MODEL ?? "gpt-5.4";
const AIDEN_FREEMODEL_BASE_URL = (process.env.FREEMODEL_OPENAI_BASE_URL ?? "https://api.freemodel.dev/v1").replace(/\/+$/, "");
const GENERAL_TOPIC_TIMEOUT_MS = 3_500;
const TICKER_TOPIC_TIMEOUT_MS = 15_000;
type AidenSurface = "aiden" | "stock";

export type AidenDatahubChatResult = {
  message: string;
  ticker?: string;
  tickers: string[];
  recommendation?: AidenRecommendation | null;
  usedTopics: string[];
  model: string;
  dataFreshness: Record<string, TopicEnvelope["freshness"]>;
  intent: AidenIntent;
};

export type AidenDatahubPreparedTurn = {
  message: string;
  intent: AidenIntent;
  ticker?: string;
  tickers: string[];
  recommendation?: AidenRecommendation | null;
  usedTopics: string[];
  model: string;
  dataFreshness: Record<string, TopicEnvelope["freshness"]>;
  prompt?: string;
  staticMessage?: string;
  fallbackMessage: string;
  systemInstruction: string;
  tickerContexts: unknown[];
};

export type AidenRecommendation = {
  ticker: string;
  entryPrice: number | null;
  target: number | null;
  stoploss: number | null;
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

function roundedPrice(value: unknown) {
  const numberValue = asNumber(value);
  return numberValue == null ? null : Math.round(numberValue);
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = roundedPrice(value);
    if (numberValue != null) return numberValue;
  }
  return null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`[${label}] timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
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

function sma(values: number[], period: number) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function emaSeries(values: number[], period: number) {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result.push(previous);
  for (const value of values.slice(period)) {
    previous = value * multiplier + previous * (1 - multiplier);
    result.push(previous);
  }
  return result;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff >= 0) gain += diff;
    else loss += Math.abs(diff);
  }
  if (loss === 0) return 100;
  const rs = gain / period / (loss / period);
  return 100 - 100 / (1 + rs);
}

function macdHistogram(values: number[]) {
  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);
  if (!ema12.length || !ema26.length) return { histogram: null, histogramPrev: null };
  const offset = ema12.length - ema26.length;
  const macd = ema26.map((value, index) => ema12[index + offset] - value);
  const signal = emaSeries(macd, 9);
  if (!signal.length) return { histogram: null, histogramPrev: null };
  const signalOffset = macd.length - signal.length;
  const hist = signal.map((value, index) => macd[index + signalOffset] - value);
  return {
    histogram: hist.at(-1) ?? null,
    histogramPrev: hist.at(-2) ?? null,
  };
}

function buildIndicatorsFromCandles(candles: ReturnType<typeof normalizeHistoricalCandles>) {
  const closes = candles.map((item) => item.close).filter((value) => Number.isFinite(value));
  const volumes = candles.map((item) => item.volume ?? 0).filter((value) => Number.isFinite(value));
  const macd = macdHistogram(closes);
  const last = candles.at(-1);
  const last52w = candles.slice(-252);
  return stripInternalFields({
    currentPrice: last?.close ?? null,
    changePct: closes.length >= 2 && closes.at(-2)
      ? Number((((closes.at(-1)! - closes.at(-2)!) / closes.at(-2)!) * 100).toFixed(2))
      : null,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    avgVolume20: sma(volumes, 20),
    low52w: last52w.length ? Math.min(...last52w.map((item) => item.low)) : null,
    high52w: last52w.length ? Math.max(...last52w.map((item) => item.high)) : null,
    rsi14: rsi(closes, 14),
    macd,
    volume10: volumes.slice(-10),
  });
}

async function loadDatabaseV2DailyPayload(ticker: string) {
  const rows = await prisma.databaseMarketLatest.findMany({
    where: {
      dataset: "market.ohlcv",
      symbol: ticker,
      channel: { in: ["ohlcv.1D", "ohlc_closed.1D.json"] },
    },
    orderBy: [{ tradingDate: "desc" }, { updatedAt: "desc" }],
    take: 700,
  });
  const byDate = new Map<string, JsonRecord>();
  for (const row of rows) {
    if (byDate.has(row.tradingDate)) continue;
    const payload = asRecord(row.payload);
    const scale = marketPriceScaleFromPayload(payload);
    const open = applyMarketPriceScale(asNumber(payload.open ?? payload.openPrice ?? payload.o), scale);
    const high = applyMarketPriceScale(asNumber(payload.high ?? payload.highestPrice ?? payload.h), scale);
    const low = applyMarketPriceScale(asNumber(payload.low ?? payload.lowestPrice ?? payload.l), scale);
    const close = applyMarketPriceScale(asNumber(payload.close ?? payload.matchPrice ?? payload.c ?? payload.price), scale);
    if (open == null || high == null || low == null || close == null) continue;
    byDate.set(row.tradingDate, {
      date: row.tradingDate,
      time: row.tradingDate,
      open,
      high,
      low,
      close,
      volume: asNumber(payload.volume ?? payload.v ?? payload.totalVolumeTraded) ?? 0,
    });
  }
  const data = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return data.length ? { data } : null;
}

async function loadDatabaseV2PriceSnapshot(ticker: string, historicalPayload: unknown) {
  const latestTick = await prisma.databaseToolLatest.findFirst({
    where: { tool: "radar", dataset: "radar.realtime.tick", key: ticker },
    orderBy: { updatedAt: "desc" },
  });
  const rows = normalizeHistoricalCandles(historicalPayload);
  const latestCandle = rows.at(-1);
  const previousCandle = rows.at(-2);
  const tick = asRecord(latestTick?.payload);
  const rawPrice = asNumber(tick.price ?? tick.matchPrice ?? tick.lastPrice ?? tick.close);
  const anchor = latestCandle?.close ?? previousCandle?.close ?? null;
  const price = chooseMarketDisplayPrice(alignMarketPriceToAnchor(rawPrice, anchor), anchor);
  const effectivePrice = price ?? latestCandle?.close ?? null;
  const reference = alignMarketPriceToAnchor(asNumber(tick.reference ?? tick.refPrice ?? tick.previousClose), anchor) ?? previousCandle?.close ?? null;
  const changePct = asNumber(tick.changePct ?? tick.changedRatio) ??
    (effectivePrice != null && reference ? Number((((effectivePrice - reference) / reference) * 100).toFixed(2)) : null);
  return stripInternalFields({
    price: effectivePrice,
    close: latestCandle?.close ?? null,
    previousClose: reference,
    changePct,
    latestVolume: asNumber(tick.volume ?? tick.totalVolumeTraded) ?? latestCandle?.volume ?? null,
    volumeMa20: sma(rows.map((item) => item.volume ?? 0), 20),
    priceDate: latestCandle?.date ?? null,
    realtimeAt: latestTick?.updatedAt?.toISOString() ?? null,
    historicalScale: 1,
  });
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

function buildAnalysisMetrics(wb: JsonRecord, realtime: unknown, historical: unknown, priceSnapshotValue?: unknown) {
  const ta = asRecord(wb.ta);
  const fa = asRecord(wb.fa);
  const signal = asRecord(wb.signal);
  const priceSnapshot = asRecord(priceSnapshotValue ?? wb.priceSnapshot);
  const typedPriceSnapshot = priceSnapshot as unknown as StockPriceSnapshot;
  const realtimeLast = asRecord(lastRow(realtime));
  const candles = normalizeHistoricalCandles(historical);
  const payloadScale = marketPriceScaleFromPayload(historical);
  const historicalMarketPrice = latestTurnoverPriceFromPayload(historical);
  const historicalClosePrice = latestClosePriceFromPayload(historical);
  const anchorPrice = chooseMarketDisplayPrice(historicalClosePrice, historicalMarketPrice);
  const snapshotPrice = asNumber(priceSnapshot.price);
  const rawCurrentPrice = snapshotPrice ?? asNumber(ta.currentPrice) ?? asNumber(realtimeLast.close ?? realtimeLast.price);
  const anchorScale = anchorPrice != null && rawCurrentPrice != null && rawCurrentPrice > 0
    ? anchorPrice / rawCurrentPrice
    : 1;
  const snapshotHistoricalScale = asNumber(priceSnapshot.historicalScale);
  const historicalScale = snapshotHistoricalScale != null && snapshotHistoricalScale > 0
    ? snapshotHistoricalScale
    : Math.abs(anchorScale - 1) >= 0.08
    ? anchorScale
    : payloadScale !== 1
      ? payloadScale
      : 1;
  const currentPrice = snapshotPrice ?? chooseMarketDisplayPrice(applyMarketPriceScale(rawCurrentPrice, historicalScale), anchorPrice);
  const ma20 = applyMarketPriceScale(asNumber(ta.sma20) ?? asNumber(ta.ema20), historicalScale);
  const ma50 = applyMarketPriceScale(asNumber(ta.sma50) ?? asNumber(ta.ema50), historicalScale);
  const ma200 = applyMarketPriceScale(asNumber(ta.sma200) ?? asNumber(ta.ema200), historicalScale);
  const volumeMa20 = asNumber(priceSnapshot.volumeMa20) ?? asNumber(ta.avgVolume20);
  const volume10 = Array.isArray(ta.volume10) ? ta.volume10 : [];
  const latestVolume = asNumber(priceSnapshot.latestVolume) ?? asNumber(realtimeLast.volume) ?? asNumber(volume10.at(-1));
  const support = normalizeHistoricalPriceWithSnapshot(asNumber(signal.stoploss), typedPriceSnapshot)
    ?? applyMarketPriceScale(readNestedNumber(ta, ["bollinger", "lower"]), historicalScale)
    ?? applyMarketPriceScale(asNumber(ta.low52w), historicalScale);
  const resistance = normalizeHistoricalPriceWithSnapshot(asNumber(signal.target), typedPriceSnapshot)
    ?? applyMarketPriceScale(readNestedNumber(ta, ["bollinger", "upper"]), historicalScale)
    ?? applyMarketPriceScale(asNumber(ta.high52w), historicalScale);
  const entry = normalizeHistoricalPriceWithSnapshot(asNumber(signal.entryPrice), typedPriceSnapshot);
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
      target: normalizeHistoricalPriceWithSnapshot(asNumber(signal.target), typedPriceSnapshot),
      stoploss: normalizeHistoricalPriceWithSnapshot(asNumber(signal.stoploss), typedPriceSnapshot),
      currentPnl: asNumber(signal.currentPnl),
      winRate: asNumber(signal.winRate),
      rrRatio: signal.rrRatio ?? null,
    },
    priceSnapshot: stripInternalFields({
      price: currentPrice,
      close: asNumber(priceSnapshot.close) ?? anchorPrice,
      previousClose: asNumber(priceSnapshot.previousClose),
      changePct: asNumber(priceSnapshot.changePct) ?? asNumber(ta.changePct),
      latestVolume,
      priceDate: priceSnapshot.priceDate ?? null,
      realtimeAt: priceSnapshot.realtimeAt ?? null,
    }),
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
  return resolveTickerCandidates(candidates);
}

async function resolveTickerCandidates(candidates: string[]) {
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

function errorTopicEnvelope(topic: string, message: string): TopicEnvelope {
  const now = new Date().toISOString();
  return {
    topic,
    value: null,
    updatedAt: now,
    expiresAt: now,
    freshness: "error",
    source: "aiden-context",
    version: "v1",
    error: { code: "topic_timeout", message, retryable: true },
  };
}

async function readTopicSoft(topic: string, context: TopicContext, timeoutMs: number) {
  try {
    return await withTimeout(readTopic(topic, context), timeoutMs, `topic:${topic}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { topic, envelope: errorTopicEnvelope(topic, message) };
  }
}

function buildTickerContext(
  ticker: string,
  envelopes: Array<{ topic: string; envelope: TopicEnvelope }>,
  databaseOverride?: {
    historical?: unknown;
    priceSnapshot?: unknown;
    ta?: unknown;
  },
) {
  const workbench = envelopes.find((item) => item.topic.startsWith("research:workbench:"))?.envelope.value;
  const standaloneTA = envelopes.find((item) => item.topic.startsWith("vn:ta:"))?.envelope.value;
  const standaloneFA = envelopes.find((item) => item.topic.startsWith("vn:fa:"))?.envelope.value;
  const priceSnapshot = envelopes.find((item) => item.topic.startsWith("vn:price-snapshot:"))?.envelope.value;
  const realtime = envelopes.find((item) => item.topic.startsWith("vn:realtime:"))?.envelope.value;
  const depth = envelopes.find((item) => item.topic.startsWith("vn:depth:"))?.envelope.value;
  const historical = databaseOverride?.historical ?? envelopes.find((item) => item.topic.startsWith("vn:historical:"))?.envelope.value;
  const wb = asRecord(workbench);
  const wbTA = asRecord(wb.ta);
  const wbFA = asRecord(wb.fa);
  const taBase = Object.keys(asRecord(standaloneTA)).length > 0 ? standaloneTA : wbTA;
  const ta = { ...asRecord(taBase), ...asRecord(databaseOverride?.ta) };
  const fa = Object.keys(asRecord(standaloneFA)).length > 0 ? standaloneFA : wbFA;
  const effectivePriceSnapshot = databaseOverride?.priceSnapshot ?? priceSnapshot ?? wb.priceSnapshot;
  const mergedWorkbench = { ...wb, ta, fa, priceSnapshot: effectivePriceSnapshot };
  const analysisMetrics = buildAnalysisMetrics(mergedWorkbench, realtime, historical, effectivePriceSnapshot);

  return {
    ticker,
    priceSnapshot: stripInternalFields(effectivePriceSnapshot ?? null),
    analysisMetrics,
    ta: stripInternalFields({
      currentPrice: asRecord(analysisMetrics).price ?? asRecord(priceSnapshot).price ?? asRecord(ta).currentPrice ?? null,
      changePct: asRecord(priceSnapshot).changePct ?? asRecord(ta).changePct ?? null,
      sma20: asRecord(asRecord(analysisMetrics).movingAverages).ma20 ?? asRecord(ta).sma20 ?? null,
      sma50: asRecord(asRecord(analysisMetrics).movingAverages).ma50 ?? asRecord(ta).sma50 ?? null,
      sma200: asRecord(asRecord(analysisMetrics).movingAverages).ma200 ?? asRecord(ta).sma200 ?? null,
      rsi14: asRecord(asRecord(analysisMetrics).momentum).rsi14 ?? asRecord(ta).rsi14 ?? null,
      avgVolume20: asRecord(asRecord(analysisMetrics).volume).volumeMa20 ?? asRecord(ta).avgVolume20 ?? null,
    }),
    fa: stripInternalFields(fa ?? null),
    signal: stripInternalFields(wb.signal ?? null),
    adnCore: stripInternalFields(wb.adnCore ?? null),
    adnArt: stripInternalFields(wb.art ?? null),
    market: stripInternalFields(wb.market ?? null),
    investor: stripInternalFields(wb.investor ?? null),
    news: stripInternalFields(Array.isArray(wb.news) ? wb.news.slice(0, 5) : []),
    realtimeSummary: stripInternalFields({
      price: asRecord(priceSnapshot).price ?? null,
      updatedAt: asRecord(priceSnapshot).realtimeAt ?? asRecord(priceSnapshot).priceDate ?? null,
    }),
    orderbook: stripInternalFields(depth ?? null),
    dataSummary: stripInternalFields({
      ...asRecord(wb.summary),
      hasAdnCore: Boolean(wb.adnCore),
      hasAdnArt: Boolean(wb.art),
    }),
  };
}

function buildRecommendation(context: unknown): AidenRecommendation | null {
  const record = asRecord(context);
  const ticker = String(record.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;

  const metrics = asRecord(record.analysisMetrics);
  const radarAction = asRecord(metrics.radarAction);
  const priceZones = asRecord(metrics.priceZones);
  const entryPrice = firstNumber(radarAction.entryPrice, priceZones.safeZoneHigh, metrics.price);
  const target = firstNumber(radarAction.target, priceZones.resistance);
  const stoploss = firstNumber(radarAction.stoploss, priceZones.support, priceZones.safeZoneLow);

  if (entryPrice == null && target == null && stoploss == null) return null;
  return { ticker, entryPrice, target, stoploss };
}

function compactSignalList(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows.slice(0, 20).map((item) => {
    const row = asRecord(item);
    return stripInternalFields({
      ticker: row.ticker,
      status: row.status,
      type: row.type,
      entryPrice: row.entryPrice,
      target: row.target,
      stoploss: row.stoploss,
      currentPrice: row.currentPrice,
      currentPnl: row.currentPnl,
      navAllocation: row.navAllocation,
      updatedAt: row.updatedAt,
    });
  });
}

async function buildGeneralMarketContext(context: TopicContext) {
  const topics = [
    "vn:index:overview",
    "signal:market:radar",
    "signal:market:active",
    "brief:morning:latest",
    "brief:eod:latest",
  ];
  const envelopes = await Promise.all(topics.map((topic) => readTopicSoft(topic, context, GENERAL_TOPIC_TIMEOUT_MS)));
  const byTopic = new Map(envelopes.map((item) => [item.topic, item.envelope.value]));

  return {
    topics,
    envelopes,
    context: stripInternalFields({
      market: byTopic.get("vn:index:overview"),
      radarSignals: compactSignalList(byTopic.get("signal:market:radar")),
      activeSignals: compactSignalList(byTopic.get("signal:market:active")),
      morningBrief: byTopic.get("brief:morning:latest"),
      eodBrief: byTopic.get("brief:eod:latest"),
    }),
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

function stripInternalSourceMentions(text: string) {
  return text
    .replace(/[^.!?\n]*(?:DataHub|FiinQuantX?|bridge|provider|backend|cache|API)[^.!?\n]*[.!?]?/giu, "")
    .replace(/[^.!?\n]*(?:nguồn|nguon|nội bộ|noi bo|hệ thống dữ liệu|he thong du lieu)[^.!?\n]*(?:dữ liệu|du lieu|thông tin|thong tin)[^.!?\n]*[.!?]?/giu, "")
    .replace(/(?:dựa trên|dua tren|theo|với|voi)\s+(?:các\s+)?(?:dữ liệu|du lieu|thông tin|thong tin)\s+(?:đã kiểm chứng|da kiem chung|hệ thống|he thong|nội bộ|noi bo)[,.]?\s*/giu, "");
}

function buildSystemInstruction() {
  return `Bạn là AIDEN của ADN Capital, trợ lý phân tích cổ phiếu Việt Nam.

Quy tắc bắt buộc:
- Chỉ dùng dữ liệu trong INTERNAL_CONTEXT. Không tự bịa giá, P/E, P/B, target, stoploss, khối lượng hoặc tin tức.
- Với mã cổ phiếu, giá hiện tại, % thay đổi, MA, volume và vùng giá phải ưu tiên analysisMetrics và priceSnapshot. Nếu raw realtime/orderbook/candle khác số này thì bỏ qua raw để tránh mâu thuẫn.
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
- Bắt buộc dùng đúng 7 heading theo thứ tự và dùng Markdown heading cấp 3: ### Phân tích cấu trúc (Biểu đồ cổ phiếu), ### Phân tích vùng giá, ### Chiến lược, ### Phân tích cơ bản, ### Kịch bản rủi ro, ### Cảnh báo, ### Kết luận.
- Sau mỗi heading phải xuống dòng trống rồi mới viết nội dung. Không viết heading và diễn giải trên cùng một dòng.
- Mỗi phần 2-5 bullet/câu ngắn. Ưu tiên bullet bắt đầu bằng "- " để tránh dính đoạn. Không viết chung chung nếu context có số; phải đưa số cụ thể.
- Phân tích cấu trúc: nêu vị trí giá so với MA20, MA50, MA200; mẫu hình hiện tại; nến gần nhất theo VSA/Wyckoff dựa vào analysisMetrics.lastCandle/recentCandles/volume.
- Phân tích vùng giá: nêu hỗ trợ, kháng cự, vùng an toàn bằng số.
- Chiến lược: có 2 kịch bản rõ ràng: nếu đang lãi và nếu đang lỗ. Mỗi kịch bản có điểm chốt lời/giảm tỷ trọng và điểm cắt lỗ hoặc điều kiện giữ lại.
- Phân tích cơ bản: mở bằng **Chỉ số định giá:** nếu context có P/E/P/B/EPS/BVPS/ROE/ROA; so với giá hiện tại và bối cảnh thị trường để đánh giá hấp dẫn hay không.
- Kịch bản rủi ro: nêu điều kiện làm phân tích thất bại, ví dụ mất MA20/MA50, volume tăng, MACD histogram xấu đi, RSI suy yếu, selling climax hoặc phân phối.
- Cảnh báo: bắt buộc có 3 dòng **Ủng hộ:**, **Tiêu cực:**, **Note:**. Mỗi dòng phải có ít nhất một số liệu hoặc điều kiện rõ.
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

function buildGeneralPrompt(message: string, context: unknown) {
  return `INTERNAL_CONTEXT:
${compactJson(context)}

OUTPUT_CONTRACT:
- Trả lời như một cửa sổ chat tư vấn đầu tư bình thường, không ép người dùng phải nhập lệnh hay chọn thẻ phân tích.
- Nếu câu hỏi là nhận định thị trường, top mã đáng chú ý, so sánh nhóm cổ phiếu hoặc "hôm nay mua mã gì", dùng bối cảnh thị trường, tín hiệu đang có và bản tin mới nhất trong INTERNAL_CONTEXT.
- Nếu nhắc mã cổ phiếu cụ thể, phân tích theo cùng phong cách AIDEN trong ADN Stock: có số liệu thực tế khi có, nêu vùng giá, chiến lược, rủi ro và kết luận hành động.
- Không bao giờ nhắc DataHub, FiinQuant, bridge, provider, API, cache, backend hoặc tên nguồn nội bộ trong câu trả lời cho khách hàng.
- Không được nói thiếu dữ liệu FA hoặc công bố nguồn lấy dữ liệu. Nếu thiếu một phần số liệu, đưa nhận định định tính thận trọng và nêu điều kiện rủi ro.
- Với câu hỏi cần biểu đồ chi tiết, trả lời ngắn gọn và hướng khách mở ADN Stock để xem chart.
- Trả lời bằng Markdown GFM hợp lệ, văn phong chuyên nghiệp, tiếng Việt có dấu, bullet rõ và không viết lan man.
- Kết thúc bằng đúng disclaimer:
⚠️ Phân tích tham khảo, không phải khuyến nghị đầu tư.
— ADN Capital 🤖

Người dùng hỏi:
${message}`;
}

function buildAidenConversationPrompt(message: string, marketContext: unknown, tickerContexts: unknown[]) {
  return `INTERNAL_CONTEXT:
${compactJson({
  market: marketContext,
  tickers: tickerContexts,
})}

OUTPUT_CONTRACT:
- Trả lời như một trợ lý đầu tư dạng ChatGPT/Gemini: hiểu câu hỏi tự nhiên, trả lời trực tiếp, không bắt khách nhập lệnh từng dòng.
- Không ép mọi câu trả lời vào 7 heading của ADN Stock. Chỉ dùng cấu trúc dài khi khách hỏi phân tích chi tiết một mã cụ thể.
- Nếu khách hỏi "hôm nay mua mã gì", "top mã đáng chú ý", "lọc cổ phiếu", ưu tiên 3-5 mã có bối cảnh tốt nhất trong INTERNAL_CONTEXT, nêu điều kiện theo dõi và rủi ro. Không bịa mã ngoài ngữ cảnh.
- Nếu khách hỏi một hoặc nhiều mã cụ thể, trả lời gọn theo các ý: nhận định nhanh, điểm đáng chú ý, rủi ro, hành động phù hợp. Dùng số liệu thực tế trong INTERNAL_CONTEXT khi có.
- Nếu khách cần biểu đồ chi tiết, gợi ý mở ADN Stock để xem chart, vùng giá và AIDEN nhận định theo mã đó.
- Không bao giờ nhắc DataHub, FiinQuant, bridge, provider, API, cache, backend hoặc tên nguồn nội bộ trong câu trả lời khách hàng.
- Không được nói thiếu dữ liệu FA, chưa có dữ liệu FA, chưa đủ dữ liệu hoặc công bố nguồn lấy dữ liệu. Nếu thiếu một phần số liệu, trả lời thận trọng theo dữ kiện đang có.
- Trả lời bằng Markdown GFM hợp lệ, tiếng Việt có dấu, ngắn gọn hơn ADN Stock, không xổ một báo cáo dài nếu khách chỉ hỏi nhanh.
- Kết thúc bằng đúng disclaimer:
⚠️ Phân tích tham khảo, không phải khuyến nghị đầu tư.
— ADN Capital 🤖

Người dùng hỏi:
${message}`;
}

function buildAidenSmalltalkPrompt(message: string) {
  return `Người dùng đang hỏi AIDEN trong cửa sổ webchat:
${message}

Yêu cầu:
- Trả lời như chatbot tự nhiên kiểu ChatGPT/Gemini, không phân tích cổ phiếu nếu người dùng chưa nêu rõ mã hoặc ý định đầu tư.
- Nếu người dùng hỏi AIDEN làm được gì, giới thiệu ngắn các năng lực: nhận định thị trường, phân tích mã khi nhập rõ ticker, so sánh mã, giải thích tín hiệu ADN và gợi ý cách đặt câu hỏi.
- Không tự suy ra ticker từ các từ tiếng Việt như "bạn", "làm", "có", "mã", "mua gì".
- Không nhắc DataHub, API, backend, provider hoặc chi tiết nội bộ.
- Trả lời bằng tiếng Việt, thân thiện, ngắn gọn.`;
}

function buildAidenHelpMessage() {
  return [
    "AIDEN là trợ lý chat của ADN Capital. Bạn có thể hỏi tự nhiên, không cần gõ lệnh.",
    "",
    "AIDEN có thể giúp:",
    "- Nhận định nhanh thị trường và bối cảnh dòng tiền.",
    "- Phân tích cổ phiếu khi bạn nêu rõ mã, ví dụ: `phân tích FPT` hoặc `mã HPG thế nào`.",
    "- So sánh nhiều mã, ví dụ: `so sánh HPG HSG`.",
    "- Giải thích tín hiệu ADN theo hướng dễ hiểu hơn.",
    "",
    "Nếu cần chart và vùng giá chi tiết, AIDEN sẽ gợi ý mở ADN Stock để xem sâu hơn.",
  ].join("\n");
}

function buildTickerFallbackLine(context: unknown) {
  const record = asRecord(context);
  const ticker = String(record.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;

  const metrics = asRecord(record.analysisMetrics);
  const movingAverages = asRecord(metrics.movingAverages);
  const momentum = asRecord(metrics.momentum);
  const radarAction = asRecord(metrics.radarAction);
  const priceZones = asRecord(metrics.priceZones);
  const price = roundedPrice(metrics.price);
  const ma20 = roundedPrice(movingAverages.ma20);
  const ma50 = roundedPrice(movingAverages.ma50);
  const rsi = asNumber(momentum.rsi14);
  const recommendation = buildRecommendation(context);
  const pieces = [
    price != null ? `giá quanh ${formatPrice(price)}` : null,
    ma20 != null ? `MA20 ${formatPrice(ma20)}` : null,
    ma50 != null ? `MA50 ${formatPrice(ma50)}` : null,
    rsi != null ? `RSI ${formatDecimal(rsi)}` : null,
    recommendation?.entryPrice != null ? `vùng mua ${formatPrice(recommendation.entryPrice)}` : null,
    recommendation?.target != null ? `mục tiêu ${formatPrice(recommendation.target)}` : roundedPrice(radarAction.target) != null ? `mục tiêu ${formatPrice(roundedPrice(radarAction.target))}` : null,
    recommendation?.stoploss != null ? `cắt lỗ ${formatPrice(recommendation.stoploss)}` : roundedPrice(priceZones.support) != null ? `hỗ trợ ${formatPrice(roundedPrice(priceZones.support))}` : null,
  ].filter(Boolean);

  return `- **${ticker}**: ${pieces.length > 0 ? pieces.join(", ") : "ưu tiên quan sát thêm phản ứng giá và thanh khoản trước khi hành động."}`;
}

function buildTickerTrendView(price: number | null, ma20: number | null, ma50: number | null, ma200: number | null) {
  if (price == null) return "Cần ưu tiên quan sát phản ứng giá và thanh khoản trước khi hành động.";
  if (ma20 != null && ma50 != null && ma200 != null) {
    if (price >= ma20 && price >= ma50 && price >= ma200) {
      return "Cấu trúc kỹ thuật đang tích cực khi giá nằm trên các đường trung bình quan trọng.";
    }
    if (price >= ma20 && (price < ma50 || price < ma200)) {
      return "Ngắn hạn đang có nỗ lực hồi phục, nhưng trung và dài hạn vẫn cần thêm xác nhận.";
    }
    if (price < ma20 && price < ma50 && price < ma200) {
      return "Cấu trúc kỹ thuật còn yếu, ưu tiên quản trị rủi ro hơn là mua đuổi.";
    }
  }
  if (ma20 != null && price >= ma20) return "Giá đang giữ được MA20, phù hợp quan sát nhịp hồi phục ngắn hạn.";
  if (ma20 != null && price < ma20) return "Giá đang dưới MA20, cần chờ lấy lại nền giá ngắn hạn trước khi tăng tỷ trọng.";
  return "Cần theo dõi thêm phản ứng giá ở vùng hỗ trợ/kháng cự gần nhất.";
}

function buildTickerActionView(input: {
  price: number | null;
  ma20: number | null;
  support: number | null;
  resistance: number | null;
  target: number | null;
  stoploss: number | null;
}) {
  const watchZone = [input.support, input.ma20].filter((value): value is number => value != null);
  const buyZone =
    watchZone.length > 0
      ? `${formatPrice(Math.min(...watchZone))} - ${formatPrice(Math.max(...watchZone))}`
      : input.price != null
        ? `quanh ${formatPrice(input.price)}`
        : "vùng nền gần nhất";
  const target = input.target ?? input.resistance;
  const stoploss = input.stoploss ?? input.support;

  return [
    `- Nếu đang có sẵn vị thế: tiếp tục nắm giữ khi giá còn giữ được vùng ${buyZone}; có thể hạ tỷ trọng nếu hồi lên kháng cự nhưng thanh khoản yếu.`,
    `- Nếu mua mới: chỉ nên thăm dò khi giá phản ứng tốt tại vùng ${buyZone}, không mua đuổi khi chưa có xác nhận dòng tiền.`,
    target != null ? `- Vùng chốt lời/kháng cự cần theo dõi: ${formatPrice(target)}.` : null,
    stoploss != null ? `- Vùng cắt lỗ/quản trị rủi ro: ${formatPrice(stoploss)}.` : null,
  ].filter(Boolean).join("\n");
}

function buildAidenTickerBriefMessage(context: unknown) {
  const record = asRecord(context);
  const ticker = String(record.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;

  const metrics = asRecord(record.analysisMetrics);
  const movingAverages = asRecord(metrics.movingAverages);
  const momentum = asRecord(metrics.momentum);
  const volume = asRecord(metrics.volume);
  const priceZones = asRecord(metrics.priceZones);
  const radarAction = asRecord(metrics.radarAction);
  const valuation = asRecord(metrics.valuation);

  const price = roundedPrice(metrics.price);
  const changePct = asNumber(metrics.changePct);
  const ma20 = roundedPrice(movingAverages.ma20);
  const ma50 = roundedPrice(movingAverages.ma50);
  const ma200 = roundedPrice(movingAverages.ma200);
  const rsi = asNumber(momentum.rsi14);
  const macdHistogram = asNumber(momentum.macdHistogram);
  const latestVolume = roundedPrice(volume.latestVolume);
  const volumeMa20 = roundedPrice(volume.volumeMa20);
  const support = roundedPrice(priceZones.support);
  const resistance = roundedPrice(priceZones.resistance);
  const target = roundedPrice(radarAction.target);
  const stoploss = roundedPrice(radarAction.stoploss);

  const pe = asNumber(valuation.pe);
  const pb = asNumber(valuation.pb);
  const eps = asNumber(valuation.eps);
  const roe = normalizePercentMetric(asNumber(valuation.roe));
  const roa = normalizePercentMetric(asNumber(valuation.roa));
  const reportDate = String(valuation.reportDate ?? "").trim();
  const valuationFacts = [
    pe != null ? `P/E ${formatDecimal(pe)}x` : null,
    pb != null ? `P/B ${formatDecimal(pb)}x` : null,
    eps != null ? `EPS ${formatDecimal(eps)}` : null,
    roe != null ? `ROE ${formatDecimal(roe)}%` : null,
    roa != null ? `ROA ${formatDecimal(roa)}%` : null,
  ].filter(Boolean);

  const maFacts = [
    ma20 != null ? `MA20 ${formatPrice(ma20)}` : null,
    ma50 != null ? `MA50 ${formatPrice(ma50)}` : null,
    ma200 != null ? `MA200 ${formatPrice(ma200)}` : null,
  ].filter(Boolean);
  const momentumFacts = [
    rsi != null ? `RSI ${formatDecimal(rsi)}` : null,
    macdHistogram != null ? `MACD Histogram ${formatDecimal(macdHistogram)}` : null,
  ].filter(Boolean);

  const trendView = buildTickerTrendView(price, ma20, ma50, ma200);
  const actionView = buildTickerActionView({ price, ma20, support, resistance, target, stoploss });

  return [
    `**Tổng hợp nhanh ${ticker}**`,
    "",
    "**1. Giá và cấu trúc kỹ thuật**",
    `- Giá hiện tại: ${price != null ? formatPrice(price) : "-"}${changePct != null ? ` (${formatPct(changePct)}%)` : ""}.`,
    maFacts.length > 0 ? `- Đường trung bình: ${maFacts.join(" · ")}.` : null,
    momentumFacts.length > 0 ? `- Động lượng: ${momentumFacts.join(" · ")}.` : null,
    latestVolume != null || volumeMa20 != null
      ? `- Thanh khoản: phiên gần nhất ${latestVolume != null ? formatPrice(latestVolume) : "-"}; trung bình 20 phiên ${volumeMa20 != null ? formatPrice(volumeMa20) : "-"}.`
      : null,
    `- Nhận định: ${trendView}`,
    "",
    "**2. Vùng giá cần theo dõi**",
    support != null ? `- Hỗ trợ: ${formatPrice(support)}.` : null,
    resistance != null ? `- Kháng cự: ${formatPrice(resistance)}.` : null,
    target != null || stoploss != null
      ? `- Vùng tham chiếu hành động: ${target != null ? `mục tiêu ${formatPrice(target)}` : "mục tiêu theo kháng cự gần nhất"}; ${stoploss != null ? `cắt lỗ ${formatPrice(stoploss)}` : "cắt lỗ theo hỗ trợ gần nhất"}.`
      : null,
    "",
    "**3. Định giá và chất lượng doanh nghiệp**",
    valuationFacts.length > 0
      ? `- Chỉ số định giá${reportDate ? ` theo kỳ báo cáo ${reportDate}` : " theo kỳ báo cáo gần nhất"}: ${valuationFacts.join(" · ")}.`
      : "- Theo kỳ báo cáo gần nhất, cần đánh giá thận trọng theo chất lượng lợi nhuận, vùng giá hiện tại và rủi ro thị trường.",
    pe != null && pb != null
      ? "- Mức định giá cần được đối chiếu với tốc độ tăng trưởng lợi nhuận và vị thế ngành; không nên chỉ nhìn riêng P/E hoặc P/B để quyết định mua."
      : null,
    "",
    "**4. Hành động phù hợp**",
    actionView,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function formatDistanceFromPrice(price: number | null, anchor: number | null) {
  const diff = pctDiff(price, anchor);
  return diff == null ? null : `${diff >= 0 ? "trên" : "dưới"} ${formatDecimal(Math.abs(diff))}%`;
}

function buildAidenStockDeterministicReport(context: unknown) {
  const record = asRecord(context);
  const ticker = String(record.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;

  const metrics = asRecord(record.analysisMetrics);
  const movingAverages = asRecord(metrics.movingAverages);
  const momentum = asRecord(metrics.momentum);
  const volume = asRecord(metrics.volume);
  const priceZones = asRecord(metrics.priceZones);
  const radarAction = asRecord(metrics.radarAction);
  const lastCandle = asRecord(metrics.lastCandle);
  const valuation = asRecord(metrics.valuation);

  const price = roundedPrice(metrics.price);
  const changePct = asNumber(metrics.changePct);
  const ma20 = roundedPrice(movingAverages.ma20);
  const ma50 = roundedPrice(movingAverages.ma50);
  const ma200 = roundedPrice(movingAverages.ma200);
  const rsi = asNumber(momentum.rsi14);
  const macdHistogram = asNumber(momentum.macdHistogram);
  const latestVolume = roundedPrice(volume.latestVolume);
  const volumeMa20 = roundedPrice(volume.volumeMa20);
  const volumeVsMa20 = asNumber(volume.volumeVsMa20);
  const support = roundedPrice(priceZones.support);
  const resistance = roundedPrice(priceZones.resistance);
  const target = roundedPrice(radarAction.target);
  const stoploss = roundedPrice(radarAction.stoploss);

  const pe = asNumber(valuation.pe);
  const pb = asNumber(valuation.pb);
  const eps = asNumber(valuation.eps);
  const bvps = asNumber(valuation.bookValuePerShare);
  const roe = normalizePercentMetric(asNumber(valuation.roe));
  const roa = normalizePercentMetric(asNumber(valuation.roa));
  const reportDate = String(valuation.reportDate ?? "").trim();
  const valuationFacts = [
    pe != null ? `P/E ${formatDecimal(pe)}x` : null,
    pb != null ? `P/B ${formatDecimal(pb)}x` : null,
    eps != null ? `EPS ${formatDecimal(eps)} đồng/cp` : null,
    bvps != null ? `BVPS ${formatDecimal(bvps)} đồng/cp` : null,
    roe != null ? `ROE ${formatDecimal(roe)}%` : null,
    roa != null ? `ROA ${formatDecimal(roa)}%` : null,
  ].filter(Boolean);

  const priceVsMa20 = formatDistanceFromPrice(price, ma20);
  const priceVsMa50 = formatDistanceFromPrice(price, ma50);
  const priceVsMa200 = formatDistanceFromPrice(price, ma200);
  const bodyPct = asNumber(lastCandle.bodyPct);
  const candleDirection = firstText(lastCandle.direction);
  const candleDate = firstText(lastCandle.date);
  const trendView = buildTickerTrendView(price, ma20, ma50, ma200);
  const actionView = buildTickerActionView({ price, ma20, support, resistance, target, stoploss });

  return [
    `### Phân tích cấu trúc (Biểu đồ cổ phiếu)`,
    `- Giá hiện tại ${price != null ? formatPrice(price) : "đang cập nhật"}${changePct != null ? `, biến động ${formatPct(changePct)}%` : ""}. ${[
      ma20 != null ? `so với MA20 ${formatPrice(ma20)}${priceVsMa20 ? ` (${priceVsMa20})` : ""}` : null,
      ma50 != null ? `so với MA50 ${formatPrice(ma50)}${priceVsMa50 ? ` (${priceVsMa50})` : ""}` : null,
      ma200 != null ? `so với MA200 ${formatPrice(ma200)}${priceVsMa200 ? ` (${priceVsMa200})` : ""}` : null,
    ].filter(Boolean).join(", ")}.`,
    candleDirection || bodyPct != null || volumeVsMa20 != null
      ? `- Nến gần nhất${candleDate ? ` (${candleDate})` : ""} ${candleDirection === "down" ? "giảm" : candleDirection === "up" ? "tăng" : "cân bằng"}${bodyPct != null ? `, thân nến ${formatDecimal(bodyPct)}%` : ""}${latestVolume != null ? `, thanh khoản ${formatPrice(latestVolume)}` : ""}${volumeVsMa20 != null ? `, bằng ${formatDecimal(volumeVsMa20 * 100)}% so với MA20 volume` : ""}.`
      : null,
    `- RSI${rsi != null ? ` ${formatDecimal(rsi)}` : ""}${macdHistogram != null ? `, MACD histogram ${formatDecimal(macdHistogram)}` : ""}.`,
    `- ${trendView}`,
    "",
    `### Phân tích vùng giá`,
    support != null || resistance != null
      ? [
          `- Hỗ trợ: ${support != null ? formatPrice(support) : "vùng nền gần nhất"}.`,
          `- Kháng cự: ${resistance != null ? formatPrice(resistance) : "vùng cản gần nhất"}.`,
        ].join("\n")
      : "- Ưu tiên quan sát vùng nền gần nhất và phản ứng thanh khoản trước khi tăng tỷ trọng.",
    ma20 != null ? `- Vùng cần lấy lại/giữ vững: quanh MA20 ${formatPrice(ma20)}.` : null,
    "",
    `### Chiến lược`,
    actionView,
    "",
    `### Phân tích cơ bản`,
    valuationFacts.length > 0
      ? `**Chỉ số định giá:** ${valuationFacts.join(" · ")}${reportDate ? ` theo kỳ báo cáo gần nhất ${reportDate}` : " theo kỳ báo cáo gần nhất"}.`
      : "Theo kỳ báo cáo gần nhất, nên đánh giá thận trọng bằng chất lượng lợi nhuận, vị thế ngành và vùng giá hiện tại.",
    pe != null && pb != null ? "Mức định giá cần được đối chiếu với tốc độ tăng trưởng lợi nhuận và dòng tiền thực tế, không nên chỉ nhìn riêng P/E hoặc P/B." : null,
    "",
    `### Kịch bản rủi ro`,
    stoploss != null
      ? `- Rủi ro tăng nếu giá mất vùng ${formatPrice(stoploss)} hoặc hồi lên nhưng thanh khoản suy yếu.`
      : support != null
        ? `- Rủi ro tăng nếu giá mất vùng hỗ trợ ${formatPrice(support)}.`
        : "- Rủi ro tăng nếu giá mất nền hỗ trợ gần nhất hoặc thị trường chung suy yếu.",
    macdHistogram != null && macdHistogram < 0 ? `- MACD histogram âm (${formatDecimal(macdHistogram)}) cho thấy xung lực cần thêm xác nhận.` : null,
    "",
    `### Cảnh báo`,
    `- Ủng hộ: giá giữ được vùng ${ma20 != null ? formatPrice(ma20) : support != null ? formatPrice(support) : "nền gần nhất"} với thanh khoản cải thiện.`,
    `- Tiêu cực: mất ${support != null ? formatPrice(support) : "vùng hỗ trợ gần nhất"} hoặc thanh khoản tăng mạnh trong phiên giảm.`,
    `Note: ${latestVolume != null ? `khối lượng gần nhất ${formatPrice(latestVolume)}` : "cần theo dõi thêm khối lượng xác nhận"}${volumeMa20 != null ? `, MA20 volume ${formatPrice(volumeMa20)}` : ""}.`,
    "",
    `### Kết luận`,
    price != null && ma20 != null && price >= ma20
      ? `- Hành động: có thể tiếp tục quan sát/nắm giữ có điều kiện, ưu tiên quản trị rủi ro tại vùng hỗ trợ.`
      : `- Hành động: chưa mua đuổi, chờ giá lấy lại vùng kỹ thuật quan trọng và có xác nhận dòng tiền.`,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function buildAidenConversationFallbackMessage(message: string, marketContext: unknown, tickerContexts: unknown[]) {
  if (tickerContexts.length === 0) return buildGeneralFallbackMessage(message, marketContext);

  const lines = tickerContexts
    .map((context) => buildTickerFallbackLine(context))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);

  return `AIDEN ghi nhận các mã anh/chị đang hỏi và ưu tiên cách tiếp cận thận trọng:

${lines.length > 0 ? lines.join("\n") : "- Chưa nên mua đuổi. Ưu tiên chờ nền giá và dòng tiền xác nhận rõ hơn."}

**Hành động phù hợp:** nếu cần xem vùng giá chi tiết theo từng mã, mở ADN Stock để đối chiếu chart, vùng mua, mục tiêu và cắt lỗ.`;
}

function signalLine(item: unknown) {
  const row = asRecord(item);
  const ticker = String(row.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;
  const currentPrice = roundedPrice(row.currentPrice);
  const entryPrice = roundedPrice(row.entryPrice);
  const target = roundedPrice(row.target);
  const stoploss = roundedPrice(row.stoploss);
  const pieces = [
    currentPrice != null ? `giá quanh ${formatPrice(currentPrice)}` : null,
    entryPrice != null ? `vùng mua ${formatPrice(entryPrice)}` : null,
    target != null ? `mục tiêu ${formatPrice(target)}` : null,
    stoploss != null ? `cắt lỗ ${formatPrice(stoploss)}` : null,
  ].filter(Boolean);
  return `- **${ticker}**: ${pieces.length > 0 ? pieces.join(", ") : "đang trong danh sách cần theo dõi, ưu tiên chờ xác nhận dòng tiền."}`;
}

function buildGeneralFallbackMessage(message: string, context: unknown) {
  const record = asRecord(context);
  const signals = [
    ...(Array.isArray(record.activeSignals) ? record.activeSignals : []),
    ...(Array.isArray(record.radarSignals) ? record.radarSignals : []),
  ];
  const seen = new Set<string>();
  const lines = signals
    .map((item) => {
      const ticker = String(asRecord(item).ticker ?? "").trim().toUpperCase();
      if (!ticker || seen.has(ticker)) return null;
      seen.add(ticker);
      return signalLine(item);
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);

  const lower = message.toLowerCase();
  const asksForIdeas = /mua|top|mã gì|cổ nào|cơ hội|lọc/i.test(lower);
  const intro = asksForIdeas
    ? "AIDEN ưu tiên cách tiếp cận chọn lọc, chỉ xem xét các mã có vùng giá và rủi ro đủ rõ:"
    : "AIDEN ghi nhận thị trường cần ưu tiên quản trị rủi ro và chọn mã theo tín hiệu xác nhận:";

  const body = lines.length > 0
    ? lines.join("\n")
    : "- Chưa nên mua đuổi. Ưu tiên quan sát cổ phiếu giữ được nền giá, thanh khoản cải thiện và không thủng vùng hỗ trợ gần nhất.";

  return `${intro}

${body}

**Hành động phù hợp:** giải ngân từng phần, giữ tỷ trọng thấp nếu thị trường chưa xác nhận xu hướng rõ. Với từng mã cụ thể, mở ADN Stock để xem biểu đồ, vùng mua, mục tiêu và cắt lỗ chi tiết.`;
}

function buildFlashUnavailableMessage(contexts: unknown[]) {
  if (contexts.length === 1) {
    const deterministicReport = buildAidenStockDeterministicReport(contexts[0]);
    if (deterministicReport) return deterministicReport;
  }

  const statusLines = contexts.map((item) => {
    const record = asRecord(item);
    const ticker = String(record.ticker ?? "Mã cổ phiếu");
    const summary = asRecord(record.dataSummary);
    const parts = [
      `PTKT ${summary.hasTA ? "đã sẵn sàng" : "đang cập nhật"}`,
      `định giá ${summary.hasFA ? "đã sẵn sàng" : "theo kỳ báo cáo gần nhất"}`,
      `dòng tiền ${summary.hasInvestorFlow ? "đã sẵn sàng" : "đang cập nhật"}`,
      `tín hiệu ${summary.hasSignal ? "đã sẵn sàng" : "đang cập nhật"}`,
      `ADNCore ${summary.hasAdnCore ? "đã sẵn sàng" : "đang cập nhật"}`,
      `ADN ART ${summary.hasAdnArt ? "đã sẵn sàng" : "đang cập nhật"}`,
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
  return stripInternalSourceMentions(stripSourceFraming(text))
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

function buildCoreArtLine(contexts: unknown[]) {
  const context = asRecord(contexts[0]);
  const metrics = asRecord(context.analysisMetrics);
  const core = asRecord(metrics.adnCore ?? context.adnCore);
  const art = asRecord(metrics.adnArt ?? context.adnArt);

  const rawCoreScore = asNumber(core.score ?? core.totalScore ?? core.value);
  const rawCoreMax = asNumber(core.max_score ?? core.maxScore ?? core.max) ?? 10;
  const coreScore = rawCoreScore != null && rawCoreMax > 0 && rawCoreMax !== 10
    ? Number(((rawCoreScore / rawCoreMax) * 10).toFixed(1))
    : rawCoreScore;
  const coreMax = 10;
  const coreStatus = firstText(core.status_badge, core.statusBadge, core.status, core.action_message, core.actionMessage);
  const corePieces = [
    coreScore != null ? `${formatDecimal(coreScore)}/${formatDecimal(coreMax)}` : null,
    coreStatus,
  ].filter(Boolean);

  const artScore = asNumber(art.rpi_current ?? art.tei ?? art.score ?? art.value);
  const artMa7 = asNumber(art.ma7 ?? art.ma_7 ?? art.artMa7);
  const artStatus = firstText(art.status_badge, art.statusBadge, art.status, art.action_message, art.actionMessage);
  const artPieces = [
    artScore != null ? `${formatDecimal(artScore)}${artMa7 != null ? `; MA7 ${formatDecimal(artMa7)}` : ""}` : null,
    artStatus,
  ].filter(Boolean);

  const pieces = [
    corePieces.length > 0 ? `ADNCore: ${corePieces.join(" · ")}` : null,
    artPieces.length > 0 ? `ADN ART: ${artPieces.join(" · ")}` : null,
  ].filter(Boolean);

  return pieces.length > 0 ? `**ADNCore và ADN ART:** ${pieces.join("; ")}.` : null;
}

function ensureCoreArtLine(answer: string, contexts: unknown[]) {
  if (/\bADNCore\b|\bADN ART\b/i.test(answer)) return answer;
  const line = buildCoreArtLine(contexts);
  return line ? `${answer.trim()}\n\n${line}` : answer;
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

async function loadTickerContexts(tickers: string[], context: TopicContext) {
  return Promise.all(
    tickers.map(async (ticker) => {
      const topics = [
        `research:workbench:${ticker}`,
        `vn:price-snapshot:${ticker}`,
        `vn:ta:${ticker}`,
        `vn:fa:${ticker}`,
        `vn:realtime:${ticker}:5m`,
        `vn:historical:${ticker}:1d`,
        `vn:depth:${ticker}`,
      ];
      const [envelopes, databaseHistorical] = await Promise.all([
        Promise.all(topics.map((topic) => readTopicSoft(topic, context, TICKER_TOPIC_TIMEOUT_MS))),
        loadDatabaseV2DailyPayload(ticker).catch((error) => {
          console.warn("[AIDEN] Database v2 chart context unavailable:", ticker, error);
          return null;
        }),
      ]);
      const databaseCandles = normalizeHistoricalCandles(databaseHistorical);
      const databasePriceSnapshot = databaseHistorical
        ? await loadDatabaseV2PriceSnapshot(ticker, databaseHistorical).catch((error) => {
            console.warn("[AIDEN] Database v2 price context unavailable:", ticker, error);
            return null;
          })
        : null;
      const databaseTa = databaseCandles.length ? buildIndicatorsFromCandles(databaseCandles) : null;
      return {
        ticker,
        topics: databaseHistorical ? [`database:v2:chart:${ticker}`, ...topics] : topics,
        envelopes,
        context: buildTickerContext(ticker, envelopes, {
          historical: databaseHistorical ?? undefined,
          priceSnapshot: databasePriceSnapshot ?? undefined,
          ta: databaseTa ?? undefined,
        }),
      };
    }),
  );
}

function collectFreshness(
  items: Array<{ envelopes: Array<{ topic: string; envelope: TopicEnvelope }> }>,
  extra: Array<{ topic: string; envelope: TopicEnvelope }> = [],
) {
  return Object.fromEntries([
    ...extra.map(({ topic, envelope }) => [topic, envelope.freshness] as const),
    ...items.flatMap((item) => item.envelopes.map(({ topic, envelope }) => [topic, envelope.freshness] as const)),
  ]);
}

function emitAidenFallback(event: string, error: unknown, meta: ObservabilityMeta = {}) {
  const message = error instanceof Error ? error.message : String(error);
  emitObservabilityEvent({
    domain: "aiden",
    event,
    level: "warn",
    meta: {
      ...meta,
      error: message,
    },
  });
}

function isInvestmentIntent(intent: AidenIntent) {
  return intent !== "smalltalk";
}

function readOpenAiAssistantContent(payload: unknown) {
  const choices = asRecord(payload).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = asRecord(asRecord(choices[0]).message);
  const content = message.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const text = asRecord(part).text;
        return typeof text === "string" ? text : "";
      })
      .join("")
      .trim();
  }
  return "";
}

async function executeAidenFreemodelRequest(prompt: string, systemInstruction: string) {
  const apiKey = process.env.FREEMODEL_API_KEY;
  if (!apiKey) throw new Error("FREEMODEL_API_KEY is missing");

  const response = await fetch(`${AIDEN_FREEMODEL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AIDEN_FREEMODEL_MODEL,
      stream: false,
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(AIDEN_FREEMODEL_TIMEOUT_MS),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = asRecord(asRecord(payload).error).message ?? asRecord(payload).message ?? text;
    throw new Error(`FreeModel HTTP ${response.status}: ${String(error).slice(0, 180)}`);
  }
  const output = readOpenAiAssistantContent(payload);
  if (!output) throw new Error("FreeModel returned empty assistant response");
  return output;
}

export function finalizeAidenPreparedAnswer(answer: string, turn: AidenDatahubPreparedTurn) {
  let finalAnswer = answer.trim();
  if (!isInvestmentIntent(turn.intent)) {
    return finalAnswer;
  }

  if (turn.tickerContexts.length > 0) {
    finalAnswer = ensureCoreArtLine(ensureValuationLine(finalAnswer, turn.tickerContexts), turn.tickerContexts);
  }

  const sanitized = sanitizeCustomerAnswer(finalAnswer);
  return ensureDisclaimer(sanitized);
}

export async function prepareAidenDatahubTurn(input: {
  message: string;
  currentTicker?: string | null;
  context?: TopicContext;
  surface?: AidenSurface | string | null;
}): Promise<AidenDatahubPreparedTurn> {
  const message = input.message.trim();
  const context = input.context ?? {};
  const surface: AidenSurface = input.surface === "stock" ? "stock" : "aiden";
  const systemInstruction = buildSystemInstruction();

  if (surface === "aiden") {
    const intentResult = classifyAidenIntent(message);
    let intent = intentResult.intent;
    let tickers =
      intent === "ticker_analysis" || intent === "compare"
        ? await resolveTickerCandidates(intentResult.candidates)
        : [];
    if ((intent === "ticker_analysis" || intent === "compare") && tickers.length === 0) {
      intent = "smalltalk";
      tickers = [];
    }

    if (intent === "smalltalk") {
      return {
        message,
        intent,
        tickers: [],
        recommendation: null,
        usedTopics: [],
        model: MODEL_FLASH,
        dataFreshness: {},
        prompt: buildAidenSmalltalkPrompt(message),
        staticMessage: buildAidenHelpMessage(),
        fallbackMessage: buildAidenHelpMessage(),
        systemInstruction,
        tickerContexts: [],
      };
    }

    const general = await buildGeneralMarketContext(context);
    const perTicker = tickers.length > 0 ? await loadTickerContexts(tickers, context) : [];
    const tickerContexts = perTicker.map((item) => item.context);
    const deterministicTickerBrief =
      intent === "ticker_analysis" && tickerContexts.length === 1
        ? buildAidenTickerBriefMessage(tickerContexts[0])
        : null;

    return {
      message,
      intent,
      ticker: tickers[0],
      tickers,
      recommendation: tickerContexts.length === 1 ? buildRecommendation(tickerContexts[0]) : null,
      usedTopics: [...general.topics, ...perTicker.flatMap((item) => item.topics)],
      model: MODEL_FLASH,
      dataFreshness: collectFreshness(perTicker, general.envelopes),
      prompt: deterministicTickerBrief ? undefined : buildAidenConversationPrompt(message, general.context, tickerContexts),
      staticMessage: deterministicTickerBrief ?? undefined,
      fallbackMessage: buildAidenConversationFallbackMessage(message, general.context, tickerContexts),
      systemInstruction,
      tickerContexts,
    };
  }

  const tickers = await resolveTickers(message, input.currentTicker);
  if (tickers.length === 0) {
    const general = await buildGeneralMarketContext(context);
    const dataFreshness = Object.fromEntries(
      general.envelopes.map(({ topic, envelope }) => [topic, envelope.freshness]),
    );
    return {
      message,
      intent: "general_market",
      tickers: [],
      recommendation: null,
      usedTopics: general.topics,
      model: MODEL_FLASH,
      dataFreshness,
      prompt: buildGeneralPrompt(message, general.context),
      fallbackMessage: buildGeneralFallbackMessage(message, general.context),
      systemInstruction,
      tickerContexts: [],
    };
  }

  const perTicker = await loadTickerContexts(tickers, context);
  const contexts = perTicker.map((item) => item.context);
  const deterministicTickerReport = contexts.length === 1 ? buildAidenStockDeterministicReport(contexts[0]) : null;
  return {
    message,
    intent: contexts.length >= 2 ? "compare" : "ticker_analysis",
    ticker: tickers[0],
    tickers,
    recommendation: buildRecommendation(contexts[0]),
    usedTopics: perTicker.flatMap((item) => item.topics),
    model: MODEL_FLASH,
    dataFreshness: collectFreshness(perTicker),
    prompt: deterministicTickerReport ? undefined : buildPrompt(message, contexts),
    staticMessage: deterministicTickerReport ?? undefined,
    fallbackMessage: deterministicTickerReport ?? buildFlashUnavailableMessage(contexts),
    systemInstruction,
    tickerContexts: contexts,
  };
}

async function completeAidenPreparedTurn(turn: AidenDatahubPreparedTurn, surface: AidenSurface): Promise<AidenDatahubChatResult> {
  let answer: string;
  if (turn.staticMessage) {
    answer = turn.staticMessage;
  } else if (turn.prompt) {
    try {
      answer = await withTimeout(
        executeAidenFreemodelRequest(turn.prompt, turn.systemInstruction),
        Math.min(GENERAL_CHAT_TIMEOUT_MS, AIDEN_FREEMODEL_TIMEOUT_MS),
        `${surface}-aiden`,
      );
    } catch (error) {
      console.warn("[AIDEN] FreeModel generation failed:", error);
      emitAidenFallback(`${surface}_fallback`, error, {
        surface,
        tickerCount: turn.tickerContexts.length,
        timeoutMs: Math.min(GENERAL_CHAT_TIMEOUT_MS, AIDEN_FREEMODEL_TIMEOUT_MS),
        model: AIDEN_FREEMODEL_MODEL,
      });
      answer = turn.fallbackMessage;
    }
  } else {
    answer = turn.fallbackMessage;
  }

  return {
    message: finalizeAidenPreparedAnswer(answer, turn),
    ticker: turn.ticker,
    tickers: turn.tickers,
    recommendation: turn.recommendation,
    usedTopics: turn.usedTopics,
    model: turn.staticMessage ? turn.model : AIDEN_FREEMODEL_MODEL,
    dataFreshness: turn.dataFreshness,
    intent: turn.intent,
  };
}

export async function runAidenDatahubChat(input: {
  message: string;
  currentTicker?: string | null;
  context?: TopicContext;
  surface?: AidenSurface | string | null;
}): Promise<AidenDatahubChatResult> {
  const surface: AidenSurface = input.surface === "stock" ? "stock" : "aiden";
  const turn = await prepareAidenDatahubTurn(input);
  return completeAidenPreparedTurn(turn, surface);
}
