import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/journal/pnl
 * Tính PnL tổng: initialJournalNAV + tổng lãi/lỗ đã chốt
 * + giá trị thị trường tạm tính của mã đang giữ.
 */
export async function GET(req: NextRequest) {
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

    // Tính vị thế hiện tại (portfolio) và PnL đã chốt
    // Dùng FIFO matching: mỗi lần BÁN sẽ match với lệnh MUA cũ nhất
    const holdings: Record<string, { qty: number; avgPrice: number; buys: { price: number; qty: number }[] }> = {};
    let realizedPnL = 0;
    const closedTrades: { ticker: string; pnl: number; buyPrice: number; sellPrice: number; qty: number }[] = [];

    for (const j of journals) {
      if (!holdings[j.ticker]) {
        holdings[j.ticker] = { qty: 0, avgPrice: 0, buys: [] };
      }

      if (j.action === "BUY") {
        holdings[j.ticker].buys.push({ price: j.price, qty: j.quantity });
        const totalQty = holdings[j.ticker].qty + j.quantity;
        holdings[j.ticker].avgPrice =
          (holdings[j.ticker].avgPrice * holdings[j.ticker].qty + j.price * j.quantity) / totalQty;
        holdings[j.ticker].qty = totalQty;
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
          });

          oldest.qty -= matched;
          sellQty -= matched;
          holdings[j.ticker].qty -= matched;

          if (oldest.qty <= 0) {
            holdings[j.ticker].buys.shift();
          }
        }
      }
    }

    // Holdings hiện tại (mã đang giữ)
    const currentHoldings = Object.entries(holdings)
      .filter(([, v]) => v.qty > 0)
      .map(([ticker, v]) => ({
        ticker,
        qty: v.qty,
        avgPrice: Math.round(v.avgPrice),
        marketValue: v.qty * v.avgPrice, // Tạm tính = giá TB (chưa có realtime price)
      }));

    const holdingsValue = currentHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    const currentNAV = initialNAV + realizedPnL + holdingsValue;

    // Win/Loss ratio
    const winTrades = closedTrades.filter((t) => t.pnl > 0).length;
    const lossTrades = closedTrades.filter((t) => t.pnl < 0).length;
    const winRate = closedTrades.length > 0 ? (winTrades / closedTrades.length) * 100 : 0;

    return NextResponse.json({
      initialNAV,
      realizedPnL,
      holdingsValue,
      currentNAV,
      currentHoldings,
      closedTrades: closedTrades.slice(-20).reverse(), // 20 giao dịch gần nhất
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
