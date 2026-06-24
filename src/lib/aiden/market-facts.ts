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
