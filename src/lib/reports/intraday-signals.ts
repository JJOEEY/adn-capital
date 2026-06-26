// Report "📊 TÍN HIỆU" (10h/11h30/14h/15h): vượt đỉnh / phá đáy 1M-3M + đi nền lâu + NN gom/xả.
// Data: bridge /api/v1/intraday-signals (OHLCV-based, ADTV>=1 tỷ) + vnstock investor-flow (foreign).
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { getVNDateString } from "@/lib/cronHelpers";
import { fetchVnstockInvestorFlow } from "@/lib/vnstockClient";

export type IntradaySignals = {
  ok?: boolean;
  breakout_1m?: string[];
  breakout_3m?: string[];
  breakdown_1m?: string[];
  breakdown_3m?: string[];
  long_base?: string[];
};

async function fetchIntradaySignals(): Promise<IntradaySignals | null> {
  try {
    const res = await fetch(`${getPythonBridgeUrl()}/api/v1/intraday-signals?limit=12`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as IntradaySignals;
  } catch {
    return null;
  }
}

function pickForeignBucket(
  flow: Awaited<ReturnType<typeof fetchVnstockInvestorFlow>>,
): { topBuy?: { ticker: string }[]; topSell?: { ticker: string }[] } | null {
  const foreign = flow?.foreign ?? {};
  let best: { topBuy?: { ticker: string }[]; topSell?: { ticker: string }[] } | null = null;
  let bestN = -1;
  for (const v of Object.values(foreign)) {
    const n = (v?.topBuy?.length ?? 0) + (v?.topSell?.length ?? 0);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return bestN > 0 ? best : null;
}

const joinT = (arr?: Array<string | { ticker: string }>, max = 12): string => {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr
    .slice(0, max)
    .map((x) => (typeof x === "string" ? x : x?.ticker))
    .filter(Boolean)
    .join(", ");
};

/** Dựng text report. timeLabel vd "14:00". Trả {text, empty}. */
export async function buildIntradaySignalsReport(timeLabel: string): Promise<{ text: string; empty: boolean }> {
  const [sig, flow] = await Promise.all([
    fetchIntradaySignals(),
    fetchVnstockInvestorFlow({ top: 12 }).catch(() => null),
  ]);
  const [, m, d] = getVNDateString().split("-");
  const dateLabel = `${d}/${m}`;
  const fb = pickForeignBucket(flow);

  const lines: string[] = [`📊 TÍN HIỆU (${timeLabel} ${dateLabel})`, "━".repeat(28)];

  const bo1 = joinT(sig?.breakout_1m);
  const bo3 = joinT(sig?.breakout_3m);
  if (bo1 || bo3) {
    lines.push("", "🚀 VƯỢT ĐỈNH");
    if (bo1) lines.push(`• Vượt đỉnh 1 tháng: ${bo1}`);
    if (bo3) lines.push(`• Vượt đỉnh 3 tháng: ${bo3}`);
  }

  const base = joinT(sig?.long_base);
  if (base) {
    lines.push("", "📊 ĐI NỀN LÂU");
    lines.push(`• Tích lũy chặt (≈2 tháng): ${base}`);
  }

  const gom = joinT(fb?.topBuy);
  const xa = joinT(fb?.topSell);
  if (gom || xa) {
    lines.push("", "🦈 KHỐI NGOẠI");
    if (gom) lines.push(`📈 GOM: ${gom}`);
    if (xa) lines.push(`📉 XẢ: ${xa}`);
  }

  const bd1 = joinT(sig?.breakdown_1m);
  const bd3 = joinT(sig?.breakdown_3m);
  if (bd1 || bd3) {
    lines.push("", "📉 PHÁ ĐÁY");
    if (bd1) lines.push(`• Phá đáy 1 tháng: ${bd1}`);
    if (bd3) lines.push(`• Phá đáy 3 tháng: ${bd3}`);
  }

  const empty = !(bo1 || bo3 || base || gom || xa || bd1 || bd3);
  lines.push("", "⚠️ Dữ liệu tham khảo, không phải khuyến nghị đầu tư.");
  return { text: lines.join("\n"), empty };
}
