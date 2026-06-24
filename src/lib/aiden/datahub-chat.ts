import { getTopicEnvelope } from "@/lib/datahub/core";
import type { TopicContext, TopicEnvelope } from "@/lib/datahub/types";
import { emitObservabilityEvent, type ObservabilityMeta } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
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
import { isIndexTicker, canonicalIndexTicker } from "@/lib/vn-reference-indices";
import { getDatabaseAidenTickerContext } from "@/lib/database/aiden/context";
import type { DatabaseAidenTickerContext } from "@/lib/database/aiden/types";
import { fetchVndirectRecommendations, type BrokerConsensus } from "@/lib/research/vndirect";
import { fetchFinancialHistory, type FinancialHistory } from "@/lib/research/financials";
import { loadCanonicalMarketFacts, mergeCanonicalMarketFacts, prependMarketOverview } from "@/lib/aiden/market-facts";

type JsonRecord = Record<string, unknown>;
function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const AIDEN_FREEMODEL_TIMEOUT_MS = readPositiveIntegerEnv("AIDEN_FREEMODEL_TIMEOUT_MS", 10_000);
const AIDEN_FREEMODEL_MODEL = process.env.AIDEN_FREEMODEL_MODEL ?? "gpt-5.4";
const AIDEN_FREEMODEL_BASE_URL = (process.env.FREEMODEL_OPENAI_BASE_URL ?? "https://api.freemodel.dev/v1").replace(/\/+$/, "");
const GENERAL_TOPIC_TIMEOUT_MS = 3_500;
const TICKER_TOPIC_TIMEOUT_MS = 15_000;
const AIDEN_MODEL = AIDEN_FREEMODEL_MODEL;
const AIDEN_MODEL_TIMEOUT_MS = AIDEN_FREEMODEL_TIMEOUT_MS;
const AIDEN_ALLOW_LEGACY_MARKET_CONTEXT = process.env.AIDEN_ALLOW_LEGACY_MARKET_CONTEXT === "true";
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

