import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type IndexRow = {
  name: string;
  value: number;
  change_pct: number;
};

type MorningPayload = {
  date: string;
  reference_indices: Array<{
    name: string;
    value: number | null;
    change_pct: number | null;
  }>;
  vn_market: string[];
  macro: string[];
  risk_opportunity: string[];
};

type EodPayload = {
  date: string;
  vnindex: number;
  change_pct: number;
  liquidity: number;
  breadth: { up: number; down: number; unchanged: number; total: number };
  session_summary: string;
  liquidity_detail: string;
  foreign_flow: string;
  notable_trades: string;
  outlook: string;
  sub_indices: Array<{ name: string; change_pts: number; change_pct: number }>;
  foreign_top_buy: string[];
  foreign_top_sell: string[];
  prop_trading_top_buy: string[];
  prop_trading_top_sell: string[];
  sector_gainers: string[];
  sector_losers: string[];
  buy_signals: string[];
  sell_signals: string[];
  top_breakout: string[];
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
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = toNumberOrNull(value);
  return n ?? fallback;
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

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForCheck(text: string): string {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function isUnavailableText(text: string): boolean {
  if (!text?.trim()) return true;
  const n = normalizeForCheck(text);
  return (
    n.includes("chua cap nhat") ||
    n.includes("dang cap nhat") ||
    n.includes("khong co du lieu") ||
    n.includes("khong co thong tin") ||
    n.includes("n/a")
  );
}

function toViDate(value: Date): string {
  return value.toLocaleDateString("vi-VN");
}

function normalizeIndexName(raw: unknown): string {
  const source = String(raw ?? "").trim();
  const n = normalizeForCheck(source).replace(/[^a-z0-9]/g, "");
  if (n === "vnindex") return "VN-INDEX";
  if (n === "vn30") return "VN30";
  if (n === "hnxindex" || n === "hnx") return "HNX-INDEX";
  if (n === "upcomindex" || n === "upcom") return "UPCOM-INDEX";
  if (n === "dowjones" || n === "dow") return "DOW JONES";
  if (n === "dxy") return "DXY";
  if (n === "vang" || n === "gold") return "VÀNG";
  if (n === "dauwti" || n === "wti" || n === "oilwti") return "DẦU WTI";
  return source.toUpperCase();
}

function getSnapshot(raw: JsonRecord | null): JsonRecord {
  if (!raw) return {};
  const nested = pickRecord(raw, ["snapshot", "data", "payload"]);
  return nested ?? raw;
}

function normalizeSentenceList(content: string, fallback: string): string[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^[-*#>\s•]+/g, "").trim())
    .filter((line) => line.length >= 4)
    .slice(0, 12);
  if (lines.length === 0) return [fallback];
  return lines;
}

function parseIndexLine(content: string, ticker: "VN-INDEX" | "DOW JONES" | "DXY" | "VÀNG" | "DẦU WTI") {
  const escaped = ticker
    .replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
    .replace("VÀNG", "(?:VÀNG|VANG|GOLD)")
    .replace("DẦU WTI", "(?:DẦU\\s*WTI|DAU\\s*WTI|WTI)")
    .replace("DOW JONES", "(?:DOW\\s*JONES|DOWJONES)");

  const rgx = new RegExp(`${escaped}[^\\d]{0,12}([\\d.,]+)(?:\\s*\\|\\s*([+-]?[\\d.,]+)%)?`, "i");
  const match = content.match(rgx);
  if (!match) return null;
  return {
    value: toNumberOrNull(match[1]),
    change_pct: toNumberOrNull(match[2]),
  };
}

function extractIndices(snapshot: JsonRecord, content: string): IndexRow[] {
  const direct = pickArray(snapshot, ["indices", "reference_indices", "referenceIndices"]);
  const rows = direct
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

  const byName = new Map<string, IndexRow>();
  for (const row of rows) byName.set(row.name, row);

  const refs: Array<"VN-INDEX" | "DOW JONES" | "DXY" | "VÀNG" | "DẦU WTI"> = [
    "VN-INDEX",
    "DOW JONES",
    "DXY",
    "VÀNG",
    "DẦU WTI",
  ];
  for (const ref of refs) {
    if (byName.has(ref)) continue;
    const parsed = parseIndexLine(content, ref);
    if (!parsed?.value || parsed.value <= 0) continue;
    byName.set(ref, {
      name: ref,
      value: parsed.value,
      change_pct: parsed.change_pct ?? 0,
    });
  }

  if (!byName.has("VN-INDEX")) {
    const vn = rows.find((r) => normalizeForCheck(r.name).includes("vn"));
    if (vn) byName.set("VN-INDEX", { ...vn, name: "VN-INDEX" });
  }

  return Array.from(byName.values());
}

function parseBreadthFromString(raw: string) {
  const normalized = normalizeForCheck(raw);
  const upMatch = normalized.match(/(?:tang|up|↑)\s*(\d+)/);
  const downMatch = normalized.match(/(?:giam|down|↓)\s*(\d+)/);
  const unchMatch = normalized.match(/(?:khong doi|dung|unchanged|flat|→|=)\s*(\d+)/);
  if (upMatch || downMatch || unchMatch) {
    const up = upMatch ? Number.parseInt(upMatch[1], 10) : 0;
    const down = downMatch ? Number.parseInt(downMatch[1], 10) : 0;
    const unchanged = unchMatch ? Number.parseInt(unchMatch[1], 10) : 0;
    return { up, down, unchanged, total: up + down + unchanged };
  }

  const nums = raw.match(/\d+/g);
  if (nums && nums.length >= 3) {
    const up = Number.parseInt(nums[0], 10);
    const down = Number.parseInt(nums[1], 10);
    const unchanged = Number.parseInt(nums[2], 10);
    return { up, down, unchanged, total: up + down + unchanged };
  }
  return null;
}

function parseBreadth(raw: unknown, content: string): { up: number; down: number; unchanged: number; total: number } {
  if (isRecord(raw)) {
    const up = toNumber(raw.up);
    const down = toNumber(raw.down);
    const unchanged = toNumber(raw.unchanged);
    const total = toNumber(raw.total, up + down + unchanged);
    if (up + down + unchanged > 0) return { up, down, unchanged, total };
  }

  if (typeof raw === "string") {
    const parsed = parseBreadthFromString(raw);
    if (parsed) return parsed;
  }

  const line =
    content
      .split("\n")
      .map((x) => x.trim())
      .find((x) => normalizeForCheck(x).includes("do rong")) ?? "";
  const parsedFromContent = line ? parseBreadthFromString(line) : null;
  if (parsedFromContent) return parsedFromContent;

  return { up: 0, down: 0, unchanged: 0, total: 0 };
}

function parseLiquidityFromContent(content: string): number | null {
  const compact = content.replace(/\n/g, " ");
  const patterns = [
    /TK:\s*([\d.,]+)/i,
    /Thanh khoản[^0-9]{0,16}([\d.,]+)\s*tỷ/i,
    /Tổng:\s*([\d.,]+)\s*tỷ/i,
  ];
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) continue;
    const value = toNumberOrNull(match[1]);
    if (value !== null && value > 0) return value;
  }
  return null;
}

function pickContentLine(content: string, keyword: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^[-*#>\s•]+/g, "").trim())
    .filter(Boolean);
  const normalizedKeyword = normalizeForCheck(keyword);
  return (
    lines.find((line) => normalizeForCheck(line).includes(normalizedKeyword)) ?? ""
  );
}

function parseNetFromTextLine(line: string): number | null {
  if (!line) return null;
  const normalized = normalizeForCheck(line);
  const numberMatch = line.match(/([+-]?\d[\d.,]*)\s*tỷ/i);
  if (!numberMatch) return null;
  const value = toNumberOrNull(numberMatch[1]);
  if (value == null) return null;
  if (normalized.includes("ban rong")) return -Math.abs(value);
  if (normalized.includes("mua rong")) return Math.abs(value);
  return value;
}

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

function parseSubIndices(raw: unknown): Array<{ name: string; change_pts: number; change_pct: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = String(item.name ?? item.ticker ?? item.symbol ?? "").trim();
      if (!name) return null;
      return {
        name,
        change_pts: toNumber(item.change_pts ?? item.changePts ?? item.change ?? 0),
        change_pct: toNumber(item.change_pct ?? item.changePct ?? item.percentChange ?? 0),
      };
    })
    .filter((x): x is { name: string; change_pts: number; change_pct: number } => x !== null);
}

