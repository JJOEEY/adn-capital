import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

/**
 * GET /api/journal/pnl
 * Tính PnL tổng: initialJournalNAV + tổng lãi/lỗ đã chốt
 * + giá trị thị trường tạm tính của mã đang giữ.
 * Supports optional ?from=YYYY-MM-DD&to=YYYY-MM-DD for period filtering.
 * Always returns txByTicker for expandable Smart Table rows.
 */
export async function GET(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: dbUser.id };

    if (from || to) {
      where.OR = [
        {
          tradeDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
          },
        },
        {
          tradeDate: null,
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
          },
        },
      ];
    }

    const journals = await prisma.tradingJournal.findMany({
      where,
      orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
    });

    const initialNAV = dbUser.initialJournalNAV ?? 0;

    // Tính vị thế hiện tại (portfolio) và PnL đã chốt
    // Dùng FIFO matching: mỗi lần BÁN sẽ match với lệnh MUA cũ nhất
    const holdings: Record<string, { qty: number; avgPrice: number; totalCost: number; buys: { price: number; qty: number }[] }> = {};
    let realizedPnL = 0;
    const closedTrades: { ticker: string; pnl: number; buyPrice: number; sellPrice: number; qty: number; date: string }[] = [];

    for (const j of journals) {
      if (!holdings[j.ticker]) {
        holdings[j.ticker] = { qty: 0, avgPrice: 0, totalCost: 0, buys: [] };
      }

      if (j.action === "BUY") {
        holdings[j.ticker].buys.push({ price: j.price, qty: j.quantity });
        const totalQty = holdings[j.ticker].qty + j.quantity;
        holdings[j.ticker].avgPrice =
          (holdings[j.ticker].avgPrice * holdings[j.ticker].qty + j.price * j.quantity) / totalQty;
        holdings[j.ticker].qty = totalQty;
        holdings[j.ticker].totalCost = holdings[j.ticker].avgPrice * totalQty;
      } else if (j.action === "SELL") {
        let sellQty = j.quantity;
        const sellPrice = j.price;

        // FIFO matching
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

          if (oldest.qty <= 0) {
            holdings[j.ticker].buys.shift();
          }
        }

        // Recalculate from remaining buys
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

    // Holdings hiện tại (mã đang giữ)
    // Fetch giá thị trường thực từ FiinQuant bridge
    const BACKEND = getPythonBridgeUrl();
    const holdingTickers = Object.entries(holdings)
      .filter(([, v]) => v.qty > 0)
      .map(([ticker]) => ticker);

    const marketPrices: Record<string, number> = {};
    await Promise.all(
      holdingTickers.map(async (ticker) => {
        try {
          const res = await fetch(
            `${BACKEND}/api/v1/historical/${encodeURIComponent(ticker)}?days=5&timeframe=1d`,
            { cache: "no-store", signal: AbortSignal.timeout(10_000) },
          );
          if (res.ok) {
            const json = await res.json();
            const arr = json.data ?? [];
            if (arr.length > 0) {
              // API trả giá theo đơn vị nghìn VNĐ (25.6 = 25,600₫) → nhân 1000
              marketPrices[ticker] = Math.round((arr[arr.length - 1].close ?? 0) * 1000);
            }
          }
        } catch { /* fallback to avgPrice */ }
      }),
    );

    const currentHoldings = Object.entries(holdings)
      .filter(([, v]) => v.qty > 0)
      .map(([ticker, v]) => {
        const avgP = Math.round(v.avgPrice);
        const mp = marketPrices[ticker] ?? avgP; // fallback nếu ko lấy được giá TT
        return {
          ticker,
          qty: v.qty,
          avgPrice: avgP,
          totalCost: Math.round(v.totalCost),
          marketPrice: mp,
          marketValue: v.qty * mp,
        };
      });

    const holdingsCostBasis = currentHoldings.reduce((sum, h) => sum + h.totalCost, 0);
    const holdingsMarketValue = currentHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    const unrealizedPnL = holdingsMarketValue - holdingsCostBasis;

    // CÔNG THỨC CHUẨN: currentNAV = Vốn ban đầu + Lãi/Lỗ đã chốt + Lãi/Lỗ chưa chốt
    // KHÔNG ĐƯỢC cộng initialNAV + holdingsValue (double-counting)
    const currentNAV = initialNAV + realizedPnL + unrealizedPnL;

    // Win/Loss ratio
    const winTrades = closedTrades.filter((t) => t.pnl > 0).length;
    const lossTrades = closedTrades.filter((t) => t.pnl < 0).length;
    const winRate = closedTrades.length > 0 ? (winTrades / closedTrades.length) * 100 : 0;

    // Transactions grouped by ticker (for Smart Table expandable rows)
    const txByTicker: Record<
      string,
      { id: string; action: string; price: number; qty: number; date: string; psychologyTag: string | null }[]
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
      });
    }

    return NextResponse.json({
      initialNAV,
      realizedPnL,
      unrealizedPnL,
      holdingsCostBasis,
      holdingsMarketValue,
      currentNAV,
      currentHoldings,
      closedTrades: closedTrades.slice(-30).reverse(),
      txByTicker,
      stats: {
        totalTrades: journals.length,
        closedTrades: closedTrades.length,
        winTrades,
        lossTrades,
        winRate: Math.round(winRate * 10) / 10,
      },
    });
  } catch (error) {
    console.error("[GET /api/journal/pnl] Error:", error);
    return NextResponse.json({ error: "Lỗi tính PnL" }, { status: 500 });
  }
}