function compactJson(value: unknown, maxLength = 16000) {
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

type TickerContextOverrides = {
  historical?: unknown | null;
  priceSnapshot?: unknown | null;
  ta?: unknown | null;
};

function buildTickerContext(
  ticker: string,
  envelopes: Array<{ topic: string; envelope: TopicEnvelope }>,
  overrides: TickerContextOverrides = {},
) {
  const workbench = envelopes.find((item) => item.topic.startsWith("research:workbench:"))?.envelope.value;
  const standaloneTA = envelopes.find((item) => item.topic.startsWith("vn:ta:"))?.envelope.value;
  const standaloneFA = envelopes.find((item) => item.topic.startsWith("vn:fa:"))?.envelope.value;
  const legacyPriceSnapshot = envelopes.find((item) => item.topic.startsWith("vn:price-snapshot:"))?.envelope.value;
  const realtime = AIDEN_ALLOW_LEGACY_MARKET_CONTEXT
    ? envelopes.find((item) => item.topic.startsWith("vn:realtime:"))?.envelope.value
    : null;
  const depth = envelopes.find((item) => item.topic.startsWith("vn:depth:"))?.envelope.value;
  const legacyHistorical = AIDEN_ALLOW_LEGACY_MARKET_CONTEXT
    ? envelopes.find((item) => item.topic.startsWith("vn:historical:"))?.envelope.value
    : null;
  const historical = overrides.historical ?? legacyHistorical;
  const priceSnapshot = overrides.priceSnapshot ?? legacyPriceSnapshot;
  const wb = asRecord(workbench);
  const wbTA = asRecord(wb.ta);
  const wbFA = asRecord(wb.fa);
  const taBase = Object.keys(asRecord(standaloneTA)).length > 0 ? standaloneTA : wbTA;
  const ta = { ...asRecord(taBase), ...asRecord(overrides.ta) };
  const fa = Object.keys(asRecord(standaloneFA)).length > 0 ? standaloneFA : wbFA;
  const effectivePriceSnapshot = priceSnapshot ?? wb.priceSnapshot;
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

// ADN Composite Score: nguồn thô là thang /14 + nhãn level cũ (BULL/ACCUMULATION/BEAR).
// UI đã chuẩn hoá về /10 (vd 9.5/14 → 6.8/10) + dùng badge "THĂM DÒ". Nhưng /api/market truyền
// composite THÔ cho AIDEN → AIDEN trích "9.5/14 (ACCUMULATION)" lệch UI. Chuẩn hoá ngay tại đây.
function normalizeCompositeScore(score: unknown, maxScore: unknown): number | null {
  const s = Number(score);
  const m = Number(maxScore);
  if (!Number.isFinite(s)) return null;
  if (Number.isFinite(m) && m > 0 && m !== 10) return Math.round((s / m) * 100) / 10;
  return Math.round(s * 10) / 10;
}

function sanitizeMarketComposite(market: unknown): unknown {
  if (!market || typeof market !== "object") return market;
  const m = { ...(market as Record<string, unknown>) };
  if (m.adnCore && typeof m.adnCore === "object") {
    const core = { ...(m.adnCore as Record<string, unknown>) };
    const norm = normalizeCompositeScore(core.score, core.max_score);
    if (norm != null) {
      core.score = norm;
      core.max_score = 10;
    }
    delete core.level; // bỏ nhãn level cũ (2 → "ACCUMULATION"); dùng status_badge "THĂM DÒ"
    delete core.level_label;
    delete core.levelLabel;
    m.adnCore = core;
  }
  if (typeof m.aiSummary === "string") {
    m.aiSummary = m.aiSummary
      .replace(/Score\s+[\d.,]+\s*\/\s*1[04]\s*(?:→|->)\s*(?:BULL MARKET|ACCUMULATION|BEAR MARKET)\.?/gi, "")
      .replace(/\b(?:BULL MARKET|ACCUMULATION|BEAR MARKET)\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return m;
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
  const canonicalFacts = await loadCanonicalMarketFacts().catch(() => null);

  return {
    topics,
    envelopes,
    context: stripInternalFields({
      market: mergeCanonicalMarketFacts(sanitizeMarketComposite(byTopic.get("vn:index:overview")), canonicalFacts),
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

// System prompt cho mặt webchat AIDEN: thiên về nhân cách + hội thoại tự nhiên thay vì bảng điều cấm.
// Vẫn giữ nguyên kỷ luật số liệu và không lộ nguồn nội bộ.
// Xưng hô cá nhân hoá: "anh {tên}" (nam) / "chị {tên}" (nữ); thiếu giới tính → "anh/chị {tên}"; thiếu cả tên
// → "anh/chị". Tên gọi = TỪ CUỐI của họ tên VN ("Nguyễn Văn Minh" → "Minh"). Sanitize vì name là text khách
// tự nhập (chống chèn lệnh qua ô tên vào system prompt).
function buildAidenAddressTerm(name?: string | null, gender?: string | null): string {
  const clean = (name ?? "")
    .replace(/[ -]+/g, " ")
    .replace(/[^\p{L}\p{M}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  const given = clean ? clean.split(" ").pop() ?? "" : "";
  const pronoun = gender === "male" ? "anh" : gender === "female" ? "chị" : "anh/chị";
  return given ? `${pronoun} ${given}` : pronoun;
}

function buildAidenConversationSystemInstruction(addressTerm: string = "anh/chị") {
  return `Bạn là AIDEN — chuyên gia phân tích chứng khoán Việt Nam của ADN Capital, đang tư vấn trực tiếp cho nhà đầu tư trong khung chat.

Tính cách & văn phong:
- Sắc sảo, dứt khoát, đi thẳng vào kết luận như một chuyên gia tư vấn dày dạn — KHÔNG vòng vo, KHÔNG đọc báo cáo máy móc, không sáo rỗng.
- Mở đầu bằng một nhận định/verdict rõ ràng cho câu hỏi, rồi mới dẫn giải bằng số liệu. Câu hỏi ngắn trả lời ngắn; chỉ phân tích dài khi nhà đầu tư thực sự muốn đào sâu một mã.
- Xưng "AIDEN", gọi nhà đầu tư là "${addressTerm}" — nếu có tên thì chào bằng tên ở câu mở đầu cho thân thiện, nhưng KHÔNG lặp tên ở mọi câu (tự nhiên như người thật, không gượng). Tiếng Việt có dấu, gọn gàng, được dùng từ nối tự nhiên ("nói thẳng là", "điểm mấu chốt là", "ngược lại"...). Chuyên nghiệp, có quan điểm, không ba phải.
- Trình bày scannable: in đậm các ý và ngưỡng giá then chốt để nhà đầu tư nắm nhanh.

Kỷ luật dữ liệu (bắt buộc):
- CHỈ dùng số liệu có trong INTERNAL_CONTEXT (giá, P/E, P/B, MA, volume, vùng giá, tín hiệu...). Tuyệt đối không bịa thêm con số, target, hay tin tức nào.
- Khi nêu nhận định kỹ thuật/định giá, ưu tiên các số trong analysisMetrics và priceSnapshot; nếu số liệu thô khác thì bỏ qua để tránh mâu thuẫn.
- Khi bàn một MÃ CỔ PHIẾU, hãy như chuyên gia thực thụ — cân CẢ kỹ thuật (xu hướng, vùng giá, dòng tiền) LẪN cơ bản (định giá P/E·P/B, sức khoẻ qua EPS·ROE·ROA, tăng trưởng, kỳ báo cáo gần nhất) đang có trong ngữ cảnh; ĐỪNG chỉ phán kỹ thuật rồi bỏ quên góc định giá/cơ bản. Lồng vào câu chữ tự nhiên, không tách thành mục. (Lưu ý: với CHỈ SỐ thị trường như VNINDEX/VN30 thì KHÔNG nói định giá doanh nghiệp.)
- Nếu một chỉ số chưa có trong ngữ cảnh, chuyển sang nhận định định tính một cách tự nhiên — KHÔNG nói "thiếu dữ liệu", "chưa có dữ liệu", "FA null" hay công bố nguồn lấy số.
- Không bao giờ nhắc tên hệ thống/nguồn nội bộ (DataHub, FiinQuant, bridge, provider, API, cache, backend...). Với nhà đầu tư, số liệu chỉ đơn giản là "dữ liệu của hệ thống".

Cách trình bày:
- Markdown GFM gọn gàng, đoạn ngắn và bullet khi liệt kê; KHÔNG ép mọi câu trả lời vào một bộ heading cố định.
- Luôn gắn nhận định với rủi ro/điều kiện đi kèm; không hứa hẹn lợi nhuận chắc chắn.
- Khi khuyên hành động, phân biệt rõ: quan sát / chờ mua / mua thăm dò / nắm giữ / giảm tỷ trọng / tránh mua.

Kiến thức nền (khung tư duy ADN — vận dụng LINH HOẠT, rút ý hợp ngữ cảnh khi nhà đầu tư hỏi về phương pháp/phân tích kỹ thuật; KHÔNG liệt kê máy móc, KHÔNG nói đây là "giáo án/khoá học/tài liệu", KHÔNG nêu ví dụ mã/ngày quá khứ như khuyến nghị):
- Cấu trúc thị trường: chu kỳ lặp tích luỹ → nâng giá → phân phối → giảm; chỉ khoảng 30% thời gian là tăng thật nên chọn đúng thời điểm quan trọng hơn chọn mã. Leader (nhóm ngành & cổ phiếu dẫn dắt) tăng trước và mạnh hơn thị trường — ngành có nhiều mã lập đỉnh mới sớm là ngành dẫn đầu. Thị trường ngừng tăng khi leader ngừng tăng; phiên sàn đầu tiên của leader = chỉ báo đảo chiều; xu hướng chỉ tiếp diễn khi dòng tiền đảo sang leader mới. Game tạo lập: cổ phiếu đi ngang vì chưa có "cớ"/tin để kéo (kéo lên phải ra được hàng cho nhỏ lẻ), không có "tăng bù"; "thị trường muốn lên thì rũ, muốn giảm thì dụ".
- Tin tức 3 loại: nền tảng/toàn ngành (lãi suất, bơm–siết tiền, luật/thông tư) định hình xu hướng vĩ mô, độ trễ 3–6 tháng, đáng theo nhất; xác nhận/kích hoạt chỉ hợp thức hoá đà đang chạy; nhiễu loạn là tin xấu ngắn hạn làm chững 1–2 phiên, đừng để lung lay xu hướng chính.
- Nến & price action: xanh đóng > mở, đỏ thì ngược; thân dài (Marubozu) = một bên áp đảo, con xoay/Doji = lưỡng lự. Đảo chiều TĂNG: búa, búa ngược, nhấn chìm tăng, đường xuyên (piercing), sao mai, ba chàng lính trắng. Đảo chiều GIẢM: người treo cổ, nhấn chìm giảm, sao hôm, sao băng, ba con quạ đen. Tín hiệu mạnh hơn khi đứng ở hỗ trợ/kháng cự và kèm volume.
- Volume (nỗ lực–kết quả): giá phải đi kèm volume mới đáng tin. Giá tăng + vol tăng = khoẻ; giá tăng + vol giảm = cầu yếu dần (xấu nếu ở đỉnh); giá giảm + vol tăng = chốt lời mạnh ở đỉnh hoặc bắt đáy ở đáy; giá giảm + vol giảm = cạn cả cung lẫn cầu. Nến đỏ vol lớn ở đỉnh = nghi phân phối; cụm vol lớn ở vùng giá thấp = dòng tiền lớn nhập cuộc.
- Xu hướng & vùng giá: uptrend = đỉnh/đáy sau cao hơn cái trước, downtrend = thấp hơn, sideway = đi ngang. Trendline nối các đỉnh/đáy (càng nhiều điểm chạm càng giá trị); kênh xu hướng = 2 trendline song song — chạm cạnh dưới là hỗ trợ, cạnh trên là kháng cự, phá kênh = đảo chiều hoặc tăng/giảm mạnh hơn. Hỗ trợ = vùng cầu đủ mạnh chặn giảm, kháng cự = vùng cung đủ mạnh chặn tăng; phá kháng cự thì nó thành hỗ trợ và ngược lại. Mua khi giá chỉnh về hỗ trợ và lực bán cạn (vol thấp dần + nến đảo chiều); canh bán/giảm tỷ trọng khi giá quay đầu tại kháng cự.
- Chỉ báo (đi SAU giá-volume, dùng để XÁC NHẬN chứ không dẫn đường): Fibonacci thoái lui chọn vùng mua khi tạo đáy (vùng vàng 0.382–0.5 để gia tăng, 0.236 chỉ thăm dò); Fibonacci mở rộng định lượng mục tiêu chốt lãi, vượt "vùng 1" là tăng mạnh nhất — đi kèm sóng Elliott (5 sóng; đáy sóng 3 mà thấp hơn đỉnh sóng 1 thì không phải Elliott). Ichimoku: giá trong mây = tích luỹ, dưới mây = yếu (theo dõi/cắt), trên mây = mạnh (giải ngân/giữ). RSI = sức mạnh cung-cầu, quá mua/quá bán chỉ là cảnh báo, không dùng đơn độc. MACD: cắt Signal lên = mua, cắt xuống = bán; trên 0 là uptrend, dưới 0 là downtrend; phân kỳ (giá đáy thấp hơn nhưng MACD đáy cao hơn → đảo chiều tăng, ngược lại là giảm).
- Điểm mua (luôn cần volume xác nhận): test cung/cạn cung sau nền tích luỹ dài → thăm dò 30–50%; pocket pivot (phiên tăng vol vượt trung bình ~10 phiên, nền siết chặt trên 3 tháng); break nền tích luỹ với vol lớn (điều kiện tiên quyết là vol lớn — dấu chân tổ chức); break trendline giảm kèm vol lớn; test lại đỉnh/đáy cũ không thủng với vol thấp. Mẫu "gãy nền rũ": tổ chức đánh thủng nền để rũ nhỏ lẻ rồi kéo ngược lên — hay gặp ở TTCK VN.
- Bán chốt lãi: khi đạt mục tiêu (cổ nền tảng tốt nên cho 4–6 tháng để chạy); khi có dấu hiệu phân phối (đi ngang + vol khớp đột biến ở đỉnh — nên hạ tỷ trọng/quan sát, không nhất thiết bán sạch ngay); khi chạy nước rút (xanh/tím liên tục, gap ở vùng giá cao); khi xuất hiện mẫu hình đảo chiều giảm (2 đỉnh…).
- Cắt lỗ (kỷ luật sắt): khoản lỗ nặng đều bắt đầu từ lỗ nhỏ 15–20%; cắt sớm ~7–8% và dứt khoát (O'Neil), bán theo TÍN HIỆU KỸ THUẬT chứ không bám cơ bản; cắt khi thủng vùng hỗ trợ trọng yếu (đỉnh/đáy cũ, trendline, MA) nhất là kèm vol lớn. Lỗ 35% phải lãi 60% mới hoà, lỗ 50% phải lãi 100% → bảo vệ vốn là trên hết; thắng không cần đúng nhiều, chỉ cần lãi to bù lỗ nhỏ.
- Quản trị vốn & danh mục: tối ưu trên 3 nhóm ngành, 3–5 mã, chia đều không thiên vị; chỉ dùng tiền nhàn rỗi không vay. Giải ngân theo tỷ trọng (vd 30–30–40 cho test cung / pocket pivot / điểm bùng nổ, hoặc 50–50). Quản trị quy mô: đánh mạnh khi giá còn thấp, thu hẹp dần khi lên cao (đa số làm ngược nên mất lãi cuối sóng). Chuyển đổi danh mục theo "phù thịnh không phù suy": dòng đang giữ yếu đi mà có dòng khác khoẻ/đạt điểm mua thì mạnh dạn chuyển sang.
- Điều cần tránh: ham lời nhanh; mua trung bình giá xuống / nhồi lệnh ngược hướng (sai cả kỹ thuật lẫn tâm lý, dễ lỗ kép & call margin); cổ phiếu bo cung làm giá (thanh khoản ảo, không đoán được hướng). Giao dịch T0 hạ giá vốn chỉ hợp cổ cơ bản tốt đã có sẵn hàng (bán cao mua lại thấp trong phiên, giữ nguyên khối lượng cuối ngày), không dùng cho hàng đầu cơ; sai nhịp thì cắt.

Dùng khung này để giải thích "tại sao" và tư vấn linh hoạt đúng theo câu hỏi.`;
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

function buildAidenConversationPrompt(
  message: string,
  marketContext: unknown,
  tickerContexts: unknown[],
  indexContexts: unknown[] = [],
) {
  const hasIndex = Array.isArray(indexContexts) && indexContexts.length > 0;
  return `INTERNAL_CONTEXT:
${compactJson({
  tickers: tickerContexts,
  indices: indexContexts,
  market: marketContext,
}, 24000)}

OUTPUT_CONTRACT:
- Trả lời như một trợ lý đầu tư dạng ChatGPT/Gemini: hiểu câu hỏi tự nhiên, trò chuyện trực tiếp, không bắt khách nhập lệnh từng dòng.
- VĂN PHONG HỘI THOẠI, KHÔNG phải bản báo cáo: mở bằng 1 câu chốt thẳng cho câu hỏi, rồi dẫn giải bằng đoạn văn liền mạch, đan số liệu vào câu chữ; chỉ in đậm vài cụm/ngưỡng then chốt. TUYỆT ĐỐI KHÔNG tách câu trả lời thành các mục/heading máy móc kiểu "Xu hướng:/Động lượng:/Thanh khoản:/Khối ngoại:/Nhận định:". Chỉ dùng cấu trúc nhiều mục khi khách CHỦ ĐỘNG xin báo cáo chi tiết một mã.
- Nếu khách hỏi "hôm nay mua mã gì", "top mã đáng chú ý", "lọc cổ phiếu", ưu tiên 3-5 mã có bối cảnh tốt nhất trong INTERNAL_CONTEXT, nêu điều kiện theo dõi và rủi ro. Không bịa mã ngoài ngữ cảnh.
- Nếu khách hỏi một hoặc nhiều mã cụ thể, trả lời như chuyên gia nhìn TỔNG THỂ — KHÔNG chỉ kỹ thuật. Đan TỰ NHIÊN vào mạch văn cả góc CƠ BẢN khi ngữ cảnh có (định giá P/E·P/B, sức khoẻ doanh nghiệp qua EPS·ROE·ROA, tăng trưởng, ghi "theo kỳ báo cáo gần nhất") bên cạnh bức tranh kỹ thuật/dòng tiền/tin tức. Mạch ý liền mạch: nhận định nhanh → vài điểm đáng chú ý (gồm góc cơ bản nếu có) → rủi ro → hành động phù hợp. Dùng số liệu thực trong INTERNAL_CONTEXT (cả tickers[].fa/valuation lẫn analysisMetrics, news) khi có; tuyệt đối không bịa con số/target/tin.
- Nếu ticker có "brokerConsensus" (khuyến nghị các CTCK): nêu góc nhìn đồng thuận của giới phân tích — số CTCK Mua/Giữ/Bán gần đây, GIÁ MỤC TIÊU TRUNG BÌNH (avgTargetPrice, đơn vị nghìn đồng) và mức upside so với giá hiện tại, dẫn 1-2 CTCK gần nhất kèm giá mục tiêu + ngày (latest[].firm/type/targetPrice/reportDate). Trình bày RÕ đây là tham khảo từ giới phân tích bên ngoài, KHÔNG phải khuyến nghị của ADN; chỉ dùng số trong brokerConsensus, không bịa thêm CTCK/target. Khi khách hỏi thẳng "có báo cáo/khuyến nghị nào không" thì đây là phần chính của câu trả lời.
- Nếu ticker có "financialHistory" (BCTC nhiều quý gần nhất): khi bàn nội tại/cơ bản, đọc theo XU HƯỚNG qua các quý chứ không chỉ 1 con số — doanh thu (revenueBn, tỷ đồng), lợi nhuận ròng (netProfitBn, tỷ đồng), tăng trưởng YoY (revenueGrowthYoYPct/profitGrowthYoYPct), biên EBIT (ebitMarginPct), ROE, nợ/vốn (deRatio). Nhận xét chất lượng tăng trưởng (vd doanh thu tăng nhưng biên co lại, hay LN tăng nhanh hơn doanh thu, nợ vay tăng) và ghi kỳ theo "period". Đan vào mạch văn, chỉ dùng số có thật.
- Trạng thái kịch biên: nếu mã có "priceLimit.status" hoặc "market.limitStatus" = "ceiling" thì PHẢI khẳng định mã đó **tăng trần (kịch trần)** hôm nay; = "floor" thì **giảm sàn (kịch sàn)**. TUYỆT ĐỐI không phủ nhận. Lấy "changePct" làm mức biến động chính thức (vd +7% là kịch trần HOSE); không tự suy ra % khác từ giá rồi nói "chưa phải trần".${hasIndex ? `
- Nếu khách hỏi về CHỈ SỐ trong "indices" (VNINDEX/VN30/VN30F1M...): viết thành nhận định LIỀN MẠCH như đang trò chuyện — chốt xu hướng trước (giá so với MA20/MA50/MA200), rồi đan động lượng (RSI/MACD), thanh khoản và độ rộng thị trường (lấy từ "market") VÀO MẠCH VĂN, KHÔNG liệt kê thành từng mục. Vùng quan trọng CHỈ lấy từ các đường trung bình và đỉnh/đáy 52 tuần trong "indices.keyLevels". TUYỆT ĐỐI không nêu P/E, EPS, BVPS, ROE hay định giá doanh nghiệp cho chỉ số, và KHÔNG bịa mốc hỗ trợ/kháng cự ngoài dữ liệu đã cho. Chỉ số không có "điểm mua/cắt lỗ" như cổ phiếu — nói về trạng thái và kịch bản thị trường.` : ""}
- Nếu khách cần biểu đồ chi tiết, gợi ý mở ADN Stock để xem chart, vùng giá và AIDEN nhận định theo mã đó.
- Không bao giờ nhắc DataHub, FiinQuant, bridge, provider, API, cache, backend hoặc tên nguồn nội bộ trong câu trả lời khách hàng.
- Không được nói thiếu dữ liệu FA, chưa có dữ liệu FA, chưa đủ dữ liệu hoặc công bố nguồn lấy dữ liệu. Nếu thiếu một phần số liệu, trả lời thận trọng theo dữ kiện đang có.
- Trả lời bằng Markdown GFM hợp lệ, tiếng Việt có dấu, ngắn gọn hơn ADN Stock, không xổ một báo cáo dài nếu khách chỉ hỏi nhanh.
- TRƯỚC disclaimer, kết bằng 1-2 câu hỏi gợi mở TỰ NHIÊN và CỤ THỂ, bám đúng nội dung vừa nói, mời nhà đầu tư đi tiếp hướng liên quan (vd: soi nhóm ngành đang kéo index, mã cụ thể hưởng lợi, kịch bản nếu thủng/vượt một ngưỡng vừa nêu, hay so với một mã khác). Hỏi như chuyên gia đang trò chuyện — KHÔNG hỏi chung chung kiểu "anh/chị cần gì nữa không".
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

function buildAidenConversationFallbackMessage(
  message: string,
  marketContext: unknown,
  tickerContexts: unknown[],
  indexContexts: unknown[] = [],
) {
  if (tickerContexts.length === 0 && indexContexts.length > 0) {
    const indexLines = indexContexts
      .map((context) => buildIndexFallbackLine(context))
      .filter((item): item is string => Boolean(item))
      .slice(0, 3);
    return `AIDEN nhận định nhanh chỉ số:

${indexLines.length > 0 ? indexLines.join("\n") : "- Ưu tiên quan sát xu hướng so với các đường trung bình và phản ứng thanh khoản trước khi tăng/giảm tỷ trọng."}

**Hành động phù hợp:** với chỉ số, ưu tiên đánh giá xu hướng và quản trị tỷ trọng theo trạng thái thị trường chung; không có điểm mua/cắt lỗ kiểu cổ phiếu.`;
  }
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

function sanitizeCustomerAnswer(text: string, options: { skipValuationRewrite?: boolean } = {}) {
  let result = stripInternalSourceMentions(stripSourceFraming(text))
    .replace(/Dựa trên dữ liệu phân tích nội bộ(?: đã được chuẩn hóa)?[,.]?\s*/gi, "")
    .replace(/dựa trên dữ liệu đã kiểm chứng[,.]?\s*/gi, "")
    .replace(/\bDataHub\b/gi, "")
    .replace(/\bFiinQuantX?\b/gi, "")
    .replace(/\bbridge\b/gi, "")
    .replace(/\bprovider\b/gi, "")
    .replace(/\bbackend\b/gi, "")
    .replace(/\bcache\b/gi, "")
    .replace(/\bAPI\b/g, "")
    .replace(/FA\s+null/gi, "phần định giá theo kỳ báo cáo gần nhất");

  // Các rewrite "thiếu/chưa đủ dữ liệu → boilerplate định giá" là tàn dư của báo cáo cứng.
  // Với webchat "aiden" (văn xuôi tự nhiên + có câu hỏi chỉ số), chúng BẮN NHẦM khi gặp từ
  // "chỉ số"/"chỉ báo" (vd "thiếu tín hiệu ở các chỉ số kỹ thuật") → chèn boilerplate giữa câu.
  // Persona đã cấm nói "thiếu dữ liệu" nên không cần các rewrite này cho surface aiden.
  if (!options.skipValuationRewrite) {
    result = result
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
      );
  }

  return result
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

// ── Chỉ số (VNINDEX/VN30/...) — context SẠCH, chỉ từ nến DB-v2 (đúng thang điểm chỉ số) ──
// KHÔNG dùng signal-S/R, KHÔNG bollinger từ bridge (sai thang ~15×), KHÔNG FA doanh nghiệp.
function buildIndexContext(
  ticker: string,
  indicators: unknown,
  priceSnapshot: unknown,
  candles: ReturnType<typeof normalizeHistoricalCandles>,
) {
  const ind = asRecord(indicators);
  const snap = asRecord(priceSnapshot);
  const macd = asRecord(ind.macd);
  const price = asNumber(snap.price) ?? asNumber(ind.currentPrice);
  const ma20 = asNumber(ind.sma20);
  const ma50 = asNumber(ind.sma50);
  const ma200 = asNumber(ind.sma200);
  const low52w = asNumber(ind.low52w);
  const high52w = asNumber(ind.high52w);

  return stripInternalFields({
    ticker,
    kind: "index",
    note: "Đây là CHỈ SỐ thị trường (không phải cổ phiếu): KHÔNG có P/E, EPS, BVPS, ROE hay định giá doanh nghiệp. Vùng quan trọng chỉ lấy từ đường trung bình và đỉnh/đáy 52 tuần.",
    price,
    changePct: asNumber(snap.changePct) ?? asNumber(ind.changePct),
    movingAverages: {
      ma20,
      ma50,
      ma200,
      priceVsMa20Pct: pctDiff(price, ma20),
      priceVsMa50Pct: pctDiff(price, ma50),
      priceVsMa200Pct: pctDiff(price, ma200),
    },
    momentum: {
      rsi14: asNumber(ind.rsi14),
      macdHistogram: asNumber(macd.histogram),
      macdHistogramPrev: asNumber(macd.histogramPrev),
    },
    volume: {
      latestVolume: asNumber(snap.latestVolume),
      volumeMa20: asNumber(snap.volumeMa20) ?? asNumber(ind.avgVolume20),
    },
    keyLevels: {
      // vùng tham chiếu hợp lệ cho chỉ số: các đường trung bình + biên 52 tuần (cùng thang điểm)
      movingAverages: [ma20, ma50, ma200].filter((value): value is number => value != null),
      low52w,
      high52w,
    },
    recentCandles: candles.slice(-6),
    priceSnapshot: stripInternalFields({
      price,
      previousClose: asNumber(snap.previousClose),
      changePct: asNumber(snap.changePct),
      priceDate: snap.priceDate ?? null,
    }),
  });
}

// Dựng index context từ getDatabaseAidenTickerContext (giá valueIndexes từ market.eod + MA/RSI
// tươi từ ta-summary), thay vì market.ohlcv (nến chỉ số ngừng cập nhật từ tháng 5 → stale).
function buildIndexContextFromDb(ticker: string, dbCtx: DatabaseAidenTickerContext | null) {
  if (!dbCtx) return buildIndexContext(ticker, null, null, []);
  const tech = dbCtx.technical;
  const indicators = {
    currentPrice: dbCtx.market.price,
    changePct: dbCtx.market.changePct,
    sma20: tech?.ma20 ?? null,
    sma50: tech?.ma50 ?? null,
    sma200: tech?.ma200 ?? null,
    avgVolume20: tech?.volumeMa20 ?? null,
    low52w: null,
    high52w: null,
    rsi14: tech?.rsi ?? null,
    macd: { histogram: tech?.macdHistogram ?? null, histogramPrev: null },
    volume10: [],
  };
  const priceSnapshot = {
    price: dbCtx.market.price,
    close: dbCtx.dailyOhlcv?.close ?? dbCtx.market.price,
    previousClose: dbCtx.market.reference,
    changePct: dbCtx.market.changePct,
    latestVolume: dbCtx.market.volume ?? dbCtx.dailyOhlcv?.volume ?? null,
    volumeMa20: tech?.volumeMa20 ?? null,
    priceDate: dbCtx.market.tradingDate ?? null,
  };
  return buildIndexContext(ticker, indicators, priceSnapshot, []);
}

async function loadIndexContexts(tickers: string[], _context: TopicContext) {
  return Promise.all(
    tickers.map(async (ticker) => {
      const result = await getDatabaseAidenTickerContext({ ticker }).catch((error) => {
        emitAidenFallback("index_v2_context_failed", error, { ticker });
        return null;
      });
      const dbCtx = result?.data ?? null;
      return {
        ticker,
        topics: dbCtx ? [`database:v2:aiden:${ticker}`] : [],
        envelopes: [] as Array<{ topic: string; envelope: TopicEnvelope }>,
        context: buildIndexContextFromDb(ticker, dbCtx),
      };
    }),
  );
}

function buildIndexFallbackLine(context: unknown) {
  const record = asRecord(context);
  const ticker = String(record.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;

  const movingAverages = asRecord(record.movingAverages);
  const momentum = asRecord(record.momentum);
  const price = roundedPrice(record.price);
  const ma20 = roundedPrice(movingAverages.ma20);
  const ma50 = roundedPrice(movingAverages.ma50);
  const ma200 = roundedPrice(movingAverages.ma200);
  const rsi = asNumber(momentum.rsi14);
  const pieces = [
    price != null ? `quanh ${formatPrice(price)} điểm` : null,
    ma20 != null ? `MA20 ${formatPrice(ma20)}` : null,
    ma50 != null ? `MA50 ${formatPrice(ma50)}` : null,
    rsi != null ? `RSI ${formatDecimal(rsi)}` : null,
  ].filter(Boolean);
  const trend = buildTickerTrendView(price, ma20, ma50, ma200);
  return `- **${ticker}**: ${pieces.length > 0 ? `${pieces.join(", ")}. ` : ""}${trend}`;
}

// HƯỚNG B: webchat dùng CÙNG nguồn DB-v2-first như ADN Stock (getDatabaseAidenTickerContext).
// Adapter này map DatabaseAidenTickerContext → đúng shape mà downstream webchat (prompt/brief/
// recommendation) đang đọc, nên đổi được nguồn data mà KHÔNG phải viết lại downstream.
// Giá lấy từ market/dailyOhlcv (đã điều chỉnh đúng) + fallback ta-summary trong context builder,
// KHÔNG còn dính bridge /historical sai thang (vd HPG 26.8 → đúng 24.0).
function dbContextToWebchatTicker(dbCtx: DatabaseAidenTickerContext) {
  const tech = dbCtx.technical;
  const fin = dbCtx.fundamental.financialPeriod;
  const val = dbCtx.fundamental.valuation;
  const metric = (m: { value: number } | null | undefined) =>
    m && Number.isFinite(m.value) ? m.value : null;
  const price = dbCtx.market.price ?? dbCtx.dailyOhlcv?.close ?? null;
  const ma20 = tech?.ma20 ?? null;
  const ma50 = tech?.ma50 ?? null;
  const ma200 = tech?.ma200 ?? null;
  const support = tech?.support ?? dbCtx.dailyOhlcv?.low ?? null;
  const resistance = tech?.resistance ?? dbCtx.dailyOhlcv?.high ?? null;
  const latestVolume = dbCtx.market.volume ?? dbCtx.dailyOhlcv?.volume ?? null;
  const open = dbCtx.dailyOhlcv?.open ?? null;
  const close = dbCtx.dailyOhlcv?.close ?? null;
  const valuation = {
    pe: metric(val?.pe),
    pb: metric(val?.pb),
    eps: metric(fin?.eps),
    bookValuePerShare: metric(fin?.bvps),
    roe: metric(fin?.roe),
    roa: metric(fin?.roa),
    reportDate: fin?.reportPeriod ?? val?.valuationDate ?? null,
  };
  const priceLimit = dbCtx.market.limitStatus
    ? { status: dbCtx.market.limitStatus, limitPct: dbCtx.market.limitPct ?? null }
    : null;
  const analysisMetrics = {
    ticker: dbCtx.ticker,
    price,
    changePct: dbCtx.market.changePct,
    priceLimit,
    movingAverages: {
      ma20,
      ma50,
      ma200,
      priceVsMa20Pct: pctDiff(price, ma20),
      priceVsMa50Pct: pctDiff(price, ma50),
      priceVsMa200Pct: pctDiff(price, ma200),
    },
    momentum: { rsi14: tech?.rsi ?? null, macdHistogram: tech?.macdHistogram ?? null, macdHistogramPrev: null, macdHistogramChange: null },
    volume: { latestVolume, volumeMa20: tech?.volumeMa20 ?? null, volumeVsMa20: null },
    priceZones: { support, resistance, safeZoneLow: support, safeZoneHigh: ma20 ?? price, low52w: null, high52w: null },
    radarAction: { status: null, type: null, entryPrice: null, target: null, stoploss: null, currentPnl: null, winRate: null, rrRatio: null },
    valuation,
    lastCandle:
      open != null && close != null
        ? { direction: close >= open ? "up" : "down", date: dbCtx.market.tradingDate ?? null }
        : null,
    recentCandles: [],
    adnCore: null,
    adnArt: null,
  };
  return {
    ticker: dbCtx.ticker,
    priceSnapshot: {
      price,
      close,
      previousClose: dbCtx.market.reference,
      changePct: dbCtx.market.changePct,
      limitStatus: dbCtx.market.limitStatus ?? null,
      latestVolume,
      priceDate: dbCtx.market.tradingDate ?? null,
    },
    analysisMetrics,
    ta: { currentPrice: price, changePct: dbCtx.market.changePct, sma20: ma20, sma50: ma50, sma200: ma200, rsi14: tech?.rsi ?? null, avgVolume20: tech?.volumeMa20 ?? null },
    fa: valuation,
    signal: null,
    adnCore: null,
    adnArt: null,
    market: dbCtx.market,
    investor: null,
    news: Array.isArray(dbCtx.relatedNews) ? dbCtx.relatedNews.slice(0, 5) : [],
    realtimeSummary: { price, updatedAt: dbCtx.market.updatedAt ?? null },
    orderbook: null,
    dataSummary: { hasTA: Boolean(tech), hasFA: Boolean(fin || val) },
  };
}

async function loadTickerContexts(tickers: string[], context: TopicContext) {
  return Promise.all(
    tickers.map(async (ticker) => {
      const topics = [
        `research:workbench:${ticker}`,
        `vn:price-snapshot:${ticker}`,
        `vn:ta:${ticker}`,
        `vn:fa:${ticker}`,
        `vn:depth:${ticker}`,
      ];
      if (AIDEN_ALLOW_LEGACY_MARKET_CONTEXT) {
        topics.push(`vn:realtime:${ticker}:5m`, `vn:historical:${ticker}:1d`);
      }
      const envelopes = await Promise.all(topics.map((topic) => readTopicSoft(topic, context, TICKER_TOPIC_TIMEOUT_MS)));
      const databaseHistorical = await loadDatabaseV2DailyPayload(ticker).catch((error) => {
        emitAidenFallback("database_v2_historical_context_failed", error, { ticker });
        return null;
      });
      const databasePriceSnapshot = databaseHistorical
        ? await loadDatabaseV2PriceSnapshot(ticker, databaseHistorical).catch((error) => {
            emitAidenFallback("database_v2_price_context_failed", error, { ticker });
            return null;
          })
        : null;
      const databaseCandles = normalizeHistoricalCandles(databaseHistorical);
      const databaseTa = databaseCandles.length ? buildIndicatorsFromCandles(databaseCandles) : null;
      const databaseTopics = [
        databaseHistorical ? `database:v2:market.ohlcv:${ticker}` : null,
        databasePriceSnapshot ? `database:v2:radar.realtime.tick:${ticker}` : null,
      ].filter((item): item is string => Boolean(item));
      return {
        ticker,
        topics: [...topics, ...databaseTopics],
        envelopes,
        context: buildTickerContext(ticker, envelopes, {
          historical: databaseHistorical,
          priceSnapshot: databasePriceSnapshot,
          ta: databaseTa,
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

async function executeAidenFreeModelRequest(prompt: string, systemInstruction: string) {
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

export function finalizeAidenPreparedAnswer(
  answer: string,
  turn: AidenDatahubPreparedTurn,
  surface?: AidenSurface,
) {
  let finalAnswer = answer.trim();
  if (!isInvestmentIntent(turn.intent)) {
    return finalAnswer;
  }

  // Chèn dòng định giá/ADNCore là để vá báo cáo cứng của ADN Stock. Với webchat "aiden" văn xuôi
  // tự nhiên, regex chèn này phá giữa câu (vd nối vào "P/E 28.3x") nên bỏ qua — persona đã tự lo.
  if (turn.tickerContexts.length > 0 && surface !== "aiden") {
    finalAnswer = ensureCoreArtLine(ensureValuationLine(finalAnswer, turn.tickerContexts), turn.tickerContexts);
  }

  const sanitized = sanitizeCustomerAnswer(finalAnswer, { skipValuationRewrite: surface === "aiden" });
  return ensureDisclaimer(sanitized);
}

export async function prepareAidenDatahubTurn(input: {
  message: string;
  currentTicker?: string | null;
  context?: TopicContext;
  surface?: AidenSurface | string | null;
  userName?: string | null;
  userGender?: string | null;
}): Promise<AidenDatahubPreparedTurn> {
  const message = input.message.trim();
  const context = input.context ?? {};
  const surface: AidenSurface = input.surface === "stock" ? "stock" : "aiden";
  const systemInstruction =
    surface === "aiden"
      ? buildAidenConversationSystemInstruction(buildAidenAddressTerm(input.userName, input.userGender))
      : buildSystemInstruction();

  if (surface === "aiden") {
    const intentResult = classifyAidenIntent(message);
    let intent = intentResult.intent;
    let tickers =
      intent === "ticker_analysis" || intent === "compare"
        ? await resolveTickerCandidates(intentResult.candidates)
        : [];
    // Chỉ số (VNINDEX/VN30/...) luôn được giữ kể cả khi resolver không coi là "mã giao dịch".
    if (intent === "ticker_analysis" || intent === "compare") {
      for (const candidate of intentResult.candidates) {
        if (!isIndexTicker(candidate)) continue;
        const canonical = canonicalIndexTicker(candidate);
        if (!tickers.includes(canonical)) tickers.push(canonical);
      }
    }
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
        model: AIDEN_MODEL,
        dataFreshness: {},
        prompt: buildAidenSmalltalkPrompt(message),
        staticMessage: buildAidenHelpMessage(),
        fallbackMessage: buildAidenHelpMessage(),
        systemInstruction,
        tickerContexts: [],
      };
    }

    const indexTickers = tickers.filter((item) => isIndexTicker(item));
    const stockTickers = tickers.filter((item) => !isIndexTicker(item));

    const general = await buildGeneralMarketContext(context);
    // HƯỚNG B: webchat lấy ticker context từ getDatabaseAidenTickerContext (DB-v2-first + fallback
    // ta-summary) — CÙNG nguồn với ADN Stock, giá đúng/đã điều chỉnh, không dính bridge /historical.
    // Khuyến nghị broker (VNDirect) + BCTC đa kỳ (bridge) chạy SONG SONG với load context (cache RAM 6h).
    const recoPromise: Promise<(BrokerConsensus | null)[]> =
      stockTickers.length > 0
        ? Promise.all(stockTickers.map((t) => fetchVndirectRecommendations(t).catch(() => null)))
        : Promise.resolve([]);
    const finPromise: Promise<(FinancialHistory | null)[]> =
      stockTickers.length > 0
        ? Promise.all(stockTickers.map((t) => fetchFinancialHistory(t).catch(() => null)))
        : Promise.resolve([]);
    const stockResults =
      stockTickers.length > 0
        ? await Promise.all(stockTickers.map((t) => getDatabaseAidenTickerContext({ ticker: t }).catch(() => null)))
        : [];
    const [recoResults, finResults] = await Promise.all([recoPromise, finPromise]);
    const recoByTicker = new Map(stockTickers.map((t, i) => [t.toUpperCase(), recoResults[i] ?? null]));
    const finByTicker = new Map(stockTickers.map((t, i) => [t.toUpperCase(), finResults[i] ?? null]));
    const stockDbContexts = stockResults
      .map((r) => r?.data ?? null)
      .filter((c): c is DatabaseAidenTickerContext => Boolean(c));
    const tickerContexts = stockDbContexts.map((dbCtx) => {
      const tc = dbContextToWebchatTicker(dbCtx);
      const key = String(dbCtx.ticker).toUpperCase();
      const consensus = recoByTicker.get(key);
      if (consensus) (tc as Record<string, unknown>).brokerConsensus = consensus;
      const financials = finByTicker.get(key);
      if (financials) (tc as Record<string, unknown>).financialHistory = financials;
      return tc;
    });
    const perIndex = indexTickers.length > 0 ? await loadIndexContexts(indexTickers, context) : [];
    const indexContexts = perIndex.map((item) => item.context);
    // Webchat AIDEN: luôn để LLM tự viết câu trả lời tự nhiên dựa trên số liệu đã chuẩn hóa.
    // Bản template tất định (buildAidenTickerBriefMessage) chỉ còn là fallback an toàn khi LLM lỗi/timeout.
    // Chỉ áp cho cổ phiếu đơn lẻ — chỉ số đi nhánh index riêng (không dùng template cổ phiếu).
    const deterministicTickerBrief =
      intent === "ticker_analysis" && tickerContexts.length === 1 && indexContexts.length === 0
        ? buildAidenTickerBriefMessage(tickerContexts[0])
        : null;

    return {
      message,
      intent,
      ticker: stockDbContexts[0]?.ticker ?? tickers[0],
      tickers,
      recommendation: tickerContexts.length === 1 ? buildRecommendation(tickerContexts[0]) : null,
      usedTopics: [
        ...general.topics,
        ...stockDbContexts.map((c) => `database:v2:aiden:${c.ticker}`),
        ...perIndex.flatMap((item) => item.topics),
      ],
      model: AIDEN_MODEL,
      dataFreshness: collectFreshness(perIndex, general.envelopes),
      prompt: buildAidenConversationPrompt(message, general.context, tickerContexts, indexContexts),
      fallbackMessage:
        deterministicTickerBrief ??
        (intent === "general_market"
          ? prependMarketOverview(general.context, buildAidenConversationFallbackMessage(message, general.context, tickerContexts, indexContexts))
          : buildAidenConversationFallbackMessage(message, general.context, tickerContexts, indexContexts)),
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
      model: AIDEN_MODEL,
      dataFreshness,
      prompt: buildGeneralPrompt(message, general.context),
      fallbackMessage: prependMarketOverview(general.context, buildGeneralFallbackMessage(message, general.context)),
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
    model: AIDEN_MODEL,
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
        executeAidenFreeModelRequest(turn.prompt, turn.systemInstruction),
        AIDEN_MODEL_TIMEOUT_MS,
        `${surface}-aiden`,
      );
    } catch (error) {
      console.warn("[AIDEN] FreeModel generation failed:", error);
      emitAidenFallback(`${surface}_fallback`, error, {
        surface,
        tickerCount: turn.tickerContexts.length,
        timeoutMs: AIDEN_MODEL_TIMEOUT_MS,
        model: AIDEN_FREEMODEL_MODEL,
      });
      answer = turn.fallbackMessage;
    }
  } else {
    answer = turn.fallbackMessage;
  }

  return {
    message: finalizeAidenPreparedAnswer(answer, turn, surface),
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