async function getRecentReports(types: string[], take = 60) {
  return prisma.marketReport.findMany({
    where: { type: { in: types } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

function toMorningPayload(report: { createdAt: Date; content: string; rawData: string | null }): MorningPayload {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const indices = extractIndices(snapshot, report.content);
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

function toEodPayload(report: { createdAt: Date; content: string; rawData: string | null }): EodPayload {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const indices = extractIndices(snapshot, report.content);
  const vnindex = indices.find((item) => item.name === "VN-INDEX");

  const breadth = parseBreadth(snapshot.breadth ?? snapshot.market_breadth, report.content);
  const liquidityByExchange = pickRecord(snapshot, ["liquidityByExchange", "liquidity_by_exchange"]) ?? {};
  const totalLiquidityRaw =
    toNumberOrNull(snapshot.liquidity) ??
    toNumberOrNull(liquidityByExchange.total) ??
    toNumberOrNull(snapshot.totalLiquidity) ??
    parseLiquidityFromContent(report.content) ??
    0;

  const investorRoot =
    pickRecord(snapshot, ["investorTrading", "investor_trading"]) ??
    pickRecord(raw ?? {}, ["investorTrading", "investor_trading"]) ??
    {};
  const foreign = pickRecord(investorRoot, ["foreign"]) ?? {};
  const proprietary = pickRecord(investorRoot, ["proprietary"]) ?? {};
  const retail = pickRecord(investorRoot, ["retail"]) ?? {};

  const foreignLineFromContent = pickContentLine(report.content, "khối ngoại");
  const propLineFromContent = pickContentLine(report.content, "tự doanh");
  const retailLineFromContent = pickContentLine(report.content, "cá nhân");

  const foreignNet =
    toNumberOrNull(foreign.net) ??
    toNumberOrNull(investorRoot.foreignNet) ??
    parseNetFromTextLine(foreignLineFromContent) ??
    null;
  const proprietaryNet =
    toNumberOrNull(proprietary.net) ??
    toNumberOrNull(investorRoot.proprietaryNet) ??
    parseNetFromTextLine(propLineFromContent) ??
    null;
  const retailNet =
    toNumberOrNull(retail.net) ??
    toNumberOrNull(investorRoot.retailNet) ??
    parseNetFromTextLine(retailLineFromContent) ??
    null;

  const lines = normalizeSentenceList(
    report.content,
    "Bản tin kết phiên đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu hiển thị.",
  );

  const sentimentLine =
    lines.find((line) => normalizeForCheck(line).includes("nhan dinh")) ??
    lines.find((line) => normalizeForCheck(line).includes("smart money")) ??
    lines[1] ??
    "";

  const liquidityByExchangeText = [
    toNumberOrNull(liquidityByExchange.HOSE),
    toNumberOrNull(liquidityByExchange.HNX),
    toNumberOrNull(liquidityByExchange.UPCOM),
  ];
  const hasExchangeLiquidity = liquidityByExchangeText.some((v) => v != null && v > 0);

  return {
    date: toViDate(report.createdAt),
    vnindex: toNumber(vnindex?.value),
    change_pct: toNumber(vnindex?.change_pct),
    liquidity: Math.max(totalLiquidityRaw, 0),
    breadth,
    session_summary: lines[0] ?? "",
    liquidity_detail:
      totalLiquidityRaw > 0
        ? `Thanh khoản toàn thị trường đạt ${Math.round(totalLiquidityRaw).toLocaleString("vi-VN")} tỷ đồng${
            hasExchangeLiquidity
              ? ` (HoSE ${Math.round(toNumber(liquidityByExchange.HOSE)).toLocaleString("vi-VN")} | HNX ${Math.round(
                  toNumber(liquidityByExchange.HNX),
                ).toLocaleString("vi-VN")} | UPCoM ${Math.round(toNumber(liquidityByExchange.UPCOM)).toLocaleString(
                  "vi-VN",
                )})`
              : ""
          }.`
        : "",
    foreign_flow:
      foreignNet != null
        ? `Khối ngoại ${foreignNet >= 0 ? "mua ròng" : "bán ròng"} ${Math.abs(foreignNet).toFixed(1)} tỷ.`
        : foreignLineFromContent,
    notable_trades:
      proprietaryNet != null || retailNet != null
        ? `Tự doanh: ${
            proprietaryNet == null ? "chưa cập nhật" : `${proprietaryNet >= 0 ? "+" : ""}${proprietaryNet.toFixed(1)} tỷ`
          } | Cá nhân: ${retailNet == null ? "chưa cập nhật" : `${retailNet >= 0 ? "+" : ""}${retailNet.toFixed(1)} tỷ`}.`
        : [propLineFromContent, retailLineFromContent].filter(Boolean).join(" | "),
    outlook: sentimentLine,
    sub_indices: parseSubIndices(raw?.sub_indices),
    foreign_top_buy: parseStringArray(raw?.foreign_top_buy),
    foreign_top_sell: parseStringArray(raw?.foreign_top_sell),
    prop_trading_top_buy: parseStringArray(raw?.prop_trading_top_buy),
    prop_trading_top_sell: parseStringArray(raw?.prop_trading_top_sell),
    sector_gainers: parseStringArray(raw?.sector_gainers),
    sector_losers: parseStringArray(raw?.sector_losers),
    buy_signals: parseStringArray(raw?.buy_signals),
    sell_signals: parseStringArray(raw?.sell_signals),
    top_breakout: parseStringArray(raw?.top_breakout),
  };
}

function hasValidMorningPayload(payload: MorningPayload): boolean {
  return payload.reference_indices.some(
    (item) => item.name === "VN-INDEX" && typeof item.value === "number" && item.value > 0,
  );
}

function hasValidEodPayload(payload: EodPayload): boolean {
  const hasVni = Number.isFinite(payload.vnindex) && payload.vnindex > 0;
  const hasBreadth = payload.breadth.total > 0;
  const hasLiquidity = Number.isFinite(payload.liquidity) && payload.liquidity > 0;
  const hasForeign = payload.foreign_flow.length > 0 && !isUnavailableText(payload.foreign_flow);
  const hasTrades = payload.notable_trades.length > 0 && !isUnavailableText(payload.notable_trades);
  const hasSummary = payload.session_summary.length > 0 && !isUnavailableText(payload.session_summary);
  return hasVni && (hasLiquidity || hasBreadth || hasForeign || hasTrades) && hasSummary;
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
