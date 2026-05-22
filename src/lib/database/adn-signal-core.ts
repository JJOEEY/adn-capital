import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseOk } from "@/lib/database/contracts";
import type { DatabaseRadarRealtimeState, DatabaseRadarTick } from "@/lib/database/radar-realtime";
import { getDatabaseRadarRealtime } from "@/lib/database/radar-realtime";
import { getDatabaseToolLatest, upsertDatabaseToolLatest } from "@/lib/database/tool-latest";
import { alignMarketPriceToAnchor, getMarketPayloadRows, normalizeHistoricalPricePayload, readMarketNumber } from "@/lib/market-price-normalization";
import { prisma } from "@/lib/prisma";
import { collectDnseLightspeedMessages } from "@/lib/providers/dnse/lightspeed-ws";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { loadDnseWatchlistSymbols } from "@/lib/database/providers/dnse/watchlist";
import { sendTelegramOnce, telegramHash } from "@/lib/telegram/dispatch";

type JsonRecord = Record<string, unknown>;

export const ADN_SIGNAL_CORE_TOPIC = "signal:market:radar:adn-signal-core";
export const ADN_SIGNAL_CORE_NAME = "ADN_SIGNAL_CORE";

const UNIVERSE_DATASET = "radar.adn_signal_core.universe";
const INDICATORS_DATASET = "radar.adn_signal_core.indicators";
const LATEST_DATASET = "radar.adn_signal_core.latest";
const POSITIONS_DATASET = "radar.adn_signal_core.positions";
const HISTORY_DAYS = 420;
const HISTORY_CONCURRENCY = 8;
const STOP_LOSS_PCT = 0.07;

export type AdnSignalCoreSide = "BUY" | "EXIT_WARNING";

export type AdnSignalCoreIndicator = {
  ticker: string;
  lastClose: number;
  previousClose: number;
  ema200: number;
  ema12: number;
  ema26: number;
  ema3: number;
  ema10: number;
  rsi14: number;
  rsiAvgGain14: number;
  rsiAvgLoss14: number;
  macd: number;
  macdSignal: number;
  avgVolume12m: number;
  medianVolume20: number;
  avgValue12m: number;
  rows: number;
  dataDate: string;
};

export type AdnSignalCoreUniversePayload = {
  kind: "adn_signal_core_universe";
  version: "v1";
  adnSignal: typeof ADN_SIGNAL_CORE_NAME;
  filters: {
    avgVolume12mMin: number;
    medianVolume20Min: number;
    avgValueVndMin: number;
  };
  requested: number;
  accepted: number;
  rejected: number;
  tickers: string[];
  rejectedSamples: Array<{ ticker: string; reason: string }>;
  indicators: AdnSignalCoreIndicator[];
  updatedAt: string;
};

export type AdnSignalCoreSignal = {
  ticker: string;
  side: AdnSignalCoreSide;
  adnSignal: typeof ADN_SIGNAL_CORE_NAME;
  price: number;
  previousClose: number;
  ema200: number;
  ema3: number;
  ema10: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  entryPrice?: number;
  stopLossPrice?: number;
  reason: string;
  providerTime: string | null;
  detectedAt: string;
};

type AdnSignalCorePosition = {
  ticker: string;
  entryPrice: number;
  entryAt: string;
  stopLossPrice: number;
  lastPrice: number;
  lastSeenAt: string;
};

type AdnSignalCorePositionsPayload = {
  kind: "adn_signal_core_positions";
  version: "v1";
  adnSignal: typeof ADN_SIGNAL_CORE_NAME;
  positions: AdnSignalCorePosition[];
  updatedAt: string;
};

export type AdnSignalCoreLatestPayload = {
  kind: "adn_signal_core_latest";
  version: "v1";
  topic: typeof ADN_SIGNAL_CORE_TOPIC;
  adnSignal: typeof ADN_SIGNAL_CORE_NAME;
  tradingDate: string;
  slotLabel: string;
  signals: AdnSignalCoreSignal[];
  summary: {
    universe: number;
    realtimeTicks: number;
    detected: number;
    buy: number;
    exitWarning: number;
    telegramSent: boolean;
    telegramSkippedReason: string | null;
  };
  universeUpdatedAt: string | null;
  updatedAt: string;
};

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isAdnSignalCoreEnabled() {
  return process.env.ADN_SIGNAL_CORE_ENABLED !== "false";
}

