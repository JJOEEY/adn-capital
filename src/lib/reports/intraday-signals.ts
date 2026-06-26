// Report "📊 TÍN HIỆU" (10h/11h30/14h/15h): vượt đỉnh / phá đáy 1M-3M + đi nền lâu + NN gom/xả.
// Data: bridge /api/v1/intraday-signals (OHLCV-based, ADTV>=1 tỷ) + vnstock investor-flow (foreign).
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { getVNDateISO } from "@/lib/cronHelpers";
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

/**
 * Dựng report 2 định dạng (Telegram & Discord dùng markdown KHÁC nhau) + plain cho push.
 * - Telegram (legacy Markdown): đậm = *...*, nghiêng = _..._
 * - Discord: đậm = **...**, nghiêng = _..._
 * timeLabel vd "14:00". Trả {discord, telegram, plain, empty}.
 */
export async function buildIntradaySignalsReport(
  timeLabel: string,
): Promise<{ discord: string; telegram: string; plain: string; empty: boolean }> {
  const [sig, flow] = await Promise.all([
    fetchIntradaySignals(),
    fetchVnstockInvestorFlow({ top: 12 }).catch(() => null),
  ]);
  const [, m, d] = getVNDateISO().split("-");
  const dateLabel = `${d}/${m}`;
  const fb = pickForeignBucket(flow);

  const bo1 = joinT(sig?.breakout_1m);
  const bo3 = joinT(sig?.breakout_3m);
  const base = joinT(sig?.long_base);
  const gom = joinT(fb?.topBuy);
  const xa = joinT(fb?.topSell);
  const bd1 = joinT(sig?.breakdown_1m);
  const bd3 = joinT(sig?.breakdown_3m);
  const empty = !(bo1 || bo3 || base || gom || xa || bd1 || bd3);

  // b = đậm, i = nghiêng — truyền wrapper theo từng nền tảng.
  const render = (b: (s: string) => string, i: (s: string) => string): string => {
    const lines: string[] = [`📊 ${b("TÍN HIỆU")} (${timeLabel} ${dateLabel})`, "━".repeat(24)];
    if (bo1 || bo3) {
      lines.push("", `🚀 ${b("VƯỢT ĐỈNH")}`);
      if (bo1) lines.push(`• ${b("Vượt đỉnh 1 tháng:")} ${bo1}`);
      if (bo3) lines.push(`• ${b("Vượt đỉnh 3 tháng:")} ${bo3}`);
    }
    if (base) {
      lines.push("", `🧱 ${b("ĐI NỀN LÂU")}`);
      lines.push(`• ${b("Tích lũy chặt (≈2 tháng):")} ${base}`);
    }
    if (gom || xa) {
      lines.push("", `🦈 ${b("KHỐI NGOẠI")}`);
      if (gom) lines.push(`📈 ${b("Gom:")} ${gom}`);
      if (xa) lines.push(`📉 ${b("Xả:")} ${xa}`);
    }
    if (bd1 || bd3) {
      lines.push("", `📉 ${b("PHÁ ĐÁY")}`);
      if (bd1) lines.push(`• ${b("Phá đáy 1 tháng:")} ${bd1}`);
      if (bd3) lines.push(`• ${b("Phá đáy 3 tháng:")} ${bd3}`);
    }
    lines.push("", i("⚠️ Dữ liệu tham khảo, không phải khuyến nghị đầu tư."));
    return lines.join("\n");
  };

  const telegram = render((s) => `*${s}*`, (s) => `_${s}_`);
  const discord = render((s) => `**${s}**`, (s) => `_${s}_`);
  const plain = render((s) => s, (s) => s);
  return { discord, telegram, plain, empty };
}
