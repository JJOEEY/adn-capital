import { getVnDateISO } from "./time";

type JsonRecord = Record<string, unknown>;

type DnseIndexSymbol = "VNINDEX" | "HNXINDEX" | "UPCOMINDEX" | "VN30";

type DnseBreadthGroup = {
  up: number | null;
  down: number | null;
  unchanged: number | null;
  ceiling: number | null;
  floor: number | null;
};

export interface DnseIndexSnapshot {
  symbol: DnseIndexSymbol;
  value: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  liquidity: number | null;
}

export interface DnseMarketSnapshot {
  indices: DnseIndexSnapshot[];
  breadth: {
    total: DnseBreadthGroup | null;
    byExchange: {
      HOSE: DnseBreadthGroup | null;
      HNX: DnseBreadthGroup | null;
      UPCOM: DnseBreadthGroup | null;
    } | null;
  };
  liquidityByExchange: {
    HOSE: number | null;
    HNX: number | null;
    UPCOM: number | null;
    total: number | null;
  };
  investorTrading: {
    foreignNet: number | null;
    proprietaryNet: number | null;
    retailNet: number | null;
    availability: {
      foreign: boolean;
      proprietary: boolean;
      retail: boolean;
    };
  };
  source: string;
  timestamp: number;
  freshness: "fresh" | "stale";
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(obj: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const num = toNumber(obj[key]);
    if (num != null) return num;
  }
  return null;
}

function readString(obj: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const value = toStringValue(obj[key]);
    if (value) return value;
  }
  return null;
}

function normalizeSymbol(value: string | null): DnseIndexSymbol | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized === "VNINDEX") return "VNINDEX";
  if (normalized === "HNX" || normalized === "HNXINDEX") return "HNXINDEX";
  if (normalized === "UPCOM" || normalized === "UPCOMINDEX") return "UPCOMINDEX";
  if (normalized === "VN30" || normalized === "VN30INDEX") return "VN30";
  return null;
}

function normalizeBreadthGroup(raw: JsonRecord | null): DnseBreadthGroup | null {
  if (!raw) return null;
  const group: DnseBreadthGroup = {
    up: readNumber(raw, ["up", "advancers", "tang"]),
    down: readNumber(raw, ["down", "decliners", "giam"]),
    unchanged: readNumber(raw, ["unchanged", "noChange", "dung"]),
    ceiling: readNumber(raw, ["ceiling", "tran"]),
    floor: readNumber(raw, ["floor", "san"]),
  };
  const hasAny = Object.values(group).some((value) => value != null);
  return hasAny ? group : null;
}

function parseIndexRow(row: JsonRecord | null): DnseIndexSnapshot | null {
  if (!row) return null;
  const symbol = normalizeSymbol(
    readString(row, ["symbol", "index", "indexId", "ticker", "code"]),
  );
  if (!symbol) return null;
  return {
    symbol,
    value: readNumber(row, ["value", "indexValue", "close", "price"]),
    change: readNumber(row, ["change", "delta"]),
    changePct: readNumber(row, ["changePct", "percentChange", "pct", "change_percent"]),
    volume: readNumber(row, ["volume", "totalQtty", "totalVolume", "vol"]),
    liquidity: readNumber(row, ["liquidity", "totalVal", "totalValue", "value"]),
  };
}

function parseIndices(root: JsonRecord): DnseIndexSnapshot[] {
  const collected = new Map<DnseIndexSymbol, DnseIndexSnapshot>();

  const indexArrays = [
    ...toArray(root.indices),
    ...toArray(root.indexData),
    ...toArray(root.marketIndices),
  ];
  for (const item of indexArrays) {
    const parsed = parseIndexRow(toRecord(item));
    if (parsed) collected.set(parsed.symbol, parsed);
  }

  const singleCandidates: Array<[string, DnseIndexSymbol]> = [
    ["vnindex", "VNINDEX"],
    ["hnxindex", "HNXINDEX"],
    ["upcomindex", "UPCOMINDEX"],
    ["vn30", "VN30"],
  ];
  for (const [key, symbol] of singleCandidates) {
    const row = toRecord(root[key]);
    if (!row || collected.has(symbol)) continue;
    const parsed = parseIndexRow({ ...row, symbol });
    if (parsed) collected.set(symbol, parsed);
  }

  const ordered: DnseIndexSymbol[] = ["VNINDEX", "HNXINDEX", "UPCOMINDEX", "VN30"];
  return ordered
    .map((symbol) => collected.get(symbol) ?? null)
    .filter((row): row is DnseIndexSnapshot => Boolean(row));
}

