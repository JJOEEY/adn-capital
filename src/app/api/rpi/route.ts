import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { buildTopicContext } from "@/lib/datahub/producer-context";
import { getMarketPayloadRows, readMarketNumber } from "@/lib/market-price-normalization";
import { calculateRPI, getLatestRPI, OHLCVData } from "@/lib/rpi/calculator";

export const dynamic = "force-dynamic";

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
  const force = req.nextUrl.searchParams.get("force") === "1";
  const context = await buildTopicContext({ force });
  const envelope = await getTopicEnvelope("vn:historical:VN30:1d", context);
  const rows = toOhlcvRows(envelope.value);
  const history = calculateRPI(rows);
  const latest = getLatestRPI(history);

  if (!latest) {
    return NextResponse.json(
      {
        rpi_current: null,
        rpi_ma7: null,
        rpi: null,
        ma7: null,
        classification: null,
        classColor: null,
        date: null,
        history: [],
        data: [],
        freshness: envelope.freshness,
        updatedAt: envelope.updatedAt,
        error: envelope.error?.message ?? "Khong du du lieu lich su de tinh RPI",
      },
      { status: envelope.freshness === "error" ? 503 : 206 },
    );
  }

  return NextResponse.json(
    {
      rpi_current: latest.rpi,
      rpi_ma7: latest.ma7,
      rpi: latest.rpi,
      ma7: latest.ma7,
      classification: latest.classification,
      classColor: latest.classColor,
      date: latest.date,
      latest,
      history: history.slice(-60),
      data: history,
      freshness: envelope.freshness,
      updatedAt: envelope.updatedAt,
    },
    {
      status: envelope.freshness === "fresh" ? 200 : 206,
      headers: {
        "x-data-freshness": envelope.freshness,
      },
    },
  );
}