function isAdnSignalCoreTelegramEnabled() {
  return process.env.ADN_SIGNAL_CORE_TELEGRAM_ENABLED === "true";
}

function filters() {
  return {
    avgVolume12mMin: getNumberEnv("ADN_SIGNAL_CORE_MIN_AVG_VOLUME", 250_000),
    medianVolume20Min: getNumberEnv("ADN_SIGNAL_CORE_MIN_MEDIAN20_VOLUME", 250_000),
    avgValueVndMin: getNumberEnv("ADN_SIGNAL_CORE_MIN_AVG_VALUE_VND", 10_000_000_000),
  };
}

function maxTelegramItems() {
  return Math.max(1, Math.min(getNumberEnv("ADN_SIGNAL_CORE_MAX_TELEGRAM_ITEMS", 10), 30));
}

function stopLossPrice(entryPrice: number) {
  return Math.round(entryPrice * (1 - STOP_LOSS_PCT));
}

function toNumber(value: unknown) {
  const parsed = readMarketNumber(value);
  return parsed != null && Number.isFinite(parsed) ? parsed : null;
}

function toTimestamp(record: JsonRecord) {
  const raw = record.timestamp ?? record.time ?? record.date;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 10_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  if (typeof raw !== "string" || !raw.trim()) return 0;
  const text = raw.trim();
  const normalized = text.includes("T")
    ? text
    : text.includes(" ")
      ? `${text.replace(" ", "T")}+07:00`
      : `${text}T00:00:00+07:00`;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? Math.floor(time / 1000) : 0;
}

function median(values: number[]) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

function average(values: number[]) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function emaSeries(values: number[], period: number) {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * k + result[index - 1] * (1 - k));
  }
  return result;
}

function nextEma(previous: number, value: number, period: number) {
  const k = 2 / (period + 1);
  return value * k + previous * (1 - k);
}

function rsiState(closes: number[], period = 14) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  let avgGain = 0;
  let avgLoss = 0;
  for (let index = 0; index < period; index += 1) {
    const change = changes[index];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let index = period; index < changes.length; index += 1) {
    const change = changes[index];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  return {
    avgGain,
    avgLoss,
    rsi: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
  };
}

