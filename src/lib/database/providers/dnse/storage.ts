import type { Prisma } from "@prisma/client";
import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseError, databaseOk } from "@/lib/database/contracts";
import { prisma } from "@/lib/prisma";
import { collectDnseLightspeedMessages } from "@/lib/providers/dnse/lightspeed-ws";
import {
  DNSE_DEFAULT_EOD_SYMBOLS,
  DNSE_EOD_FIELD_MAP,
  dnseEodChannels,
  normalizeDnseSymbol,
} from "./eod-map";
import type { DnseEodMarketData, DnseMarketStorageCollectResult } from "./types";

type JsonRecord = Record<string, unknown>;

const DNSE_LIGHTSPEED_ENDPOINT = "wss://ws-openapi.dnse.com.vn/v1/stream";
const DATA_FIELDS = Array.from(new Set(DNSE_EOD_FIELD_MAP.flatMap((item) => item.dnseFields))).filter(
  (field) => field !== "fieldMap-derived",
);

function tradingDateInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function safeJson(value: JsonRecord): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const parsed = toNumber(record[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function readDate(record: JsonRecord | null): Date | null {
  const rawNumber = readNumber(record, ["transactTime", "timestamp", "time", "t"]);
  if (rawNumber != null && rawNumber > 0) {
    const ms = rawNumber > 10_000_000_000 ? rawNumber : rawNumber * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const rawString = readString(record, ["date", "tradingDate"]);
  if (!rawString) return null;
  const date = new Date(rawString);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeChannelName(channel: string) {
  return channel.trim().replace(/\.msgpack$/i, ".json");
}

function indexSymbolFromMessage(message: JsonRecord) {
  const raw = readString(message, ["symbol", "indexName", "marketId", "marketIndexClass"]);
  const compact = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return null;
  if (compact.includes("VN30")) return "VN30";
  if (compact.includes("UPCOM") || compact === "UPX") return "UPCOMINDEX";
  if (compact.includes("HNX")) return "HNXINDEX";
  if (compact.includes("VNINDEX") || compact === "VNI" || compact === "STX") return "VNINDEX";
  return normalizeDnseSymbol(compact);
}

function channelFromMessage(message: JsonRecord) {
  const explicit = readString(message, ["channel", "ch", "topic", "stream"]);
  if (explicit) return normalizeChannelName(explicit);
  const type = messageTypeFromMessage(message);
  if (type === "mi") return `market_index.${indexSymbolFromMessage(message) ?? "VNINDEX"}.json`;
  if (type === "f") return "foreign.G1.json";
  if (type === "te") return "ohlc_closed.1D.json";
  return "unknown";
}

function messageTypeFromMessage(message: JsonRecord) {
  return readString(message, ["T", "t", "action", "type", "event"]);
}

function symbolFromChannel(channel: string) {
  const match = channel.match(/^market_index\.([A-Z0-9]+)\.json$/i);
  if (!match?.[1]) return null;
  return normalizeDnseSymbol(match[1]);
}

function symbolFromMessage(message: JsonRecord, channel: string) {
  return (
    normalizeDnseSymbol(readString(message, ["symbol", "Symbol", "s", "ticker", "code"])) ||
    (channel.startsWith("market_index.") ? indexSymbolFromMessage(message) : null) ||
    symbolFromChannel(channel) ||
    "MARKET"
  );
}

function hasDataPayload(message: JsonRecord) {
  const action = readString(message, ["action", "event"]);
  if (action && ["auth_success", "authenticated", "subscribed", "subscribe_success"].includes(action)) return false;
  return DATA_FIELDS.some((field) => message[field] != null) || Boolean(readString(message, ["symbol", "s", "ticker", "code"]));
}

function messageKeys(messages: JsonRecord[]) {
  return Array.from(new Set(messages.flatMap((message) => Object.keys(message)))).sort();
}

function hasAnyField(messages: JsonRecord[], fields: string[]) {
  return messages.some((message) => fields.some((field) => message[field] != null));
}

function messageTypes(messages: JsonRecord[]) {
  return Array.from(new Set(messages.map((message) => String(message.T ?? message.t ?? message.action ?? message.channel ?? "unknown"))));
}

function latestReceivedAt(rows: Array<{ receivedAt: Date }>) {
  return rows.reduce<Date | null>((latest, row) => {
    if (!latest || row.receivedAt > latest) return row.receivedAt;
    return latest;
  }, null);
}

function sumValues(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => value != null);
  return numbers.length ? numbers.reduce((total, value) => total + value, 0) : null;
}

function buildEodDataFromMessages(params: {
  tradingDate: string;
  channels: Array<{ name: string; symbols: string[] }>;
  latestRows: Array<{ channel: string; symbol: string; payload: Prisma.JsonValue; receivedAt: Date }>;
  eventRows: number;
}): DnseEodMarketData {
  const rowCandidates = params.latestRows.map((row) => {
    const payload = toRecord(row.payload);
    const channel = payload ? channelFromMessage(payload) : normalizeChannelName(row.channel);
    const symbol = payload && (!row.symbol || row.symbol === "MARKET")
      ? symbolFromMessage(payload, channel)
      : normalizeDnseSymbol(row.symbol);
    return { ...row, channel, symbol, payload };
  });
  const rowsByKey = new Map<string, (typeof rowCandidates)[number]>();
  for (const row of rowCandidates) {
    if (!row.payload || !hasDataPayload(row.payload)) continue;
    const key = `${row.channel}:${row.symbol}`;
    if (!rowsByKey.has(key)) rowsByKey.set(key, row);
  }
  const rows = Array.from(rowsByKey.values());
  const messages = rows.map((row) => row.payload).filter((item): item is JsonRecord => Boolean(item));
  const activeChannels = Array.from(new Set(rows.map((row) => row.channel))).filter(Boolean);
  const presentFields = messageKeys(messages);
  const fiinquantEnrichmentFields = DNSE_EOD_FIELD_MAP.filter((item) => item.source === "fiinquant_enrichment").map((item) => item.field);
  const unavailable = DNSE_EOD_FIELD_MAP
    .filter((item) =>
      item.source !== "fiinquant_enrichment" &&
      item.dnseFields.length > 0 &&
      !item.dnseFields.includes("fieldMap-derived") &&
      !hasAnyField(messages, item.dnseFields),
    )
    .map((item) => item.field);

  const indexRows = rows.filter((row) => row.channel.startsWith("market_index."));
  const indices = indexRows.map((row) => {
    const payload = toRecord(row.payload);
    return {
      ticker: row.symbol,
      value: readNumber(payload, ["valueIndexes", "indexValue", "value", "close"]),
      change: readNumber(payload, ["changedValue", "change"]),
      changePct: readNumber(payload, ["changedRatio", "changePct", "percentChange"]),
      volume: readNumber(payload, ["totalVolumeTraded", "contauctAccTrdVol", "volume"]),
      updatedAt: row.receivedAt.toISOString(),
    };
  });

  const indexPayloads = indexRows.map((row) => toRecord(row.payload));
  const foreignPayloads = rows.filter((row) => row.channel === "foreign.G1.json").map((row) => row.payload);
  const ohlcv = rows
    .filter((row) => row.channel === "ohlc_closed.1D.json")
    .map((row) => {
      const payload = row.payload;
      return {
        ticker: row.symbol,
        open: readNumber(payload, ["open", "openPrice", "o"]),
        high: readNumber(payload, ["high", "highestPrice", "h"]),
        low: readNumber(payload, ["low", "lowestPrice", "l"]),
        close: readNumber(payload, ["close", "matchPrice", "c"]),
        volume: readNumber(payload, ["volume", "v", "totalVolumeTraded"]),
        value: readNumber(payload, ["value", "tradingValue", "grossTradeAmount"]),
        updatedAt: row.receivedAt.toISOString(),
      };
    });

  const buyValue = sumValues(foreignPayloads.map((payload) => readNumber(payload, ["totalBuyTradedAmount", "buyTradedAmount"])));
  const sellValue = sumValues(foreignPayloads.map((payload) => readNumber(payload, ["totalSellTradedAmount", "sellTradedAmount"])));
  const lastReceivedAt = latestReceivedAt(params.latestRows);
  const missingFields = [
    ...unavailable.map((field) => `${field}:not-in-database`),
    ...fiinquantEnrichmentFields.map((field) => `${field}:requires-fiinquant-enrichment`),
  ];

  return {
    mode: "database-storage",
    channels: params.channels,
    fieldMap: DNSE_EOD_FIELD_MAP,
    runtimeCoverage: {
      messages: messages.length,
      latestRows: params.latestRows.length,
      eventRows: params.eventRows,
      activeChannels,
      observedMessageTypes: messageTypes(messages),
      presentFields,
      missingFields,
    },
    storage: {
      tradingDate: params.tradingDate,
      lastReceivedAt: lastReceivedAt?.toISOString() ?? null,
      lastCollectorRunAt: lastReceivedAt?.toISOString() ?? null,
    },
    indices,
    breadth: {
      up: sumValues(indexPayloads.map((payload) => readNumber(payload, ["fluctuationUpIssueCount"]))),
      down: sumValues(indexPayloads.map((payload) => readNumber(payload, ["fluctuationDownIssueCount"]))),
      unchanged: sumValues(indexPayloads.map((payload) => readNumber(payload, ["fluctuationSteadinessIssueCount"]))),
      ceiling: sumValues(indexPayloads.map((payload) => readNumber(payload, ["fluctuationUpperLimitIssueCount"]))),
      floor: sumValues(indexPayloads.map((payload) => readNumber(payload, ["fluctuationLowerLimitIssueCount"]))),
    },
    liquidity: {
      matchedValue: sumValues(indexPayloads.map((payload) => readNumber(payload, ["contauctAccTrdVal", "grossTradeAmount"]))),
      matchedVolume: sumValues(indexPayloads.map((payload) => readNumber(payload, ["contauctAccTrdVol", "totalVolumeTraded"]))),
      negotiatedValue: sumValues(indexPayloads.map((payload) => readNumber(payload, ["blkTrdAccTrdVal"]))),
      negotiatedVolume: sumValues(indexPayloads.map((payload) => readNumber(payload, ["blkTrdAccTrdVol"]))),
    },
    foreignFlow: {
      buyValue,
      sellValue,
      netValue: buyValue != null && sellValue != null ? buyValue - sellValue : null,
    },
    ohlcv,
  };
}

export async function collectDnseEodMarketToDatabase(options?: {
  symbols?: string[];
  timeoutMs?: number;
  maxMessages?: number;
  tradingDate?: string;
}): Promise<DnseMarketStorageCollectResult> {
  const startedAt = new Date();
  const tradingDate = options?.tradingDate ?? tradingDateInVietnam(startedAt);
  const symbols = Array.from(new Set((options?.symbols?.length ? options.symbols : [...DNSE_DEFAULT_EOD_SYMBOLS]).map(normalizeDnseSymbol).filter(Boolean)));
  const channels = dnseEodChannels(symbols);
  const ws = await collectDnseLightspeedMessages({
    subscriptions: channels,
    timeoutMs: options?.timeoutMs ?? 15_000,
    maxMessages: options?.maxMessages ?? Math.min(Math.max(160, symbols.length * 3), 600),
  });

  let storedEvents = 0;
  let updatedLatest = 0;
  const activeChannels = new Set<string>();
  const errors = [...ws.errors];

  if (ws.authenticated && ws.messages.length) {
    for (const message of ws.messages) {
      const channel = channelFromMessage(message);
      const symbol = symbolFromMessage(message, channel);
      const messageType = messageTypeFromMessage(message);
      const providerTime = readDate(message);
      activeChannels.add(channel);
      const payload = safeJson(message);
      try {
        await prisma.databaseMarketEvent.create({
          data: {
            source: "dnse",
            dataset: "market.eod",
            channel,
            symbol,
            messageType,
            tradingDate,
            providerTime,
            payload,
          },
        });
        storedEvents += 1;
        if (hasDataPayload(message)) {
          await prisma.databaseMarketLatest.upsert({
            where: {
              source_channel_symbol_tradingDate: {
                source: "dnse",
                channel,
                symbol,
                tradingDate,
              },
            },
            create: {
              source: "dnse",
              dataset: "market.eod",
              channel,
              symbol,
              tradingDate,
              providerTime,
              payload,
            },
            update: {
              dataset: "market.eod",
              providerTime,
              payload,
              receivedAt: new Date(),
            },
          });
          updatedLatest += 1;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180));
      }
    }
  }

  const missingFields = [];
  if (!ws.opened) missingFields.push("websocket.open");
  if (!ws.authenticated) missingFields.push("websocket.auth");
  if (!updatedLatest) missingFields.push("database.market.latest");

  return {
    ok: ws.authenticated && updatedLatest > 0 && errors.length === 0,
    source: "dnse",
    dataset: "market.eod",
    tradingDate,
    opened: ws.opened,
    authenticated: ws.authenticated,
    receivedMessages: ws.messages.length,
    storedEvents,
    updatedLatest,
    channels,
    activeChannels: Array.from(activeChannels),
    errors,
    missingFields,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

export async function getStoredDnseEodMarketDataset(options?: {
  symbols?: string[];
  tradingDate?: string;
}): Promise<DatabaseResult<DnseEodMarketData>> {
  const startedAt = Date.now();
  const tradingDate = options?.tradingDate ?? tradingDateInVietnam();
  const symbols = Array.from(new Set((options?.symbols?.length ? options.symbols : [...DNSE_DEFAULT_EOD_SYMBOLS]).map(normalizeDnseSymbol).filter(Boolean)));
  const channels = dnseEodChannels(symbols);
  try {
    const where = {
      source: "dnse",
      dataset: "market.eod",
      tradingDate,
    };
    const [latestRows, eventRows, eventSamples] = await Promise.all([
      prisma.databaseMarketLatest.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.databaseMarketEvent.count({ where }),
      prisma.databaseMarketEvent.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: 600,
        select: {
          channel: true,
          symbol: true,
          payload: true,
          receivedAt: true,
        },
      }),
    ]);

    const eventRowsForBuild = eventSamples.map((row) => ({
      ...row,
      symbol: row.symbol ?? "MARKET",
    }));
    const data = buildEodDataFromMessages({ tradingDate, channels, latestRows: [...latestRows, ...eventRowsForBuild], eventRows });
    const storedRows = data.runtimeCoverage.latestRows ?? 0;
    const missingFields = storedRows
      ? data.runtimeCoverage.missingFields
      : ["database.market.latest:empty", ...data.runtimeCoverage.missingFields];
    const providerStatus: DatabaseProviderStatus = {
      provider: "dnse",
      ok: storedRows > 0 && missingFields.length === 0,
      endpoint: "postgres:DatabaseMarketLatest+DatabaseMarketEvent",
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      code: storedRows ? (missingFields.length ? "database_v2_eod_partial" : undefined) : "database_v2_eod_empty",
      message: storedRows
        ? missingFields.length
          ? "Database v2 has DNSE market rows, but EOD coverage is still partial."
          : undefined
        : "Database v2 has no DNSE EOD rows for this trading date. Run the DNSE collector during market hours.",
      retryable: storedRows === 0,
    };
    return databaseOk("market.eod", "dnse", data, providerStatus, missingFields);
  } catch (error) {
    return databaseError("market.eod", "dnse", {
      provider: "dnse",
      ok: false,
      endpoint: "postgres:DatabaseMarketLatest",
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      code: "database_v2_storage_unavailable",
      message: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
      retryable: true,
    }, ["database.market.storage"]);
  }
}
