import { NextResponse } from "next/server";
import {
  calculateRPIFromVN30,
  type OHLCVData,
} from "@/lib/rpi/calculator";

const BACKEND = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

const VN30_TICKERS = [
  "ACB", "BCM", "BID", "BVH", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG",
  "KDH", "MBB", "MSN", "MWG", "PLX", "POW", "SAB", "SHB", "SSB", "SSI",
  "STB", "TCB", "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB",
];

/* ── Module-level cache (5 min TTL) ───────────────────────────────────── */
let cached: { data: unknown; ts: number } | null = null;
const TTL = 300_000;

export async function GET() {
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const fetches = VN30_TICKERS.map(async (ticker) => {
      try {
        const res = await fetch(
          `${BACKEND}/api/v1/historical/${ticker}?days=120&timeframe=1d`,
          { cache: "no-store", signal: AbortSignal.timeout(30_000) },
        );
        if (!res.ok) return null;
        const json = await res.json();
        if (!json.data?.length) return null;

        const ohlcv: OHLCVData[] = json.data.map(
          (d: { timestamp: string; open: number; high: number; low: number; close: number; volume: number }) => ({
            date: d.timestamp.split(" ")[0],
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          }),
        );

        return { ticker, data: ohlcv };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(fetches);
    const validStocks = results.filter(
      (r): r is { ticker: string; data: OHLCVData[] } => r !== null,
    );

    if (validStocks.length < 10) {
      return NextResponse.json(
        { error: `Chỉ lấy được ${validStocks.length}/30 mã VN30` },
        { status: 502 },
      );
    }

    const rpiResults = calculateRPIFromVN30(validStocks);
    const response = {
      ticker: "VN30",
      stockCount: validStocks.length,
      count: rpiResults.filter((r) => r.rpi !== null).length,
      results: rpiResults,
    };

    cached = { data: response, ts: Date.now() };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/rpi-vn30] Error:", err);
    return NextResponse.json(
      { error: "Không tính được RPI VN30" },
      { status: 500 },
    );
  }
}
