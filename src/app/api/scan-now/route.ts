import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BACKEND = process.env.FIINQUANT_URL ?? process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

interface ScannerSignal {
  ticker: string;
  type: string;
  entryPrice: number;
  reason?: string;
}

function toSignalKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

/**
 * POST /api/scan-now — Trigger scanner + đồng bộ ngay vào bảng Signal
 * Chỉ cho phép user đã đăng nhập
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/scan-now`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000), // scanner có thể mất 1-2 phút
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/scan-now] Backend error:", res.status, text);
      return NextResponse.json(
        { error: "Lỗi quét tín hiệu" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { detected?: number; signals?: ScannerSignal[] };
    const rawSignals = Array.isArray(data.signals) ? data.signals : [];
    const uniqueSignals = Array.from(
      new Map(
        rawSignals
          .filter((s) => s?.ticker && s?.type && typeof s?.entryPrice === "number")
          .map((s) => [toSignalKey(s.ticker, s.type), s])
      ).values()
    );

    if (uniqueSignals.length === 0) {
      return NextResponse.json({
        detected: data.detected ?? 0,
        synced: 0,
        created: 0,
        updated: 0,
        signals: [],
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true },
    });

    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));

    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const signal of uniqueSignals) {
        const normalizedTicker = signal.ticker.toUpperCase().trim();
        const key = toSignalKey(normalizedTicker, signal.type);
        const existing = existingMap.get(key);

        if (existing) {
          if (existing.status === "CLOSED") {
            continue;
          }
          await tx.signal.update({
            where: { id: existing.id },
            data: {
              entryPrice: signal.entryPrice,
              reason: signal.reason ?? null,
            },
          });
          updated += 1;
          continue;
        }

        await tx.signal.create({
          data: {
            ticker: normalizedTicker,
            type: signal.type,
            entryPrice: signal.entryPrice,
            reason: signal.reason ?? null,
          },
        });
        created += 1;
      }
    });

    return NextResponse.json({
      detected: data.detected ?? uniqueSignals.length,
      synced: created + updated,
      created,
      updated,
      signals: uniqueSignals,
    });
  } catch (err) {
    console.error("[/api/scan-now] Error:", err);
    return NextResponse.json(
      { error: "Không kết nối được scanner" },
      { status: 502 }
    );
  }
}
