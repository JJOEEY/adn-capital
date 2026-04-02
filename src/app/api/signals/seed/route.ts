/**
 * API Seed: Nhồi tín hiệu mock vào DB để test giao diện.
 * POST /api/signals/seed
 * Chỉ chạy trong dev mode.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SEED_SIGNALS = [
  { ticker: "FPT", type: "SIEU_CO_PHIEU" as const, entryPrice: 142500 },
  { ticker: "MWG", type: "TRUNG_HAN" as const, entryPrice: 58200 },
  { ticker: "TCB", type: "DAU_CO" as const, entryPrice: 30200 },
  { ticker: "HPG", type: "DAU_CO" as const, entryPrice: 26800 },
  { ticker: "VNM", type: "TRUNG_HAN" as const, entryPrice: 72400 },
  { ticker: "DGC", type: "SIEU_CO_PHIEU" as const, entryPrice: 98700 },
];

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Chỉ dùng trong dev mode" }, { status: 403 });
  }

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    await prisma.signal.deleteMany({
      where: { createdAt: { gte: startOfDay } },
    });

    const created = await prisma.$transaction(
      SEED_SIGNALS.map((s, i) =>
        prisma.signal.create({
          data: {
            ticker: s.ticker,
            type: s.type,
            entryPrice: s.entryPrice,
            createdAt: new Date(Date.now() - i * 15 * 60 * 1000),
          },
        })
      )
    );

    return NextResponse.json({
      message: `Đã tạo ${created.length} tín hiệu mock`,
      signals: created.map((s: { id: string; ticker: string; type: string; entryPrice: number; createdAt: Date }) => ({
        id: s.id,
        ticker: s.ticker,
        type: s.type,
        entryPrice: s.entryPrice,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[seed] Error:", error);
    return NextResponse.json({ error: "Lỗi seed tín hiệu" }, { status: 500 });
  }
}