function nextRsi(previousClose: number, liveClose: number, avgGain: number, avgLoss: number, period = 14) {
  const change = liveClose - previousClose;
  const gain = change > 0 ? change : 0;
  const loss = change < 0 ? -change : 0;
  const nextGain = (avgGain * (period - 1) + gain) / period;
  const nextLoss = (avgLoss * (period - 1) + loss) / period;
  return nextLoss === 0 ? 100 : 100 - 100 / (1 + nextGain / nextLoss);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function fetchHistoricalRows(ticker: string) {
  const url = `${getPythonBridgeUrl()}/api/v1/historical/${encodeURIComponent(ticker)}?days=${HISTORY_DAYS}&timeframe=1d&adjusted=false`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(55_000) });
  if (!response.ok) throw new Error(`historical_${ticker}_http_${response.status}`);
  const payload = normalizeHistoricalPricePayload(await response.json());
  return getMarketPayloadRows(payload)
    .map((row) => {
      const close = toNumber(row.close ?? row.c ?? row.price);
      const volume = toNumber(row.volume ?? row.v);
      const value = toNumber(row.value ?? row.tradingValue ?? row.amount);
      const timestamp = toTimestamp(row);
      return {
        timestamp,
        close,
        volume,
        value: value ?? (close != null && volume != null ? close * volume : null),
      };
    })
    .filter((row): row is { timestamp: number; close: number; volume: number; value: number } =>
      row.timestamp > 0 &&
      row.close != null &&
      row.close > 0 &&
      row.volume != null &&
      row.volume >= 0 &&
      row.value != null &&
      row.value >= 0,
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function buildIndicator(ticker: string, rows: Awaited<ReturnType<typeof fetchHistoricalRows>>): AdnSignalCoreIndicator | null {
  if (rows.length < 220) return null;
  const closes = rows.map((row) => row.close);
  const volumes = rows.map((row) => row.volume);
  const values = rows.map((row) => row.value);
  const ema3 = emaSeries(closes, 3);
  const ema10 = emaSeries(closes, 10);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const ema200 = emaSeries(closes, 200);
  const macdSeries = ema12.map((value, index) => value - ema26[index]);
  const macdSignal = emaSeries(macdSeries, 9);
  const rsi = rsiState(closes, 14);
  if (!rsi) return null;
  const avgVolume12m = average(volumes) ?? 0;
  const medianVolume20 = median(volumes.slice(-20)) ?? 0;
  const avgValue12m = average(values) ?? 0;
  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  return {
    ticker,
    lastClose: last.close,
    previousClose: previous.close,
    ema200: ema200[ema200.length - 1],
    ema12: ema12[ema12.length - 1],
    ema26: ema26[ema26.length - 1],
    ema3: ema3[ema3.length - 1],
    ema10: ema10[ema10.length - 1],
    rsi14: rsi.rsi,
    rsiAvgGain14: rsi.avgGain,
    rsiAvgLoss14: rsi.avgLoss,
    macd: macdSeries[macdSeries.length - 1],
    macdSignal: macdSignal[macdSignal.length - 1],
    avgVolume12m,
    medianVolume20,
    avgValue12m,
    rows: rows.length,
    dataDate: new Date(last.timestamp * 1000).toISOString().slice(0, 10),
  };
}

function rejectReason(indicator: AdnSignalCoreIndicator | null, currentFilters: ReturnType<typeof filters>) {
  if (!indicator) return "missing_history_or_indicator";
  if (indicator.avgVolume12m < currentFilters.avgVolume12mMin) return "avg_volume_below_threshold";
  if (indicator.medianVolume20 < currentFilters.medianVolume20Min) return "median_volume20_below_threshold";
  if (indicator.avgValue12m < currentFilters.avgValueVndMin) return "avg_value_below_threshold";
  return null;
}

export async function collectAdnSignalCoreUniverse(options?: { tickers?: string[]; limit?: number }): Promise<DatabaseResult<AdnSignalCoreUniversePayload>> {
  const startedAt = Date.now();
  const requestedTickers = options?.tickers?.length
    ? Array.from(new Set(options.tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)))
    : await loadDnseWatchlistSymbols({ limit: options?.limit ?? 500 });
  const currentFilters = filters();
  const rejectedSamples: Array<{ ticker: string; reason: string }> = [];
  const indicators = await mapWithConcurrency(requestedTickers, HISTORY_CONCURRENCY, async (ticker) => {
    try {
      return buildIndicator(ticker, await fetchHistoricalRows(ticker));
    } catch {
      return null;
    }
  });
  const accepted: AdnSignalCoreIndicator[] = [];
  indicators.forEach((indicator, index) => {
    const reason = rejectReason(indicator, currentFilters);
    if (!reason && indicator) accepted.push(indicator);
    else if (rejectedSamples.length < 30) rejectedSamples.push({ ticker: requestedTickers[index], reason: reason ?? "unknown" });
  });
  const payload: AdnSignalCoreUniversePayload = {
    kind: "adn_signal_core_universe",
    version: "v1",
    adnSignal: ADN_SIGNAL_CORE_NAME,
    filters: currentFilters,
    requested: requestedTickers.length,
    accepted: accepted.length,
    rejected: requestedTickers.length - accepted.length,
    tickers: accepted.map((item) => item.ticker),
    rejectedSamples,
    indicators: accepted,
    updatedAt: new Date().toISOString(),
  };
  await Promise.all([
    upsertDatabaseToolLatest({
      tool: "radar",
      dataset: UNIVERSE_DATASET,
      key: "latest",
      payload: payload,
      missingFields: accepted.length ? [] : ["adn_signal_core.universe"],
      providerStatus: { provider: "fiinquant", ok: accepted.length > 0, endpoint: "bridge:/api/v1/historical" },
      ttlMs: 18 * 60 * 60_000,
    }),
    upsertDatabaseToolLatest({
      tool: "radar",
      dataset: INDICATORS_DATASET,
      key: "latest",
      payload: accepted,
      missingFields: accepted.length ? [] : ["adn_signal_core.indicators"],
      providerStatus: { provider: "fiinquant", ok: accepted.length > 0, endpoint: "bridge:/api/v1/historical" },
      ttlMs: 18 * 60 * 60_000,
    }),
  ]);
  const missingFields = accepted.length ? [] : ["adn_signal_core.universe"];
  const providerStatus: DatabaseProviderStatus = {
    provider: "fiinquant",
    ok: missingFields.length === 0,
    endpoint: "bridge:/api/v1/historical",
    latencyMs: Date.now() - startedAt,
    retryable: missingFields.length > 0,
  };
  return databaseOk(UNIVERSE_DATASET, "fiinquant", payload, providerStatus, missingFields);
}

