// BCTC sâu đa kỳ — đọc mảng "ratios" (đã có sẵn, ~5 quý) từ FiinQuant bridge /api/v1/fundamental.
// Bridge trả mỗi quý: Revenue, AttributeToParentCompany (LN ròng), EBIT, ProfitabilityRatio(ROE/ROA/ROIC/EBITMargin),
// ValuationRatios(EPS/BVPS/PE/PB), Growth(NetRevenueGrowthYoY/EBTgrowthYoY), SolvencyRatio(LiabilitiesToEquityRatio).
// Collector cũ chỉ giữ tóm tắt 1 kỳ → util này lộ TREND đa kỳ cho AIDEN. On-demand, cache RAM 6h.

import { getPythonBridgeUrl } from "@/lib/runtime-config";

const TTL_MS = 6 * 60 * 60 * 1000; // cache kết quả tốt 6h
const TTL_EMPTY_MS = 10 * 60 * 1000; // cache rỗng/lỗi ngắn (tránh kẹt khi bridge chậm 1 lần)
const MAX_PERIODS = 5;

export type FinancialPeriod = {
  period: string; // "2025Q1" | "2025"
  revenueBn: number | null; // tỷ đồng
  netProfitBn: number | null; // tỷ đồng (LN sau thuế cổ đông công ty mẹ)
  ebitMarginPct: number | null;
  roePct: number | null;
  roaPct: number | null;
  revenueGrowthYoYPct: number | null;
  profitGrowthYoYPct: number | null;
  eps: number | null;
  deRatio: number | null; // nợ/vốn chủ
};

export type FinancialHistory = {
  ticker: string;
  periods: FinancialPeriod[]; // mới → cũ
};

type CacheEntry = { data: FinancialHistory | null; expires: number };
const cache = new Map<string, CacheEntry>();

/** Tìm sâu trong object lồng nhau giá trị số đầu tiên khớp một trong các key (không phân biệt hoa thường). */
function deepNum(obj: unknown, keys: string[]): number | null {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const visit = (value: unknown): number | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (wanted.has(k.toLowerCase())) {
          const n = typeof v === "number" ? v : Number(v);
          if (Number.isFinite(n)) return n;
        }
        const nested = visit(v);
        if (nested != null) return nested;
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        const nested = visit(item);
        if (nested != null) return nested;
      }
    }
    return null;
  };
  return visit(obj);
}

const round = (n: number | null, d = 1): number | null =>
  n == null ? null : Math.round(n * 10 ** d) / 10 ** d;
const toBn = (n: number | null): number | null => (n == null ? null : Math.round(n / 1e9));
const toPct = (n: number | null): number | null => (n == null ? null : round(n * 100, 1));

function mapPeriod(row: Record<string, unknown>): FinancialPeriod | null {
  const year = deepNum(row, ["year"]);
  const quarter = deepNum(row, ["quarter"]);
  const period = year ? (quarter ? `${year}Q${quarter}` : String(year)) : "";
  if (!period) return null;
  return {
    period,
    revenueBn: toBn(deepNum(row, ["Revenue", "NetRevenue", "netRevenue"])),
    netProfitBn: toBn(deepNum(row, ["AttributeToParentCompany", "NetProfit", "PostTaxProfit", "netProfit"])),
    ebitMarginPct: toPct(deepNum(row, ["EBITMargin"])),
    roePct: toPct(deepNum(row, ["ROE"])),
    roaPct: toPct(deepNum(row, ["ROA"])),
    revenueGrowthYoYPct: toPct(deepNum(row, ["NetRevenueGrowthYoY", "RevenueGrowthYoY"])),
    profitGrowthYoYPct: toPct(deepNum(row, ["EBTgrowthYoY", "NetProfitGrowthYoY", "ProfitGrowthYoY", "PostTaxProfitGrowthYoY"])),
    eps: round(deepNum(row, ["BasicEPS", "EPS"]), 0),
    deRatio: round(deepNum(row, ["LiabilitiesToEquityRatio", "DebtToEquity"]), 2),
  };
}

function hasAnyMetric(p: FinancialPeriod): boolean {
  return (
    p.revenueBn != null ||
    p.netProfitBn != null ||
    p.roePct != null ||
    p.revenueGrowthYoYPct != null ||
    p.profitGrowthYoYPct != null
  );
}

export async function fetchFinancialHistory(ticker: string): Promise<FinancialHistory | null> {
  const code = (ticker || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(code)) return null;

  const hit = cache.get(code);
  if (hit && hit.expires > Date.now()) return hit.data;

  let result: FinancialHistory | null = null;
  try {
    const res = await fetch(`${getPythonBridgeUrl()}/api/v1/fundamental/${code}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000), // endpoint nặng (~7.5s); nới rộng để không rớt dưới tải đồng thời
      headers: { "Content-Type": "application/json", "x-api-key": process.env.FIINQUANT_API_KEY ?? "" },
    });
    if (res.ok) {
      const json = (await res.json()) as { ratios?: Array<Record<string, unknown>> };
      const rows = Array.isArray(json?.ratios) ? json.ratios : [];
      const periods = rows
        .map(mapPeriod)
        .filter((p): p is FinancialPeriod => p != null && hasAnyMetric(p))
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, MAX_PERIODS);
      if (periods.length > 0) result = { ticker: code, periods };
    }
  } catch {
    result = null;
  }

  cache.set(code, { data: result, expires: Date.now() + (result ? TTL_MS : TTL_EMPTY_MS) });
  return result;
}