function parseTimestamp(root: JsonRecord): number {
  const rawTs = readNumber(root, ["timestamp", "ts", "updatedAtMs"]);
  if (rawTs != null) {
    const ts = rawTs > 10_000_000_000 ? rawTs : rawTs * 1000;
    if (Number.isFinite(ts) && ts > 0) return Math.round(ts);
  }
  const updatedAt = readString(root, ["updatedAt", "datetime", "time"]);
  if (updatedAt) {
    const parsed = Date.parse(updatedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function parseFreshness(root: JsonRecord, timestamp: number): "fresh" | "stale" {
  const explicit = readString(root, ["freshness"]);
  if (explicit) {
    const normalized = explicit.toLowerCase();
    if (normalized === "fresh") return "fresh";
    if (normalized === "stale") return "stale";
  }
  return Date.now() - timestamp <= 120_000 ? "fresh" : "stale";
}

export async function fetchDnseMarketSnapshot(
  requestDateVN = getVnDateISO(),
): Promise<DnseMarketSnapshot | null> {
  const endpoint = process.env.DNSE_MARKET_SNAPSHOT_URL;
  const apiKey = process.env.DNSE_API_KEY;
  if (!endpoint || !apiKey) return null;

  try {
    const url = new URL(endpoint);
    if (!url.searchParams.has("date")) {
      url.searchParams.set("date", requestDateVN);
    }

    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return null;
    const rawText = await res.text();
    if (!rawText?.trim()) return null;

    const parsed = JSON.parse(rawText) as unknown;
    const outer = toRecord(parsed);
    if (!outer) return null;
    const root = toRecord(outer.data) ?? toRecord(outer.result) ?? outer;

    const liquidityRoot = toRecord(root.liquidityByExchange) ?? toRecord(root.liquidity) ?? root;
    const investorRoot = toRecord(root.investorTrading) ?? toRecord(root.investorFlow) ?? root;
    const breadthRoot = toRecord(root.breadth) ?? toRecord(root.marketBreadth) ?? root;
    const breadthByExchangeRoot =
      toRecord(breadthRoot.byExchange) ??
      toRecord(breadthRoot.exchange) ??
      toRecord(root.breadthByExchange);

    const liquidityByExchange: DnseMarketSnapshot["liquidityByExchange"] = {
      HOSE: readNumber(liquidityRoot, ["HOSE", "hose", "liquidity_hose", "liquidityHOSE"]),
      HNX: readNumber(liquidityRoot, ["HNX", "hnx", "liquidity_hnx", "liquidityHNX"]),
      UPCOM: readNumber(liquidityRoot, ["UPCOM", "upcom", "liquidity_upcom", "liquidityUPCOM"]),
      total: readNumber(liquidityRoot, ["total", "liquidity_total", "liquidityTotal"]),
    };

    const investorTrading: DnseMarketSnapshot["investorTrading"] = {
      foreignNet: readNumber(investorRoot, ["foreign_net", "foreignNet", "nn_net"]),
      proprietaryNet: readNumber(investorRoot, ["proprietary_net", "proprietaryNet", "self_trading_net", "tu_doanh_net"]),
      retailNet: readNumber(investorRoot, ["retail_net", "retailNet", "individual_net", "ca_nhan_net"]),
      availability: {
        foreign: false,
        proprietary: false,
        retail: false,
      },
    };
    investorTrading.availability.foreign = investorTrading.foreignNet != null;
    investorTrading.availability.proprietary = investorTrading.proprietaryNet != null;
    investorTrading.availability.retail = investorTrading.retailNet != null;

    const breadthTotal =
      normalizeBreadthGroup(toRecord(breadthRoot.total)) ??
      normalizeBreadthGroup(breadthRoot);
    const breadthByExchange: DnseMarketSnapshot["breadth"]["byExchange"] = breadthByExchangeRoot
      ? {
          HOSE: normalizeBreadthGroup(
            toRecord(breadthByExchangeRoot.HOSE) ??
              toRecord(breadthByExchangeRoot.hose) ??
              toRecord(breadthByExchangeRoot.VNINDEX),
          ),
          HNX: normalizeBreadthGroup(
            toRecord(breadthByExchangeRoot.HNX) ??
              toRecord(breadthByExchangeRoot.hnx) ??
              toRecord(breadthByExchangeRoot.HNXINDEX),
          ),
          UPCOM: normalizeBreadthGroup(
            toRecord(breadthByExchangeRoot.UPCOM) ??
              toRecord(breadthByExchangeRoot.upcom) ??
              toRecord(breadthByExchangeRoot.UPCOMINDEX),
          ),
        }
      : null;

    const indices = parseIndices(root);
    const timestamp = parseTimestamp(root);
    const source = readString(root, ["source", "provider"]) ?? "dnse";
    const freshness = parseFreshness(root, timestamp);

    const hasAnyData =
      indices.length > 0 ||
      Object.values(liquidityByExchange).some((value) => value != null) ||
      investorTrading.availability.foreign ||
      investorTrading.availability.proprietary ||
      investorTrading.availability.retail ||
      Boolean(breadthTotal);

    if (!hasAnyData) return null;

    return {
      indices,
      breadth: {
        total: breadthTotal,
        byExchange: breadthByExchange,
      },
      liquidityByExchange,
      investorTrading,
      source,
      timestamp,
      freshness,
    };
  } catch {
    return null;
  }
}
