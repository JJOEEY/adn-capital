import { prisma } from "@/lib/prisma";

// Số liệu thị trường CHUẨN (chỉ số + độ rộng + thanh khoản) từ DNSE 'mi' (market.eod, nguồn sàn, đúng PHIÊN
// MỚI NHẤT). Dùng làm facts AUTHORITATIVE cho AIDEN general_market — tránh AIDEN trích số stale (composite
// T-1 1869) hoặc số từ brief sáng (chỉ số tham chiếu phiên trước). Cache 60s.
export type CanonicalMarketFacts = {
  vnIndex: { value: number; changePct: number } | null;
  breadth: string; // "Tăng: X | Giảm: Y | Không đổi: Z" (full-market HSX+HNX+UPCOM)
  totalLiquidityBillion: number; // tổng GTGD all sàn (tỷ)
  indices: Array<{ name: string; value: number; changePct: number }>;
};

let cache: { at: number; data: CanonicalMarketFacts | null } | null = null;

export async function loadCanonicalMarketFacts(): Promise<CanonicalMarketFacts | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ idx: string; val: unknown; chg: unknown; up: unknown; down: unknown; steady: unknown; gross: unknown }>
    >`
      WITH latest AS (
        SELECT max("tradingDate") d FROM "DatabaseMarketLatest" WHERE dataset = 'market.eod' AND "payload"->>'T' = 'mi'
      )
      SELECT "payload"->>'indexName' AS idx,
        ("payload"->>'valueIndexes')::numeric AS val,
        ("payload"->>'changedRatio')::numeric AS chg,
        ("payload"->>'fluctuationUpIssueCount')::numeric AS up,
        ("payload"->>'fluctuationDownIssueCount')::numeric AS down,
        ("payload"->>'fluctuationSteadinessIssueCount')::numeric AS steady,
        ("payload"->>'grossTradeAmount')::numeric AS gross
      FROM "DatabaseMarketLatest"
      WHERE dataset = 'market.eod' AND "payload"->>'T' = 'mi' AND "tradingDate" = (SELECT d FROM latest)`;
    if (rows.length === 0) {
      cache = { at: Date.now(), data: null };
      return null;
    }
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    // Full-market = HSX + HNX + UPCOM (KHÔNG cộng VN30 vì là rổ con của HSX).
    const marketRows = rows.filter((r) => ["VNINDEX", "HNX", "UPCOM"].includes(String(r.idx).toUpperCase()));
    const vnRow = rows.find((r) => String(r.idx).toUpperCase() === "VNINDEX") ?? null;
    const breadth = marketRows.reduce(
      (acc, r) => ({ up: acc.up + num(r.up), down: acc.down + num(r.down), steady: acc.steady + num(r.steady) }),
      { up: 0, down: 0, steady: 0 },
    );
    const totalLiquidityBillion = Number(marketRows.reduce((sum, r) => sum + num(r.gross), 0).toFixed(1));
    const data: CanonicalMarketFacts = {
      vnIndex: vnRow ? { value: num(vnRow.val), changePct: num(vnRow.chg) } : null,
      breadth: `Tăng: ${breadth.up} | Giảm: ${breadth.down} | Không đổi: ${breadth.steady}`,
      totalLiquidityBillion,
      indices: marketRows.map((r) => ({ name: String(r.idx).toUpperCase(), value: num(r.val), changePct: num(r.chg) })),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}

function fmtVn(n: number, maxFractionDigits = 2) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: maxFractionDigits });
}

// Dựng đoạn TỔNG QUAN THỊ TRƯỜNG (chỉ số + độ rộng + thanh khoản) từ ô market đã merge facts canonical.
// Dùng cho FALLBACK general_market (khi LLM freemodel timeout) để AIDEN luôn trả số THỊ TRƯỜNG đúng + nhất
// quán thay vì rơi vào danh sách mã radar. Trả "" nếu không có facts.
export function buildMarketOverviewFromContext(context: unknown): string {
  const ctx = context && typeof context === "object" ? (context as Record<string, unknown>) : {};
  const market = ctx.market && typeof ctx.market === "object" ? (ctx.market as Record<string, unknown>) : {};
  const vn =
    market.vnIndex && typeof market.vnIndex === "object"
      ? (market.vnIndex as { value?: number; changePct?: number })
      : null;
  const breadth = typeof market.breadth === "string" ? market.breadth : null;
  const liq = typeof market.totalLiquidityBillion === "number" ? market.totalLiquidityBillion : null;
  const indices = Array.isArray(market.indices)
    ? (market.indices as Array<{ name: string; value: number; changePct: number }>)
    : [];
  if (!vn && !breadth) return "";
  const sign = (n: number) => (n >= 0 ? "+" : "");
  const label = (name: string) =>
    name === "VNINDEX" ? "VN-Index" : name === "HNX" ? "HNX-Index" : name === "UPCOM" ? "UPCOM-Index" : name;
  const order: Record<string, number> = { VNINDEX: 0, HNX: 1, UPCOM: 2 };
  const idxLines = [...indices]
    .filter((i) => typeof i.value === "number")
    .sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9))
    .map((i) => `**${label(i.name)} ${fmtVn(i.value)}** (${sign(i.changePct)}${fmtVn(i.changePct)}%)`);
  const head =
    idxLines.length > 0
      ? idxLines.join(" · ")
      : vn && typeof vn.value === "number"
        ? `**VN-Index ${fmtVn(vn.value)}** (${sign(vn.changePct ?? 0)}${fmtVn(vn.changePct ?? 0)}%)`
        : "";
  const parts: string[] = [];
  if (head) parts.push(head);
  if (breadth) parts.push(`Độ rộng toàn thị trường: ${breadth}`);
  if (liq != null) parts.push(`Tổng GTGD: ${fmtVn(liq, 0)} tỷ đồng`);
  if (parts.length === 0) return "";
  return `📊 **Dữ liệu thị trường hôm nay**\n\n${parts.map((p) => `- ${p}`).join("\n")}`;
}

// Ghép market overview canonical lên ĐẦU fallback (nếu chưa có), giữ phần còn lại (mã đáng chú ý) phía sau.
export function prependMarketOverview(context: unknown, fallback: string): string {
  const overview = buildMarketOverviewFromContext(context);
  if (!overview) return fallback;
  if (typeof fallback === "string" && /VN-Index/i.test(fallback)) return fallback;
  return fallback && fallback.trim() ? `${overview}\n\n${fallback}` : overview;
}

// Gắn facts CHUẨN vào object market của general_market context để AIDEN trích số đúng + nhất quán.
export function mergeCanonicalMarketFacts(market: unknown, facts: CanonicalMarketFacts | null): unknown {
  if (!facts) return market;
  const base: Record<string, unknown> =
    market && typeof market === "object" && !Array.isArray(market) ? { ...(market as Record<string, unknown>) } : {};
  if (facts.vnIndex) base.vnIndex = facts.vnIndex;
  base.breadth = facts.breadth;
  base.totalLiquidityBillion = facts.totalLiquidityBillion;
  base.indices = facts.indices;
  return base;
}
