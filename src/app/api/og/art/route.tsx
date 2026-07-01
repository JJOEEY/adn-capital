import { NextRequest } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { buildTopicContext } from "@/lib/datahub/producer-context";
import { getMarketPayloadRows, readMarketNumber } from "@/lib/market-price-normalization";
import { calculateRPI, getLatestRPI, snapshotArtRows, OHLCVData } from "@/lib/rpi/calculator";
import { renderArtImageBuffer } from "@/lib/og/art-image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readDate(row: Record<string, unknown>) {
  const value = row.date ?? row.tradingDate ?? row.time ?? row.timestamp;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000).toISOString().slice(0, 10);
    if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed)).toISOString().slice(0, 10);
    return trimmed.slice(0, 10);
  }
  return null;
}

function toOhlcvRows(value: unknown): OHLCVData[] {
  return getMarketPayloadRows(value)
    .map((row) => {
      const date = readDate(row);
      const open = readMarketNumber(row.open ?? row.o);
      const high = readMarketNumber(row.high ?? row.h);
      const low = readMarketNumber(row.low ?? row.l);
      const close = readMarketNumber(row.close ?? row.c ?? row.price);
      const volume = readMarketNumber(row.volume ?? row.v ?? row.matchVolume) ?? 0;
      if (!date || open == null || high == null || low == null || close == null) return null;
      if ([open, high, low, close].some((item) => !Number.isFinite(item) || item <= 0)) return null;
      return { date, open, high, low, close, volume };
    })
    .filter((row): row is OHLCVData => row != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "VN30").toUpperCase().replace(/[^A-Z0-9]/g, "") || "VN30";
  const context = await buildTopicContext({ force: false });
  const envelope = await getTopicEnvelope(`vn:historical:${ticker}:1d`, context);
  const latest = getLatestRPI(calculateRPI(snapshotArtRows(ticker, toOhlcvRows(envelope.value))));

  const buffer = await renderArtImageBuffer({
    ticker,
    value: latest?.rpi ?? null,
    ma7: latest?.ma7 ?? null,
    classification: latest?.classification ?? null,
    classColor: latest?.classColor ?? null,
    date: latest?.date ?? null,
  });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `inline; filename="adn-art-${ticker}.png"`,
    },
  });
}
