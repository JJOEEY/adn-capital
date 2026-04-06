import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/signals?days=1&status=RADAR
 * days=1 (mặc định) → tín hiệu hôm nay
 * days=30        → lịch sử 30 ngày gần nhất
 * status=RADAR|ACTIVE|CLOSED (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const days = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("days") ?? "1", 10) || 1, 1),
      90,
    );
    const statusFilter = request.nextUrl.searchParams.get("status");

    const since = new Date();
    if (days <= 1) {
      since.setHours(0, 0, 0, 0);
    } else {
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
    }

    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (statusFilter && ["RADAR", "ACTIVE", "CLOSED"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const signals = await prisma.signal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      signals: signals.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        type: s.type,
        status: s.status,
        tier: s.tier,
        entryPrice: s.entryPrice,
        target: s.target,
        stoploss: s.stoploss,
        closePrice: s.closePrice,
        currentPrice: s.currentPrice,
        currentPnl: s.currentPnl,
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

    if (status && ["RADAR", "ACTIVE", "CLOSED"].includes(status)) {
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
