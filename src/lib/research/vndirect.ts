// Khuyến nghị/đồng thuận CTCK từ VNDirect finfo API (công khai, JSON).
// Trả về: số CTCK Mua/Giữ/Bán gần đây + giá mục tiêu trung bình (đồng thuận) + vài báo cáo mới nhất.
// Đơn vị giá: NGHÌN đồng (giống giá AIDEN dùng) — vd HPG targetPrice 35.4 = 35.400đ.
// Dùng on-demand (có cache RAM) trong luồng chat; KHÔNG copy nội dung báo cáo, chỉ số liệu khuyến nghị.

const API = "https://api-finfo.vndirect.com.vn/v4/recommendations";
const TTL_MS = 6 * 60 * 60 * 1000; // 6h
const RECENT_MONTHS = 18;

export type BrokerRecommendation = {
  firm: string;
  type: string; // BUY | HOLD | SELL (đã chuẩn hoá thô)
  targetPrice: number | null;
  reportPrice: number | null;
  reportDate: string;
  analyst: string | null;
};

export type BrokerConsensus = {
  total: number; // tổng số báo cáo có trong nguồn
  recent: number; // số báo cáo trong ~18 tháng gần đây
  buy: number;
  hold: number;
  sell: number;
  avgTargetPrice: number | null; // giá mục tiêu TB đồng thuận (nghìn đồng)
  latest: BrokerRecommendation[]; // tối đa 5 báo cáo gần nhất
};

type CacheEntry = { data: BrokerConsensus | null; expires: number };
const cache = new Map<string, CacheEntry>();

function bucket(type: unknown): "buy" | "hold" | "sell" {
  const t = String(type ?? "").toLowerCase();
  if (/buy|mua|outperform|overweight|add|accumulate|positive/.test(t)) return "buy";
  if (/sell|b[aá]n|underperform|underweight|reduce|negative/.test(t)) return "sell";
  return "hold";
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function fetchVndirectRecommendations(ticker: string): Promise<BrokerConsensus | null> {
  const code = (ticker || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(code)) return null;

  const hit = cache.get(code);
  if (hit && hit.expires > Date.now()) return hit.data;

  let result: BrokerConsensus | null = null;
  try {
    const url = `${API}?q=code:${code}&sort=reportDate:desc&size=40`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://dstock.vndirect.com.vn/" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (rows.length > 0) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - RECENT_MONTHS);
        const cutoffKey = cutoff.toISOString().slice(0, 10);
        const recent = rows.filter((r) => String(r.reportDate ?? "") >= cutoffKey);
        const scope = recent.length > 0 ? recent : rows.slice(0, 8);

        let buy = 0;
        let hold = 0;
        let sell = 0;
        for (const r of scope) {
          const b = bucket(r.type);
          if (b === "buy") buy += 1;
          else if (b === "sell") sell += 1;
          else hold += 1;
        }

        const avgFromApi = num((rows[0] as Record<string, unknown>).avgTargetPrice);
        const targets = scope.map((r) => num(r.targetPrice)).filter((n): n is number => n != null);
        const avgTargetPrice =
          avgFromApi ?? (targets.length ? Math.round((targets.reduce((a, b) => a + b, 0) / targets.length) * 100) / 100 : null);

        result = {
          total: rows.length,
          recent: recent.length,
          buy,
          hold,
          sell,
          avgTargetPrice,
          latest: scope.slice(0, 5).map((r) => ({
            firm: String(r.firm ?? "").trim() || "—",
            type: bucket(r.type).toUpperCase(),
            targetPrice: num(r.targetPrice),
            reportPrice: num(r.reportPrice),
            reportDate: String(r.reportDate ?? "").slice(0, 10),
            analyst: r.analyst ? String(r.analyst).trim() : null,
          })),
        };
      }
    }
  } catch {
    result = null;
  }

  cache.set(code, { data: result, expires: Date.now() + TTL_MS });
  return result;
}
