import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/internal/user-context?ticker=...&userId=...
 * Lấy thông tin holding (TradingJournal) và signals để cá nhân hóa prompt AI.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const userId = searchParams.get("userId");

  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  try {
    // 1. Estimate holding từ TradingJournal (BUY - SELL net)
    let holding = null;
    if (userId) {
      const journals = await prisma.tradingJournal.findMany({
        where: { userId, ticker },
        select: { action: true, quantity: true, price: true }
      });
      const netQty = journals.reduce((acc, j) => {
        return acc + (j.action === "BUY" ? j.quantity : -j.quantity);
      }, 0);
      if (netQty > 0) {
        const buyEntries = journals.filter(j => j.action === "BUY");
        const avgPrice = buyEntries.length
          ? buyEntries.reduce((s, j) => s + j.price * j.quantity, 0) / buyEntries.reduce((s, j) => s + j.quantity, 0)
          : 0;
        holding = { quantity: netQty, avgPrice: Math.round(avgPrice) };
      }
    }

    // 2. Active Signal từ hệ thống 
    const activeSignal = await prisma.signal.findFirst({
      where: { ticker, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { type: true, entryPrice: true }
    });

    return NextResponse.json({ holding, activeSignal });
  } catch (error) {
    console.error("[user-context]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
