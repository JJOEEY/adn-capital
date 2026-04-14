import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";
const TTL_MS = 5 * 60_000;

const cache: Record<"morning" | "eod", { data: unknown; ts: number } | undefined> = {
  morning: undefined,
  eod: undefined,
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const num = asNumber(value);
    if (num !== null) return num;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const str = asString(value);
    if (str) return str;
  }
  return null;
}

function firstStringArray(...values: unknown[]): string[] | null {
  for (const value of values) {
    const arr = asStringArray(value);
    if (arr) return arr;
  }
  return null;
}

function normalizeMorningPayload(raw: unknown) {
  const input = asRecord(raw);
  const referenceRaw =
    input.reference_indices ?? input.referenceIndices ?? input.reference_index ?? input.indices;

  const reference_indices = Array.isArray(referenceRaw)
    ? referenceRaw
        .map((item) => {
          const row = asRecord(item);
          const name = firstString(row.name, row.symbol, row.ticker) ?? "";
          const value = firstNumber(row.value, row.close, row.price) ?? 0;
          const change_pct = firstNumber(row.change_pct, row.changePercent, row.pct_change, row.pct) ?? 0;
          return { name, value, change_pct };
        })
        .filter((item) => item.name.length > 0)
    : [];

  return {
    ...input,
    date: firstString(input.date, input.generated_at, input.created_at) ?? MORNING_MOCK.date,
    reference_indices: reference_indices.length > 0 ? reference_indices : MORNING_MOCK.reference_indices,
    vn_market: firstStringArray(input.vn_market, input.vnMarket, input.market_summary) ?? MORNING_MOCK.vn_market,
    macro: firstStringArray(input.macro, input.macro_news, input.global_macro) ?? MORNING_MOCK.macro,
    risk_opportunity:
      firstStringArray(input.risk_opportunity, input.riskOpportunity, input.risk_and_opportunity) ??
      MORNING_MOCK.risk_opportunity,
  };
}

function normalizeEodPayload(raw: unknown) {
  const input = asRecord(raw);
  const breadthRaw = asRecord(input.breadth ?? input.market_breadth ?? input.breadth_stats);
  const up = firstNumber(breadthRaw.up, breadthRaw.advancers, breadthRaw.gainers, breadthRaw.increase) ?? 0;
  const down =
    firstNumber(breadthRaw.down, breadthRaw.decliners, breadthRaw.losers, breadthRaw.decrease) ?? 0;
  const unchanged =
    firstNumber(breadthRaw.unchanged, breadthRaw.flat, breadthRaw.no_change, breadthRaw.neutral) ?? 0;
  const total = firstNumber(breadthRaw.total, breadthRaw.total_stocks, breadthRaw.count_all) ?? up + down + unchanged;

  const liquidity =
    firstNumber(
      input.liquidity,
      input.total_volume,
      input.totalVolume,
      input.total_value,
      input.totalValue,
      input.market_liquidity,
    ) ?? 0;

  const liquidity_detail =
    firstString(
      input.liquidity_detail,
      input.liquidityDetail,
      input.total_volume_text,
      input.totalVolumeText,
      input.liquidity_note,
    ) ?? (liquidity > 0 ? `Thanh khoan toan thi truong dat ${Math.round(liquidity).toLocaleString("vi-VN")} ty dong.` : "");

  return {
    ...input,
    date: firstString(input.date, input.generated_at, input.created_at) ?? EOD_MOCK.date,
    vnindex: firstNumber(input.vnindex, input.vn_index, input.index_value) ?? 0,
    change_pct: firstNumber(input.change_pct, input.changePercent, input.pct_change) ?? 0,
    liquidity,
    breadth: { up, down, unchanged, total },
    session_summary: firstString(input.session_summary, input.summary, input.market_summary) ?? "",
    liquidity_detail,
    foreign_flow: firstString(input.foreign_flow, input.foreign_trading, input.foreign_net_flow) ?? "",
    notable_trades: firstString(input.notable_trades, input.proprietary_trading, input.notable_deals) ?? "",
    outlook: firstString(input.outlook, input.next_session_outlook, input.ai_outlook) ?? "",
    sub_indices: Array.isArray(input.sub_indices) ? input.sub_indices : [],
    foreign_top_buy: firstStringArray(input.foreign_top_buy, input.foreign_buy_top) ?? [],
    foreign_top_sell: firstStringArray(input.foreign_top_sell, input.foreign_sell_top) ?? [],
    prop_trading_top_buy:
      firstStringArray(input.prop_trading_top_buy, input.proprietary_top_buy, input.self_trading_top_buy) ?? [],
    prop_trading_top_sell:
      firstStringArray(input.prop_trading_top_sell, input.proprietary_top_sell, input.self_trading_top_sell) ?? [],
    sector_gainers: firstStringArray(input.sector_gainers, input.top_gainers_sector) ?? [],
    sector_losers: firstStringArray(input.sector_losers, input.top_losers_sector) ?? [],
    buy_signals: firstStringArray(input.buy_signals, input.signals_buy) ?? [],
    sell_signals: firstStringArray(input.sell_signals, input.signals_sell) ?? [],
    top_breakout: firstStringArray(input.top_breakout, input.breakout_top) ?? [],
  };
}

