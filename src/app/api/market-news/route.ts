import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type IndexRow = {
  name: string;
  value: number;
  change_pct: number;
};

function parseJsonMaybe(value: string | null): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  const num = toNumberOrNull(value);
  return num ?? fallback;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function pickRecord(base: JsonRecord, keys: string[]): JsonRecord | null {
  for (const key of keys) {
    const value = base[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function pickArray(base: JsonRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = base[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeIndexName(raw: unknown): string {
  const text = String(raw ?? "").trim().toUpperCase();
  switch (text) {
    case "VNINDEX":
    case "VN-INDEX":
      return "VN-INDEX";
    case "HNXINDEX":
    case "HNX":
      return "HNX-INDEX";
    case "UPCOMINDEX":
    case "UPCOM":
      return "UPCOM-INDEX";
    case "DOWJONES":
    case "DOW JONES":
      return "DOW JONES";
    case "WTI":
    case "DAU WTI":
    case "DẦU WTI":
      return "DẦU WTI";
    case "VANG":
    case "VÀNG":
      return "VÀNG";
    default:
      return String(raw ?? "");
  }
}

function normalizeSentenceList(content: string, fallback: string): string[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^[-*#>\s•]+/g, "").trim())
    .filter((line) => line.length >= 6)
    .slice(0, 8);
  if (lines.length === 0) return [fallback];
  return lines;
}

function parseBreadth(raw: unknown): { up: number; down: number; unchanged: number; total: number } {
  if (isRecord(raw)) {
    const up = toNumber(raw.up);
    const down = toNumber(raw.down);
    const unchanged = toNumber(raw.unchanged);
    const total = toNumber(raw.total, up + down + unchanged);
    return { up, down, unchanged, total };
  }

  if (typeof raw === "string") {
    const normalized = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const upMatch = normalized.match(/(?:tang|up)[^\d]{0,8}(\d+)/);
    const downMatch = normalized.match(/(?:giam|down)[^\d]{0,8}(\d+)/);
    const unchMatch = normalized.match(/(?:khong doi|dung|unchanged|flat)[^\d]{0,8}(\d+)/);
    if (upMatch || downMatch || unchMatch) {
      const up = upMatch ? Number.parseInt(upMatch[1], 10) : 0;
      const down = downMatch ? Number.parseInt(downMatch[1], 10) : 0;
      const unchanged = unchMatch ? Number.parseInt(unchMatch[1], 10) : 0;
      return { up, down, unchanged, total: up + down + unchanged };
    }
    const numbers = raw.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
      const up = Number.parseInt(numbers[0], 10);
      const down = Number.parseInt(numbers[1], 10);
      const unchanged = Number.parseInt(numbers[2], 10);
      return { up, down, unchanged, total: up + down + unchanged };
    }
  }

  return { up: 0, down: 0, unchanged: 0, total: 0 };
}

function getSnapshot(raw: JsonRecord | null): JsonRecord {
  if (!raw) return {};
  const nested = pickRecord(raw, ["snapshot", "data", "payload"]);
  return nested ?? raw;
}

function extractIndices(snapshot: JsonRecord): IndexRow[] {
  const direct = pickArray(snapshot, ["indices", "reference_indices", "referenceIndices"]);
  const mapped = direct
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = normalizeIndexName(item.ticker ?? item.name ?? item.symbol ?? "");
      if (!name) return null;
      return {
        name,
        value: toNumber(item.value ?? item.close ?? item.price),
        change_pct: toNumber(item.changePct ?? item.change_pct ?? item.percentChange),
      } satisfies IndexRow;
    })
    .filter((item): item is IndexRow => item !== null);

  if (mapped.length > 0) return mapped;

  const result: IndexRow[] = [];
  const flatCandidates: Array<[string, string[]]> = [
    ["VN-INDEX", ["vnindex", "vnIndex"]],
    ["DOW JONES", ["dowJones", "dow_jones"]],
    ["DXY", ["dxy"]],
    ["VÀNG", ["gold", "vang"]],
    ["DẦU WTI", ["wti", "oil"]],
  ];

  for (const [name, keys] of flatCandidates) {
    const value = keys
      .map((key) => toNumberOrNull(snapshot[key]))
      .find((num): num is number => typeof num === "number");
    if (typeof value === "number") {
      result.push({ name, value, change_pct: 0 });
    }
  }

  return result;
}

function toViDate(value: Date): string {
  return value.toLocaleDateString("vi-VN");
}

async function getRecentReports(types: string[], take = 20) {
  return prisma.marketReport.findMany({
    where: { type: { in: types } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

function toMorningPayload(report: { createdAt: Date; content: string; rawData: string | null }) {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const indices = extractIndices(snapshot);

  const lines = normalizeSentenceList(
    report.content,
    "Bản tin sáng đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu thị trường.",
  );

  return {
    date: toViDate(report.createdAt),
    reference_indices: indices,
    vn_market: lines.slice(0, 2),
    macro: lines.slice(2, 4),
    risk_opportunity: lines.slice(4, 6),
  };
}

function toEodPayload(report: { createdAt: Date; content: string; rawData: string | null }) {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const indices = extractIndices(snapshot);
  const vnindex = indices.find((item) => item.name === "VN-INDEX");

  const breadth = parseBreadth(snapshot.breadth ?? snapshot.market_breadth);
  const liquidityByExchange = pickRecord(snapshot, ["liquidityByExchange", "liquidity_by_exchange"]) ?? {};
  const totalLiquidity =
    toNumberOrNull(snapshot.liquidity) ??
    toNumberOrNull(liquidityByExchange.total) ??
    toNumberOrNull(snapshot.totalLiquidity) ??
    0;

  const investorRoot =
    pickRecord(snapshot, ["investorTrading", "investor_trading"]) ??
    pickRecord(raw ?? {}, ["investorTrading", "investor_trading"]) ??
    {};
  const foreign = pickRecord(investorRoot, ["foreign"]) ?? {};
  const proprietary = pickRecord(investorRoot, ["proprietary"]) ?? {};
  const retail = pickRecord(investorRoot, ["retail"]) ?? {};

  const foreignNet = toNumberOrNull(foreign.net) ?? toNumberOrNull(investorRoot.foreignNet) ?? 0;
  const proprietaryNet =
    toNumberOrNull(proprietary.net) ?? toNumberOrNull(investorRoot.proprietaryNet) ?? 0;
  const retailNet = toNumberOrNull(retail.net) ?? toNumberOrNull(investorRoot.retailNet) ?? 0;

  const lines = normalizeSentenceList(
    report.content,
    "Bản tin kết phiên đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu hiển thị.",
  );

  return {
    date: toViDate(report.createdAt),
    vnindex: toNumber(vnindex?.value),
    change_pct: toNumber(vnindex?.change_pct),
    liquidity: Math.max(totalLiquidity, 0),
    breadth,
    session_summary: lines[0] ?? "",
    liquidity_detail:
      totalLiquidity > 0
        ? `Thanh khoản toàn thị trường đạt ${Math.round(totalLiquidity).toLocaleString("vi-VN")} tỷ đồng.`
        : "",
    foreign_flow:
      foreignNet !== 0
        ? `Khối ngoại ${foreignNet >= 0 ? "mua ròng" : "bán ròng"} ${Math.abs(foreignNet).toFixed(1)} tỷ.`
        : "",
    notable_trades:
      proprietaryNet !== 0 || retailNet !== 0
        ? `Tự doanh: ${proprietaryNet >= 0 ? "+" : ""}${proprietaryNet.toFixed(1)} tỷ | Cá nhân: ${
            retailNet >= 0 ? "+" : ""
          }${retailNet.toFixed(1)} tỷ.`
        : "",
    outlook: lines[1] ?? "",
    sub_indices: Array.isArray(raw?.sub_indices) ? raw?.sub_indices : [],
    foreign_top_buy: Array.isArray(raw?.foreign_top_buy) ? raw?.foreign_top_buy : [],
    foreign_top_sell: Array.isArray(raw?.foreign_top_sell) ? raw?.foreign_top_sell : [],
    prop_trading_top_buy: Array.isArray(raw?.prop_trading_top_buy) ? raw?.prop_trading_top_buy : [],
    prop_trading_top_sell: Array.isArray(raw?.prop_trading_top_sell) ? raw?.prop_trading_top_sell : [],
    sector_gainers: Array.isArray(raw?.sector_gainers) ? raw?.sector_gainers : [],
    sector_losers: Array.isArray(raw?.sector_losers) ? raw?.sector_losers : [],
    buy_signals: Array.isArray(raw?.buy_signals) ? raw?.buy_signals : [],
    sell_signals: Array.isArray(raw?.sell_signals) ? raw?.sell_signals : [],
    top_breakout: Array.isArray(raw?.top_breakout) ? raw?.top_breakout : [],
  };
}

function hasValidMorningPayload(payload: ReturnType<typeof toMorningPayload>): boolean {
  return payload.reference_indices.some(
    (item) => item.name === "VN-INDEX" && Number.isFinite(item.value) && item.value > 0,
  );
}

function hasValidEodPayload(payload: ReturnType<typeof toEodPayload>): boolean {
  const hasVni = Number.isFinite(payload.vnindex) && payload.vnindex > 0;
  const hasBreadth = payload.breadth.total > 0;
  const hasLiquidity = Number.isFinite(payload.liquidity) && payload.liquidity > 0;
  const hasInvestorData =
    payload.foreign_flow.length > 0 || payload.notable_trades.length > 0;
  return hasVni && (hasBreadth || hasLiquidity || hasInvestorData);
}

export async function GET(request: NextRequest) {
  const typeParam = request.nextUrl.searchParams.get("type") ?? "morning";
  if (typeParam !== "morning" && typeParam !== "eod") {
    return NextResponse.json({ error: "type phải là 'morning' hoặc 'eod'" }, { status: 400 });
  }

  if (typeParam === "morning") {
    const reports = await getRecentReports(["morning_brief"]);
    if (reports.length === 0) {
      return NextResponse.json({ error: "Chưa có Morning Brief hợp lệ để hiển thị." }, { status: 404 });
    }
    const payloads = reports.map((report) => toMorningPayload(report));
    const selected = payloads.find((payload) => hasValidMorningPayload(payload)) ?? payloads[0];
    return NextResponse.json(selected);
  }

  const reports = await getRecentReports(["eod_full_19h", "close_brief_15h"]);
  if (reports.length === 0) {
    return NextResponse.json({ error: "Chưa có EOD Brief hợp lệ để hiển thị." }, { status: 404 });
  }
  const payloads = reports.map((report) => toEodPayload(report));
  const selected = payloads.find((payload) => hasValidEodPayload(payload)) ?? payloads[0];
  return NextResponse.json(selected);
}