function evaluateSignal(tick: DatabaseRadarTick, indicator: AdnSignalCoreIndicator): AdnSignalCoreSignal[] {
  const livePrice = alignMarketPriceToAnchor(tick.price, indicator.lastClose);
  if (livePrice == null || livePrice <= 0) return [];
  const liveEma200 = nextEma(indicator.ema200, livePrice, 200);
  const liveEma3 = nextEma(indicator.ema3, livePrice, 3);
  const liveEma10 = nextEma(indicator.ema10, livePrice, 10);
  const liveEma12 = nextEma(indicator.ema12, livePrice, 12);
  const liveEma26 = nextEma(indicator.ema26, livePrice, 26);
  const liveMacd = liveEma12 - liveEma26;
  const liveMacdSignal = nextEma(indicator.macdSignal, liveMacd, 9);
  const liveRsi = nextRsi(indicator.lastClose, livePrice, indicator.rsiAvgGain14, indicator.rsiAvgLoss14, 14);
  const detectedAt = new Date().toISOString();
  const base = {
    ticker: indicator.ticker,
    adnSignal: ADN_SIGNAL_CORE_NAME as typeof ADN_SIGNAL_CORE_NAME,
    price: Math.round(livePrice),
    previousClose: Math.round(indicator.lastClose),
    ema200: Math.round(liveEma200),
    ema3: Number(liveEma3.toFixed(2)),
    ema10: Number(liveEma10.toFixed(2)),
    rsi14: Number(liveRsi.toFixed(2)),
    macd: Number(liveMacd.toFixed(3)),
    macdSignal: Number(liveMacdSignal.toFixed(3)),
    providerTime: tick.providerTime,
    detectedAt,
  };
  const signals: AdnSignalCoreSignal[] = [];
  const priceCrossUpEma200 = indicator.lastClose <= indicator.ema200 && livePrice > liveEma200;
  const macdCrossUpSignal = indicator.macd <= indicator.macdSignal && liveMacd > liveMacdSignal;
  if (priceCrossUpEma200 && macdCrossUpSignal) {
    signals.push({
      ...base,
      side: "BUY",
      entryPrice: Math.round(livePrice),
      stopLossPrice: stopLossPrice(livePrice),
      reason: "Gia realtime cat len EMA200 va MACD cat len Signal",
    });
  }
  if (liveRsi >= 80 && liveRsi <= 100) {
    signals.push({
      ...base,
      side: "EXIT_WARNING",
      reason: "RSI vao vung 80-100, can chot loi/ha ty trong",
    });
  }
  return signals;
}

