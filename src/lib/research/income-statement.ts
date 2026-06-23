// Kết quả kinh doanh (income statement) — LN trước thuế (LNTT) + LN sau thuế (LNST) + doanh thu
// theo quý, từ bridge /api/v1/income-statement (FiinQuant get_financial_statement). Đơn vị: tỷ đồng.
// Dùng cho ADN Stock (gọn) + có thể cho webchat. On-demand, cache RAM 6h.

import { getPythonBridgeUrl } from "@/lib/runtime-config";

const TTL_MS = 6 * 60 * 60 * 1000;
const TTL_EMPTY_MS = 10 * 60 * 1000;

export type IncomeStatementPeriod = {
  period: string; // "2025Q4"
  netRevenueBn: number | null; // doanh thu thuần (tỷ)
  profitBeforeTaxBn: number | null; // LN trước thuế (tỷ)
  profitAfterTaxBn: number | null; // LN sau thuế (tỷ)
  attributableToParentBn: number | null; // LNST cổ đông công ty mẹ (tỷ)
};

export type IncomeStatement = {
  ticker: string;
  periods: IncomeStatementPeriod[]; // mới → cũ
};

type CacheEntry = { data: IncomeStatement | null; expires: number };
const cache = new Map<string, CacheEntry>();

const toBn = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n / 1e9) : null;
};

export async function fetchIncomeStatement(ticker: string): Promise<IncomeStatement | null> {
  const code = (ticker || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(code)) return null;

  const hit = cache.get(code);
  if (hit && hit.expires > Date.now()) return hit.data;

  let result: IncomeStatement | null = null;
  try {
    const res = await fetch(`${getPythonBridgeUrl()}/api/v1/income-statement/${code}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000), // get_financial_statement có retry, có thể chậm
      headers: { "Content-Type": "application/json", "x-api-key": process.env.FIINQUANT_API_KEY ?? "" },
    });
    if (res.ok) {
      const json = (await res.json()) as { periods?: Array<Record<string, unknown>> };
      const rows = Array.isArray(json?.periods) ? json.periods : [];
      const periods = rows
        .map((p) => ({
          period: String(p.period ?? ""),
          netRevenueBn: toBn(p.netRevenue),
          profitBeforeTaxBn: toBn(p.profitBeforeTax),
          profitAfterTaxBn: toBn(p.profitAfterTax),
          attributableToParentBn: toBn(p.attributableToParent),
        }))
        .filter((p) => p.period && (p.profitBeforeTaxBn != null || p.profitAfterTaxBn != null));
      if (periods.length > 0) result = { ticker: code, periods };
    }
  } catch {
    result = null;
  }

  cache.set(code, { data: result, expires: Date.now() + (result ? TTL_MS : TTL_EMPTY_MS) });
  return result;
}

/** Tính tăng trưởng YoY (%) cho 1 metric: kỳ mới nhất so với cùng kỳ năm trước (cùng quý). */
export function incomeYoY(periods: IncomeStatementPeriod[], key: "profitBeforeTaxBn" | "profitAfterTaxBn" | "netRevenueBn"): number | null {
  if (periods.length === 0) return null;
  const latest = periods[0];
  const cur = latest[key];
  if (cur == null) return null;
  const q = latest.period.match(/Q(\d)/)?.[1];
  const y = Number(latest.period.slice(0, 4));
  if (!q || !Number.isFinite(y)) return null;
  const prior = periods.find((p) => p.period === `${y - 1}Q${q}`);
  const prev = prior?.[key];
  if (prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}