function normalizeNewsPayload(type: "morning" | "eod", raw: unknown) {
  return type === "morning" ? normalizeMorningPayload(raw) : normalizeEodPayload(raw);
}

export async function GET(request: NextRequest) {
  const typeParam = request.nextUrl.searchParams.get("type") ?? "morning";
  if (typeParam !== "morning" && typeParam !== "eod") {
    return NextResponse.json({ error: "type phai la 'morning' hoac 'eod'" }, { status: 400 });
  }

  const type = typeParam as "morning" | "eod";
  const cached = cache[type];
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/news/${type}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const fallback = type === "morning" ? MORNING_MOCK : EOD_MOCK;
      return NextResponse.json(fallback);
    }

    const raw = await res.json();
    const normalized = normalizeNewsPayload(type, raw);
    cache[type] = { data: normalized, ts: Date.now() };
    return NextResponse.json(normalized);
  } catch (error) {
    console.error(`[/api/market-news] fetch failed (${type})`, error);
    return NextResponse.json(type === "morning" ? MORNING_MOCK : EOD_MOCK);
  }
}

const MORNING_MOCK = {
  date: "01/04/2026",
  reference_indices: [
    { name: "VN-INDEX", value: 1702.93, change_pct: 1.7 },
    { name: "DOW JONES", value: 39124.5, change_pct: -0.5 },
    { name: "DXY", value: 104.15, change_pct: 0.15 },
    { name: "VANG", value: 2345.1, change_pct: 1.2 },
    { name: "DAU WTI", value: 85.6, change_pct: 2.1 },
  ],
  vn_market: [
    "Nhom chung khoan va ngan hang thu hut dong tien.",
    "Thanh khoan HoSE cai thien so voi trung binh 20 phien.",
  ],
  macro: [
    "GDP tang truong tich cuc va CPI nam trong tam kiem soat.",
    "DXY duy tri muc cao, can theo doi ap luc ty gia.",
  ],
  risk_opportunity: [
    "Rui ro: bien dong tu thi truong quoc te.",
    "Co hoi: dong von co dau hieu quay lai bluechips.",
  ],
};

const EOD_MOCK = {
  date: "01/04/2026",
  vnindex: 1702.93,
  change_pct: 1.7,
  liquidity: 22190,
  breadth: { up: 250, down: 180, unchanged: 70, total: 500 },
  session_summary: "VN-Index tang nhe, thanh khoan cai thien so voi phien truoc.",
  liquidity_detail: "Thanh khoan toan thi truong dat 22,190 ty dong.",
  foreign_flow: "Khoi ngoai giao dich can bang, tap trung nhom bluechips.",
  notable_trades: "Tu doanh mua rong nhe o mot so ma dan dat.",
  outlook: "Thi truong co the tiep tuc tich luy quanh vung hien tai.",
  sub_indices: [],
  foreign_top_buy: [],
  foreign_top_sell: [],
  prop_trading_top_buy: [],
  prop_trading_top_sell: [],
  sector_gainers: [],
  sector_losers: [],
  buy_signals: [],
  sell_signals: [],
  top_breakout: [],
};