function buildStopLossSignal(
  tick: DatabaseRadarTick,
  indicator: AdnSignalCoreIndicator,
  position: AdnSignalCorePosition,
): AdnSignalCoreSignal | null {
  const livePrice = alignMarketPriceToAnchor(tick.price, indicator.lastClose);
  if (livePrice == null || livePrice <= 0 || livePrice > position.stopLossPrice) return null;
  const liveEma200 = nextEma(indicator.ema200, livePrice, 200);
  const liveEma3 = nextEma(indicator.ema3, livePrice, 3);
  const liveEma10 = nextEma(indicator.ema10, livePrice, 10);
  const liveEma12 = nextEma(indicator.ema12, livePrice, 12);
  const liveEma26 = nextEma(indicator.ema26, livePrice, 26);
  const liveMacd = liveEma12 - liveEma26;
  const liveMacdSignal = nextEma(indicator.macdSignal, liveMacd, 9);
  const liveRsi = nextRsi(indicator.lastClose, livePrice, indicator.rsiAvgGain14, indicator.rsiAvgLoss14, 14);
  return {
    ticker: indicator.ticker,
    side: "EXIT_WARNING",
    adnSignal: ADN_SIGNAL_CORE_NAME,
    price: Math.round(livePrice),
    previousClose: Math.round(indicator.lastClose),
    ema200: Math.round(liveEma200),
    ema3: Number(liveEma3.toFixed(2)),
    ema10: Number(liveEma10.toFixed(2)),
    rsi14: Number(liveRsi.toFixed(2)),
    macd: Number(liveMacd.toFixed(3)),
    macdSignal: Number(liveMacdSignal.toFixed(3)),
    entryPrice: position.entryPrice,
    stopLossPrice: position.stopLossPrice,
    reason: `Stoploss -7% tu gia vao ${formatPrice(position.entryPrice)}`,
    providerTime: tick.providerTime,
    detectedAt: new Date().toISOString(),
  };
}

async function getAdnSignalCorePositions() {
  const row = await getDatabaseToolLatest<AdnSignalCorePositionsPayload>({
    tool: "radar",
    dataset: POSITIONS_DATASET,
    key: "latest",
    maxAgeMs: 30 * 24 * 60 * 60_000,
    ignoreExpires: true,
  });
  return row?.payload.positions ?? [];
}

async function updateAdnSignalCorePositions(params: {
  currentPositions: AdnSignalCorePosition[];
  signals: AdnSignalCoreSignal[];
}) {
  const positionsByTicker = new Map(params.currentPositions.map((position) => [position.ticker, position]));
  const now = new Date().toISOString();
  for (const signal of params.signals) {
    if (signal.side === "BUY") {
      if (!positionsByTicker.has(signal.ticker)) {
        const entryPrice = signal.entryPrice ?? signal.price;
        positionsByTicker.set(signal.ticker, {
          ticker: signal.ticker,
          entryPrice,
          entryAt: signal.detectedAt,
          stopLossPrice: signal.stopLossPrice ?? stopLossPrice(entryPrice),
          lastPrice: signal.price,
          lastSeenAt: signal.detectedAt,
        });
      }
      continue;
    }
    positionsByTicker.delete(signal.ticker);
  }
  const payload: AdnSignalCorePositionsPayload = {
    kind: "adn_signal_core_positions",
    version: "v1",
    adnSignal: ADN_SIGNAL_CORE_NAME,
    positions: Array.from(positionsByTicker.values()).map((position) => ({
      ...position,
      lastSeenAt: position.lastSeenAt || now,
    })),
    updatedAt: now,
  };
  await upsertDatabaseToolLatest({
    tool: "radar",
    dataset: POSITIONS_DATASET,
    key: "latest",
    payload,
    missingFields: [],
    providerStatus: { provider: "database", ok: true, endpoint: "database:adn-signal-core:positions" },
    ttlMs: 30 * 24 * 60 * 60_000,
  });
}

function getSignalTelegramTarget() {
  const token = (
    process.env.TELEGRAM_SIGNAL_BOT_TOKEN ??
    process.env.ADN_SUPPORT_TELEGRAM_BOT_TOKEN ??
    process.env.TELEGRAM_SUPPORT_BOT_TOKEN ??
    process.env.ADN_SUPPORT_BOT_TOKEN ??
    process.env.TELEGRAM_BOT_TOKEN ??
    ""
  ).trim();
  const chatId = (
    process.env.TELEGRAM_SIGNAL_CHAT_ID ??
    process.env.ADN_SUPPORT_TELEGRAM_CHAT_ID ??
    process.env.TELEGRAM_SUPPORT_CHAT_ID ??
    process.env.ADN_SUPPORT_CHAT_ID ??
    process.env.TELEGRAM_CHAT_ID ??
    ""
  ).trim();
  return { token, chatId };
}

