import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/journals
 * Admin xem toàn bộ lịch sử giao dịch, PnL, tradeReason của tất cả User.
 * Query params: page, limit, userId, ticker, from, to
 */
export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);
  const skip = (page - 1) * limit;
  const userId = searchParams.get("userId");
  const ticker = searchParams.get("ticker");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (userId) where.userId = userId;
    if (ticker) where.ticker = ticker.toUpperCase().trim();

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

    const [entries, total] = await prisma.$transaction([
      prisma.tradingJournal.findMany({
        where,
        orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              systemRole: true,
              initialJournalNAV: true,
            },
          },
        },
      }),
      prisma.tradingJournal.count({ where }),
    ]);

    // Tổng hợp PnL theo user
    const userIds = [...new Set(entries.map((e) => e.userId))];
    const userPnLSummary: Record<string, { totalBuy: number; totalSell: number; netPnL: number }> = {};

    for (const uid of userIds) {
      const userEntries = await prisma.tradingJournal.findMany({
        where: { userId: uid },
        select: { action: true, price: true, quantity: true },
      });

      let totalBuy = 0;
      let totalSell = 0;
      for (const e of userEntries) {
        const value = e.price * e.quantity;
        if (e.action === "BUY") totalBuy += value;
        else totalSell += value;
      }

      userPnLSummary[uid] = {
        totalBuy,
        totalSell,
        netPnL: totalSell - totalBuy,
      };
    }

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
      userPnLSummary,
    });
  } catch (error) {
    console.error("[GET /api/admin/journals] Error:", error);
    return NextResponse.json({ error: "Lỗi tải nhật ký" }, { status: 500 });
  }
}
