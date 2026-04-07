import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { checkT25Eligibility, formatEarliestSellDate } from "@/lib/t25";

/**
 * GET /api/journal/t25-check?ticker=HPG&sellDate=2026-04-10
 * Kiểm tra T+2.5 cho một mã cổ phiếu trước khi bán.
 */
export async function GET(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase().trim();
  const sellDate = searchParams.get("sellDate");

  if (!ticker) {
    return NextResponse.json({ error: "Thiếu mã cổ phiếu" }, { status: 400 });
  }

  try {
    const lastBuy = await prisma.tradingJournal.findFirst({
      where: {
        userId: dbUser.id,
        ticker,
        action: "BUY",
      },
      orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
    });

    if (!lastBuy) {
      return NextResponse.json({
        eligible: true,
        message: `Không tìm thấy lệnh MUA ${ticker} trong nhật ký.`,
      });
    }

    const buyDate = lastBuy.tradeDate ?? lastBuy.createdAt;
    const targetSellDate = sellDate ? new Date(sellDate) : new Date();
    const { eligible, earliestSellDate, tradingDaysLeft } =
      checkT25Eligibility(buyDate, targetSellDate);

    return NextResponse.json({
      eligible,
      buyDate: buyDate.toISOString(),
      earliestSellDate: earliestSellDate.toISOString(),
      earliestSellDateFormatted: formatEarliestSellDate(earliestSellDate),
      tradingDaysLeft,
      message: eligible
        ? `${ticker} đã đủ T+2.5, có thể bán.`
        : `${ticker} chưa về tài khoản. Bán sớm nhất: ${formatEarliestSellDate(earliestSellDate)} (còn ${tradingDaysLeft} ngày GD).`,
    });
  } catch (error) {
    console.error("[GET /api/journal/t25-check] Error:", error);
    return NextResponse.json({ error: "Lỗi kiểm tra T+2.5" }, { status: 500 });
  }
}
