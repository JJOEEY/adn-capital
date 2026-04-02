import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/signals?days=1
 * days=1 (mặc định) → tín hiệu hôm nay
 * days=30        → lịch sử 30 ngày gần nhất
 */
export async function GET(request: NextRequest) {
  try {
    const days = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("days") ?? "1", 10) || 1, 1),
      90, // tối đa 90 ngày
    );

    const since = new Date();
    if (days <= 1) {
      since.setHours(0, 0, 0, 0);
    } else {
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
    }

    const signals = await prisma.signal.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      signals: signals.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        type: s.type,
        entryPrice: s.entryPrice,
        reason: s.reason ?? null,
        createdAt: s.createdAt.toISOString(),
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