function formatPrice(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatSignalCoreTelegram(signals: AdnSignalCoreSignal[], tradingDate: string, slotLabel: string) {
  const lines = [
    `ADN SIGNAL CORE - ${tradingDate}`,
    `Khung quet: ${slotLabel}`,
    `So tin hieu moi: ${signals.length}`,
    "",
  ];
  signals.forEach((signal, index) => {
    lines.push(`${index + 1}. ${signal.side} ${signal.ticker} @ ${formatPrice(signal.price)}`);
    lines.push(`   ${signal.reason}`);
    lines.push(`   RSI ${signal.rsi14} | MACD ${signal.macd}/${signal.macdSignal} | EMA200 ${formatPrice(signal.ema200)}`);
    if (signal.side === "BUY" && signal.stopLossPrice) {
      lines.push(`   Stoploss ${formatPrice(signal.stopLossPrice)} (-7%)`);
    }
  });
  lines.push("");
  lines.push("Nhanh noi bo, chua phai khuyen nghi dau tu.");
  return lines.join("\n");
}

async function filterNewSignalsForTelegram(signals: AdnSignalCoreSignal[], tradingDate: string) {
  const keys = signals.map((signal) => `adn-signal-core:${tradingDate}:${signal.ticker}:${signal.side}`);
  const existing = await prisma.telegramDispatchLog.findMany({
    where: { eventKey: { in: keys }, status: { in: ["sent", "sending"] } },
    select: { eventKey: true },
  });
  const sent = new Set(existing.map((row: { eventKey: string }) => row.eventKey));
  return signals.filter((signal) => !sent.has(`adn-signal-core:${tradingDate}:${signal.ticker}:${signal.side}`));
}

async function markSignalItemsDispatched(signals: AdnSignalCoreSignal[], tradingDate: string, slotLabel: string) {
  await Promise.all(
    signals.map((signal) => {
      const eventKey = `adn-signal-core:${tradingDate}:${signal.ticker}:${signal.side}`;
      return prisma.telegramDispatchLog.upsert({
        where: { eventKey },
        create: {
          eventKey,
          eventType: "ADN_SIGNAL_CORE_ITEM",
          tradingDate,
          slot: slotLabel,
          payloadHash: telegramHash(eventKey),
          targetChatIdHash: null,
          status: "sent",
          sentAt: new Date(),
        },
        update: {
          status: "sent",
          sentAt: new Date(),
          error: null,
        },
      });
    }),
  );
}

async function sendAdnSignalCoreToTelegram(params: {
  signals: AdnSignalCoreSignal[];
  tradingDate: string;
  slotLabel: string;
}) {
  if (!isAdnSignalCoreTelegramEnabled()) return { ok: true, sent: false, skipped: true, reason: "disabled" };
  const freshSignals = (await filterNewSignalsForTelegram(params.signals, params.tradingDate)).slice(0, maxTelegramItems());
  if (freshSignals.length === 0) return { ok: true, sent: false, skipped: true, reason: "duplicate_or_empty" };
  const { token, chatId } = getSignalTelegramTarget();
  const identity = freshSignals.map((signal) => `${signal.ticker}:${signal.side}`).sort().join("|");
  const eventKey = `adn-signal-core-batch:${params.tradingDate}:${params.slotLabel}:${telegramHash(identity).slice(0, 16)}`;
  const result = await sendTelegramOnce({
    eventType: "ADN_SIGNAL_CORE",
    eventKey,
    text: formatSignalCoreTelegram(freshSignals, params.tradingDate, params.slotLabel),
    token,
    chatId,
    tradingDate: params.tradingDate,
    slot: params.slotLabel,
  });
  if (result.ok && "sent" in result && result.sent) {
    await markSignalItemsDispatched(freshSignals, params.tradingDate, params.slotLabel);
  }
  return result;
}

export async function runAdnSignalCoreScan(options?: {
  realtime?: DatabaseRadarRealtimeState | null;
  slotLabel?: string;
  sendTelegram?: boolean;
}): Promise<DatabaseResult<AdnSignalCoreLatestPayload>> {
  const startedAt = Date.now();
  if (!isAdnSignalCoreEnabled()) {
    const payload: AdnSignalCoreLatestPayload = {
      kind: "adn_signal_core_latest",
      version: "v1",
      topic: ADN_SIGNAL_CORE_TOPIC,
      adnSignal: ADN_SIGNAL_CORE_NAME,
      tradingDate: dateKeyInVietnam(),
      slotLabel: options?.slotLabel ?? "realtime",
      signals: [],
      summary: { universe: 0, realtimeTicks: 0, detected: 0, buy: 0, exitWarning: 0, telegramSent: false, telegramSkippedReason: "disabled" },
      universeUpdatedAt: null,
      updatedAt: new Date().toISOString(),
    };
    return databaseOk(LATEST_DATASET, "database", payload, { provider: "database", ok: true, endpoint: "feature_flag" }, []);
  }
  const [universeRow, realtimeResult] = await Promise.all([
    getDatabaseToolLatest<AdnSignalCoreUniversePayload>({
      tool: "radar",
      dataset: UNIVERSE_DATASET,
      key: "latest",
      maxAgeMs: 24 * 60 * 60_000,
      ignoreExpires: true,
    }),
    options?.realtime ? Promise.resolve(null) : getDatabaseRadarRealtime(),
  ]);
  const realtime = options?.realtime ?? realtimeResult?.data ?? null;
  const indicators = universeRow?.payload.indicators ?? [];
  const indicatorByTicker = new Map(indicators.map((indicator) => [indicator.ticker, indicator]));
  const rawSignals = (realtime?.latest ?? []).flatMap((tick) => {
    const indicator = indicatorByTicker.get(tick.ticker);
    return indicator ? evaluateSignal(tick, indicator) : [];
  });
  const currentPositions = await getAdnSignalCorePositions();
  const positionsByTicker = new Map(currentPositions.map((position) => [position.ticker, position]));
  const tickByTicker = new Map((realtime?.latest ?? []).map((tick) => [tick.ticker, tick]));
  const stopLossSignals = currentPositions.flatMap((position) => {
    const tick = tickByTicker.get(position.ticker);
    const indicator = indicatorByTicker.get(position.ticker);
    const signal = tick && indicator ? buildStopLossSignal(tick, indicator, position) : null;
    return signal ? [signal] : [];
  });
  const stopLossTickers = new Set(stopLossSignals.map((signal) => signal.ticker));
  const signals = [
    ...stopLossSignals,
    ...rawSignals.filter((signal) => {
      if (stopLossTickers.has(signal.ticker)) return false;
      if (signal.side === "BUY") return !positionsByTicker.has(signal.ticker);
      return positionsByTicker.has(signal.ticker);
    }),
  ];
  await updateAdnSignalCorePositions({ currentPositions, signals });
  const tradingDate = realtime?.tradingDate ?? dateKeyInVietnam();
  let telegramSent = false;
  let telegramSkippedReason: string | null = null;
  if (options?.sendTelegram !== false && signals.length > 0) {
    const telegram = await sendAdnSignalCoreToTelegram({
      signals,
      tradingDate,
      slotLabel: options?.slotLabel ?? "realtime",
    }).catch((error) => ({ ok: false, sent: false, error: String(error) }));
    telegramSent = Boolean("sent" in telegram && telegram.sent);
    telegramSkippedReason = "skipped" in telegram && telegram.skipped ? telegram.reason : "error" in telegram ? telegram.error : null;
  }
  const payload: AdnSignalCoreLatestPayload = {
    kind: "adn_signal_core_latest",
    version: "v1",
    topic: ADN_SIGNAL_CORE_TOPIC,
    adnSignal: ADN_SIGNAL_CORE_NAME,
    tradingDate,
    slotLabel: options?.slotLabel ?? "realtime",
    signals,
    summary: {
      universe: indicators.length,
      realtimeTicks: realtime?.latest.length ?? 0,
      detected: signals.length,
      buy: signals.filter((signal) => signal.side === "BUY").length,
      exitWarning: signals.filter((signal) => signal.side === "EXIT_WARNING").length,
      telegramSent,
      telegramSkippedReason,
    },
    universeUpdatedAt: universeRow?.updatedAt ?? null,
    updatedAt: new Date().toISOString(),
  };
  await upsertDatabaseToolLatest({
    tool: "radar",
    dataset: LATEST_DATASET,
    key: "latest",
    tradingDate,
    payload,
    missingFields: indicators.length && realtime ? [] : ["adn_signal_core.universe_or_realtime"],
    providerStatus: { provider: "database", ok: indicators.length > 0 && Boolean(realtime), endpoint: "database:adn-signal-core" },
    ttlMs: 24 * 60 * 60_000,
  });
  const missingFields = [
    !universeRow ? "adn_signal_core.universe" : null,
    !realtime ? "adn_signal_core.realtime" : null,
  ].filter((item): item is string => Boolean(item));
  return databaseOk(LATEST_DATASET, "database", payload, {
    provider: "database",
    ok: missingFields.length === 0,
    endpoint: "database:adn-signal-core",
    latencyMs: Date.now() - startedAt,
    retryable: missingFields.length > 0,
  }, missingFields);
}

export async function collectAdnSignalCoreRealtime(options?: { timeoutMs?: number; maxMessages?: number }) {
  const universe = await getDatabaseToolLatest<AdnSignalCoreUniversePayload>({
    tool: "radar",
    dataset: UNIVERSE_DATASET,
    key: "latest",
    maxAgeMs: 24 * 60 * 60_000,
    ignoreExpires: true,
  });
  const tickers = universe?.payload.tickers ?? [];
  if (tickers.length === 0) return runAdnSignalCoreScan({ sendTelegram: false });
  const ws = await collectDnseLightspeedMessages({
    subscriptions: [{ name: "tick_extra.G1.json", symbols: tickers }],
    timeoutMs: options?.timeoutMs ?? 45_000,
    maxMessages: options?.maxMessages ?? 1_800,
  });
  const latestByTicker = new Map<string, DatabaseRadarTick>();
  for (const message of ws.messages) {
    if (!message || typeof message !== "object") continue;
    const record = message as JsonRecord;
    const ticker = String(record.symbol ?? record.Symbol ?? record.s ?? record.ticker ?? record.code ?? "").toUpperCase();
    if (!ticker || !tickers.includes(ticker)) continue;
    latestByTicker.set(ticker, {
      ticker,
      price: toNumber(record.matchPrice ?? record.lastPrice ?? record.price ?? record.close ?? record.c),
      reference: toNumber(record.reference ?? record.refPrice ?? record.basicPrice ?? record.previousClose),
      change: toNumber(record.changedValue ?? record.change ?? record.priceChange),
      changePct: toNumber(record.changedRatio ?? record.changePct ?? record.percentChange),
      volume: toNumber(record.totalVolumeTraded ?? record.matchVolume ?? record.volume ?? record.v),
      value: toNumber(record.grossTradeAmount ?? record.tradingValue ?? record.matchValue ?? record.value),
      high: toNumber(record.highestPrice ?? record.high ?? record.h),
      low: toNumber(record.lowestPrice ?? record.low ?? record.l),
      sourceChannel: String(record.channel ?? record.ch ?? "tick_extra.G1.json"),
      providerTime: null,
      updatedAt: new Date().toISOString(),
    });
  }
  const realtime: DatabaseRadarRealtimeState = {
    dataset: "radar.realtime",
    mode: "dnse-websocket-hotlist",
    tradingDate: dateKeyInVietnam(),
    tickers,
    latest: Array.from(latestByTicker.values()),
    coverage: {
      requested: tickers.length,
      covered: latestByTicker.size,
      coveragePct: tickers.length ? Number(((latestByTicker.size / tickers.length) * 100).toFixed(2)) : 0,
    },
    websocket: {
      opened: ws.opened,
      authenticated: ws.authenticated,
      receivedMessages: ws.messages.length,
      errors: ws.errors,
    },
    updatedAt: new Date().toISOString(),
  };
  return runAdnSignalCoreScan({ realtime, slotLabel: "manual", sendTelegram: false });
}

export async function getAdnSignalCoreLatest(): Promise<AdnSignalCoreLatestPayload | null> {
  const row = await getDatabaseToolLatest<AdnSignalCoreLatestPayload>({
    tool: "radar",
    dataset: LATEST_DATASET,
    key: "latest",
    maxAgeMs: 24 * 60 * 60_000,
    ignoreExpires: true,
  });
  return row?.payload ?? null;
}
