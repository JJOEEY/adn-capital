import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function parseJsonMaybe(value: string | null): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeSentenceList(content: string, fallback: string): string[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^[#*\-•\s]+/g, "").trim())
    .filter((line) => line.length >= 8)
    .slice(0, 6);

  if (lines.length === 0) return [fallback];
  return lines;
}

function toViDate(value: Date): string {
  return value.toLocaleDateString("vi-VN");
}

async function getLatestMorningReport() {
  return prisma.marketReport.findFirst({
    where: { type: "morning_brief" },
    orderBy: { createdAt: "desc" },
  });
}

async function getLatestEodReport() {
  return prisma.marketReport.findFirst({
    where: {
      type: { in: ["eod_full_19h", "close_brief_15h"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

function toMorningPayload(report: {
  createdAt: Date;
  content: string;
  rawData: string | null;
}) {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = raw?.snapshot as JsonRecord | undefined;
  const indices = Array.isArray(snapshot?.indices)
    ? (snapshot?.indices as JsonRecord[])
    : [];

  const referenceIndices = indices
    .map((item) => ({
      name: String(item.ticker ?? ""),
      value: asNumber(item.value),
      change_pct: asNumber(item.changePct),
    }))
    .filter((item) => item.name.length > 0);

  const lines = normalizeSentenceList(
    report.content,
    "Bản tin sáng đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu hiển thị.",
  );

  return {
    date: toViDate(report.createdAt),
    reference_indices: referenceIndices,
    vn_market: lines.slice(0, 2),
    macro: lines.slice(2, 4),
    risk_opportunity: lines.slice(4, 6),
  };
}

function toEodPayload(report: {
  createdAt: Date;
  content: string;
  rawData: string | null;
}) {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = raw?.snapshot as JsonRecord | undefined;
  const indices = Array.isArray(snapshot?.indices)
    ? (snapshot?.indices as JsonRecord[])
    : [];
  const vnindex = indices.find((item) => String(item.ticker ?? "") === "VNINDEX");
  const breadth = (snapshot?.breadth as JsonRecord | undefined) ?? {};
  const investor = (snapshot?.investorTrading as JsonRecord | undefined) ?? {};
  const foreign = (investor.foreign as JsonRecord | undefined) ?? {};
  const proprietary = (investor.proprietary as JsonRecord | undefined) ?? {};
  const retail = (investor.retail as JsonRecord | undefined) ?? {};

  const lines = normalizeSentenceList(
    report.content,
    "Bản tin kết phiên đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu hiển thị.",
  );

  const liquidity = asNumber(snapshot?.liquidity);
  const foreignNet = asNumber(foreign.net);
  const proprietaryNet = asNumber(proprietary.net);
  const retailNet = asNumber(retail.net);

  return {
    date: toViDate(report.createdAt),
    vnindex: asNumber(vnindex?.value),
    change_pct: asNumber(vnindex?.changePct),
    liquidity,
    breadth: {
      up: asNumber(breadth.up),
      down: asNumber(breadth.down),
      unchanged: asNumber(breadth.unchanged),
      total:
        asNumber(breadth.total) ||
        asNumber(breadth.up) + asNumber(breadth.down) + asNumber(breadth.unchanged),
    },
    session_summary: lines[0] ?? "",
    liquidity_detail:
      liquidity > 0
        ? `Thanh khoản toàn thị trường đạt ${Math.round(liquidity).toLocaleString("vi-VN")} tỷ đồng.`
        : "",
    foreign_flow:
      foreignNet !== 0
        ? `Khối ngoại ${foreignNet >= 0 ? "mua ròng" : "bán ròng"} ${Math.abs(foreignNet).toFixed(1)} tỷ.`
        : "",
    notable_trades:
      proprietaryNet !== 0 || retailNet !== 0
        ? `Tự doanh: ${proprietaryNet >= 0 ? "+" : ""}${proprietaryNet.toFixed(
            1,
          )} tỷ | Cá nhân: ${retailNet >= 0 ? "+" : ""}${retailNet.toFixed(1)} tỷ.`
        : "",
    outlook: lines[1] ?? "",
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
}

export async function GET(request: NextRequest) {
  const typeParam = request.nextUrl.searchParams.get("type") ?? "morning";
  if (typeParam !== "morning" && typeParam !== "eod") {
    return NextResponse.json({ error: "type phải là 'morning' hoặc 'eod'" }, { status: 400 });
  }

  if (typeParam === "morning") {
    const report = await getLatestMorningReport();
    if (!report) {
      return NextResponse.json(
        { error: "Chưa có Morning Brief hợp lệ để hiển thị." },
        { status: 404 },
      );
    }
    return NextResponse.json(toMorningPayload(report));
  }

  const report = await getLatestEodReport();
  if (!report) {
    return NextResponse.json(
      { error: "Chưa có EOD Brief hợp lệ để hiển thị." },
      { status: 404 },
    );
  }
  return NextResponse.json(toEodPayload(report));
}
