import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/portfolio
 * Visual Asset Manager — returns full portfolio data:
 *  - NAV overview (initial, realized PnL, holdings value, cash, current NAV)
 *  - Current holdings with allocation % and AI signal tags
 *  - All transactions grouped by ticker for expandable rows
 */
export async function GET() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const journals = await prisma.tradingJournal.findMany({
      where: { userId: dbUser.id },
      orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
    });

    const initialNAV = dbUser.initialJournalNAV ?? 0;

    // FIFO matching — same logic as /api/journal/pnl
    const holdings: Record<
      string,
      { qty: number; avgPrice: number; totalCost: number; buys: { price: number; qty: number }[] }
    > = {};
    let realizedPnL = 0;
    const closedTrades: {
      ticker: string;
      pnl: number;
      buyPrice: number;
      sellPrice: number;
      qty: number;
      date: string;
    }[] = [];

    for (const j of journals) {
      if (!holdings[j.ticker]) {
        holdings[j.ticker] = { qty: 0, avgPrice: 0, totalCost: 0, buys: [] };
      }

      if (j.action === "BUY") {
        holdings[j.ticker].buys.push({ price: j.price, qty: j.quantity });
        const totalQty = holdings[j.ticker].qty + j.quantity;
        holdings[j.ticker].avgPrice =
          (holdings[j.ticker].avgPrice * holdings[j.ticker].qty +
            j.price * j.quantity) /
          totalQty;
        holdings[j.ticker].qty = totalQty;
        holdings[j.ticker].totalCost = holdings[j.ticker].avgPrice * totalQty;
      } else if (j.action === "SELL") {
        let sellQty = j.quantity;
        const sellPrice = j.price;

        while (sellQty > 0 && holdings[j.ticker].buys.length > 0) {
          const oldest = holdings[j.ticker].buys[0];
          const matched = Math.min(sellQty, oldest.qty);
          const pnl = (sellPrice - oldest.price) * matched;
          realizedPnL += pnl;
          closedTrades.push({
            ticker: j.ticker,
            pnl,
            buyPrice: oldest.price,
            sellPrice,
            qty: matched,
            date: (j.tradeDate ?? j.createdAt).toISOString(),
          });
          oldest.qty -= matched;
          sellQty -= matched;
          holdings[j.ticker].qty -= matched;
          if (oldest.qty <= 0) holdings[j.ticker].buys.shift();
        }

        // Recalculate avg price from remaining buys
        const remaining = holdings[j.ticker].buys;
        if (remaining.length > 0) {
          const totalQ = remaining.reduce((s, b) => s + b.qty, 0);
          const totalV = remaining.reduce((s, b) => s + b.price * b.qty, 0);
          holdings[j.ticker].avgPrice = totalQ > 0 ? totalV / totalQ : 0;
          holdings[j.ticker].qty = totalQ;
          holdings[j.ticker].totalCost = totalV;
        } else {
          holdings[j.ticker].avgPrice = 0;
          holdings[j.ticker].qty = 0;
          holdings[j.ticker].totalCost = 0;
        }
      }
    }

    // Current holdings (qty > 0)
    const currentHoldings = Object.entries(holdings)
      .filter(([, v]) => v.qty > 0)
      .map(([ticker, v]) => ({
        ticker,
        qty: v.qty,
        avgPrice: Math.round(v.avgPrice),
        totalCost: Math.round(v.totalCost),
        marketValue: v.qty * Math.round(v.avgPrice), // placeholder - frontend may override with realtime
      }));

    const holdingsValue = currentHoldings.reduce((s, h) => s + h.marketValue, 0);
    const currentNAV = initialNAV + realizedPnL + holdingsValue;
    const cash = initialNAV + realizedPnL; // NAV minus what's in holdings

    // Allocation: each holding as % of NAV
    const allocation = currentHoldings.map((h) => ({
      ticker: h.ticker,
      value: h.marketValue,
      pct: currentNAV > 0 ? Math.round((h.marketValue / currentNAV) * 1000) / 10 : 0,
    }));

    // Cash allocation
    const cashPct = currentNAV > 0 ? Math.round((cash / currentNAV) * 1000) / 10 : 100;
    allocation.push({ ticker: "Tiền mặt", value: cash, pct: cashPct });

    // AI signal tags for holdings — fetch active/radar signals
    const holdingTickers = currentHoldings.map((h) => h.ticker);
    let signalTags: Record<string, { tier: string; status: string; pnl: number | null }> = {};
    if (holdingTickers.length > 0) {
      const signals = await prisma.signal.findMany({
        where: {
          ticker: { in: holdingTickers },
          status: { in: ["ACTIVE", "RADAR"] },
        },
        orderBy: { createdAt: "desc" },
      });
      // Take latest signal per ticker
      for (const s of signals) {
        if (!signalTags[s.ticker]) {
          signalTags[s.ticker] = {
            tier: s.tier,
            status: s.status,
            pnl: s.currentPnl,
          };
        }
      }
    }

    // Transactions grouped by ticker (for expandable rows)
    const txByTicker: Record<
      string,
      {
        id: string;
        action: string;
        price: number;
        qty: number;
        date: string;
        psychologyTag: string | null;
        tradeReason: string | null;
      }[]
    > = {};
    for (const j of journals) {
      if (!txByTicker[j.ticker]) txByTicker[j.ticker] = [];
      txByTicker[j.ticker].push({
        id: j.id,
        action: j.action,
        price: j.price,
        qty: j.quantity,
        date: (j.tradeDate ?? j.createdAt).toISOString(),
        psychologyTag: j.psychologyTag,
        tradeReason: j.tradeReason,
      });
    }

    // Win/loss stats
    const winTrades = closedTrades.filter((t) => t.pnl > 0).length;
    const lossTrades = closedTrades.filter((t) => t.pnl < 0).length;
    const winRate =
      closedTrades.length > 0
        ? Math.round((winTrades / closedTrades.length) * 1000) / 10
        : 0;

    return NextResponse.json({
      initialNAV,
      realizedPnL,
      holdingsValue,
      cash,
      currentNAV,
      navChangePercent:
        initialNAV > 0
          ? Math.round(((currentNAV - initialNAV) / initialNAV) * 1000) / 10
          : 0,
      allocation,
      currentHoldings: currentHoldings.map((h) => ({
        ...h,
        signal: signalTags[h.ticker] ?? null,
      })),
      txByTicker,
      closedTrades: closedTrades.slice(-30).reverse(),
      stats: {
        totalTrades: journals.length,
        closedTrades: closedTrades.length,
        winTrades,
        lossTrades,
        winRate,
      },
    });
  } catch (error) {
    console.error("[GET /api/portfolio] Error:", error);
    return NextResponse.json({ error: "Lỗi tải danh mục" }, { status: 500 });
  }
}
