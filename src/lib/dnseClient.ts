import { getVnDateISO } from "./time";

type JsonRecord = Record<string, unknown>;

export interface DnseMarketSnapshot {
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
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function readNumber(obj: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const num = toNumber(obj[key]);
    if (num != null) return num;
  }
  return null;
}

export async function fetchDnseMarketSnapshot(requestDateVN = getVnDateISO()): Promise<DnseMarketSnapshot | null> {
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
    const raw = await res.text();
    if (!raw?.trim()) return null;

    let json: JsonRecord;
    try {
      json = JSON.parse(raw) as JsonRecord;
    } catch {
      return null;
    }

    const liquidityByExchange: DnseMarketSnapshot["liquidityByExchange"] = {
      HOSE: readNumber(json, ["hose", "liquidity_hose", "liquidityHOSE"]),
      HNX: readNumber(json, ["hnx", "liquidity_hnx", "liquidityHNX"]),
      UPCOM: readNumber(json, ["upcom", "upcomindex", "liquidity_upcom", "liquidityUPCOM"]),
      total: readNumber(json, ["total", "liquidity_total", "liquidityTotal"]),
    };

    const investorTrading: DnseMarketSnapshot["investorTrading"] = {
      foreignNet: readNumber(json, ["foreign_net", "foreignNet"]),
      proprietaryNet: readNumber(json, ["proprietary_net", "proprietaryNet", "self_trading_net"]),
      retailNet: readNumber(json, ["retail_net", "retailNet", "individual_net"]),
    };

    return { liquidityByExchange, investorTrading };
  } catch {
    return null;
  }
}
