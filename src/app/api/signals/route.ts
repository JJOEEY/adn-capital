import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBatchPrices } from "@/lib/PriceCache";
import { fetchTAData } from "@/lib/stockData";

export const dynamic = "force-dynamic";

type LivePriceMap = Record<string, { close: number }>;

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasValidLivePrice(livePriceMap: LivePriceMap, ticker: string): boolean {
  return isValidPrice(livePriceMap[ticker]?.close);
}

async function hydrateLivePrices(
  tickers: string[],
  livePriceMap: LivePriceMap,
  refreshAll = false,
): Promise<LivePriceMap> {
  const refreshTickers = refreshAll
    ? tickers
    : tickers.filter((ticker) => !hasValidLivePrice(livePriceMap, ticker));

  if (refreshTickers.length === 0) {
    return livePriceMap;
  }

  const settled = await Promise.allSettled(
    refreshTickers.map(async (ticker) => {
      const ta = await fetchTAData(ticker);
      if (!ta || !isValidPrice(ta.currentPrice)) {
        return null;
      }
      return [ticker, { close: ta.currentPrice }] as const;
    }),
  );

  const hydrated: LivePriceMap = { ...livePriceMap };
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      const [ticker, price] = result.value;
      hydrated[ticker] = price;
    }
  }

  const hydratedCount = Object.keys(hydrated).filter((ticker) =>
    refreshTickers.includes(ticker),
  ).length;
  console.log(
    `[/api/signals] hydrated ${hydratedCount}/${refreshTickers.length} live prices from TA fallback`,
  );

  return hydrated;
}

async function persistLivePrices(
  signals: Array<{
    id: string;
    ticker: string;
    status: string;
    entryPrice: number;
    currentPrice: number | null;
    stoploss: number | null;
  }>,
  liveStatuses: Set<string>,
  livePriceMap: LivePriceMap,
) {
  let updatedCount = 0;
  let closedCount = 0;

  const updates = signals
    .filter((signal) => liveStatuses.has(signal.status))
    .map((signal) => {
      const currentPrice = livePriceMap[signal.ticker]?.close;
      if (!isValidPrice(currentPrice) || signal.entryPrice <= 0) {
        return null;
      }

      const currentPnl = +(((currentPrice - signal.entryPrice) / signal.entryPrice) * 100).toFixed(2);
      const stoploss = signal.stoploss;
      if (isValidPrice(stoploss) && currentPrice <= stoploss) {
        updatedCount++;
        closedCount++;
        return prisma.signal.update({
          where: { id: signal.id },
          data: {
            status: "CLOSED",
            closePrice: currentPrice,
            currentPrice,
            currentPnl,
            pnl: currentPnl,
            closedReason: `Cắt lỗ tự động: giá ${currentPrice.toLocaleString("vi-VN")} <= stoploss ${stoploss.toLocaleString("vi-VN")} (${currentPnl}%)`,
            closedAt: new Date(),
          },
        });
      }

      const existingPrice = signal.currentPrice ?? 0;
      if (Math.abs(existingPrice - currentPrice) < 0.0001) {
        return null;
      }

      updatedCount++;
      return prisma.signal.update({
        where: { id: signal.id },
        data: { currentPrice, currentPnl },
      });
    })
    .filter(Boolean);

  if (updates.length === 0) {
    return { updatedCount, closedCount };
  }

  const settled = await Promise.allSettled(updates);
  const failed = settled.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    console.error(`[/api/signals] failed to persist ${failed}/${updates.length} live price updates`);
  }
  if (closedCount > 0) {
    console.log(`[/api/signals] auto-closed ${closedCount} signals due to stoploss breach`);
  }

  return { updatedCount, closedCount };
}

/**
 * GET /api/signals?days=7&status=RADAR
 * days=7 (mặc định) → tín hiệu 7 ngày gần nhất
 * days=30        → lịch sử 30 ngày gần nhất
 * status=RADAR|ACTIVE|CLOSED (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const days = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("days") ?? "7", 10) || 7, 1),
      90,
    );
    const statusFilter = request.nextUrl.searchParams.get("status");

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (statusFilter && ["RADAR", "ACTIVE", "HOLD_TO_DIE", "CLOSED"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    let signals = await prisma.signal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const liveStatuses = new Set(["ACTIVE", "HOLD_TO_DIE"]);
    const liveTickers = [...new Set(
      signals
        .filter((s) => liveStatuses.has(s.status))
        .map((s) => s.ticker)
        .filter(Boolean),
    )];

    let livePriceMap: Record<string, { close: number }> = {};
    if (liveTickers.length > 0) {
      try {
        livePriceMap = await getBatchPrices(liveTickers);
        livePriceMap = await hydrateLivePrices(liveTickers, livePriceMap, true);
        const liveUpdate = await persistLivePrices(signals, liveStatuses, livePriceMap);
        if ((liveUpdate?.closedCount ?? 0) > 0) {
          signals = await prisma.signal.findMany({
            where,
            orderBy: { createdAt: "desc" },
          });
        }
      } catch (error) {
        console.error("[/api/signals] live price fallback to DB:", error);
      }
    }

    const now = Date.now();

    return NextResponse.json({
      signals: signals.map((s) => ({
        ...(function () {
          const live = liveStatuses.has(s.status) ? livePriceMap[s.ticker] : undefined;
          const liveCurrentPrice =
            live && typeof live.close === "number" && Number.isFinite(live.close) && live.close > 0
              ? live.close
              : null;
          const currentPrice = liveCurrentPrice ?? s.currentPrice;
          const currentPnl =
            currentPrice != null && s.entryPrice > 0
              ? +(((currentPrice - s.entryPrice) / s.entryPrice) * 100).toFixed(2)
              : s.currentPnl;
          return { currentPrice, currentPnl };
        })(),
        id: s.id,
        ticker: s.ticker,
        type: s.type,
        status: s.status,
        tier: s.tier,
        entryPrice: s.entryPrice,
        target: s.target,
        stoploss: s.stoploss,
        closePrice: s.closePrice,
        navAllocation: s.navAllocation,
        triggerSignal: s.triggerSignal,
        aiReasoning: s.aiReasoning,
        reason: s.reason ?? null,
        pnl: s.pnl,
        closedReason: s.closedReason,
        winRate: s.winRate,
        sharpeRatio: s.sharpeRatio,
        closedAt: s.closedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        daysInSignal: Math.floor((now - s.createdAt.getTime()) / 86_400_000),
      })),
    });
  } catch (error) {
    console.error("[/api/signals] Lỗi:", error);
    return NextResponse.json(
      { error: "Lỗi tải tín hiệu" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/signals — Cập nhật trạng thái tín hiệu (RADAR→ACTIVE→CLOSED)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, closePrice } = body as {
      id: string;
      status?: string;
      closePrice?: number;
    };

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const signal = await prisma.signal.findUnique({ where: { id } });
    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (status && ["RADAR", "ACTIVE", "HOLD_TO_DIE", "CLOSED"].includes(status)) {
      updateData.status = status;
    }

    if (status === "CLOSED" && closePrice) {
      updateData.closePrice = closePrice;
      updateData.closedAt = new Date();
      updateData.pnl = +((closePrice - signal.entryPrice) / signal.entryPrice * 100).toFixed(2);
    }

    const updated = await prisma.signal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ signal: updated });
  } catch (error) {
    console.error("[PATCH /api/signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi cập nhật" }, { status: 500 });
  }
}
