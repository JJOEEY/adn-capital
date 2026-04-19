import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processSignals } from "@/lib/UltimateSignalEngine";
import {
  getAiBrokerRuntimeConfig,
  shouldAutoActivateSignal,
  rebalanceActiveBasketNav,
} from "@/lib/aiBroker";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

const BACKEND = getPythonBridgeUrl();

interface ScannerSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

function toSignalKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

/**
 * POST /api/scan-now — Trigger scanner + đồng bộ đầy đủ pipeline UltimateSignalEngine
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
    const validSignals = rawSignals.filter((s) =>
      s?.ticker &&
      typeof s?.entryPrice === "number" &&
      ["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"].includes(s?.type)
    );
    const uniqueSignals = Array.from(
      new Map(
        validSignals.map((s) => [toSignalKey(s.ticker, s.type), s])
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

    const processed = await processSignals(uniqueSignals);

    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true },
    });
    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));
    const aiBrokerConfig = await getAiBrokerRuntimeConfig();

    let created = 0;
    let updated = 0;

    const operations = processed.map((s) => {
      const normalizedTicker = s.ticker.toUpperCase().trim();
      const key = toSignalKey(normalizedTicker, s.type);
      const existing = existingMap.get(key);
      const autoActivate = shouldAutoActivateSignal(
        {
          entryPrice: s.entryPrice,
          currentPrice: s.entryPrice,
          winRate: s.winRate,
          rrRatio: s.rrRatio,
        },
        aiBrokerConfig
      );
      const nextStatus =
        existing?.status === "CLOSED"
          ? "CLOSED"
          : autoActivate
          ? "ACTIVE"
          : s.status;

      if (existing) {
        updated += 1;
        const activePayload =
          existing.status !== "ACTIVE" && nextStatus === "ACTIVE"
            ? { currentPrice: s.entryPrice, currentPnl: 0 }
            : {};

        return prisma.signal.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            entryPrice: s.entryPrice,
            tier: s.tier,
            navAllocation: s.navAllocation,
            target: s.target,
            stoploss: s.stoploss,
            triggerSignal: s.triggerSignal,
            aiReasoning: s.aiReasoning,
            reason: s.reason ?? null,
            winRate: s.winRate,
            sharpeRatio: s.sharpeRatio,
            rrRatio: s.rrRatio,
            ...activePayload,
          },
        });
      }

      created += 1;
      return prisma.signal.create({
        data: {
          ticker: normalizedTicker,
          type: s.type,
          status: nextStatus,
          tier: s.tier,
          entryPrice: s.entryPrice,
          target: s.target,
          stoploss: s.stoploss,
          navAllocation: s.navAllocation,
          triggerSignal: s.triggerSignal,
          aiReasoning: s.aiReasoning,
          reason: s.reason ?? null,
          winRate: s.winRate,
          sharpeRatio: s.sharpeRatio,
          rrRatio: s.rrRatio,
          ...(nextStatus === "ACTIVE"
            ? {
                currentPrice: s.entryPrice,
                currentPnl: 0,
              }
            : {}),
        },
      });
    });

    if (operations.length > 0) {
      await prisma.$transaction(operations);
      await rebalanceActiveBasketNav(aiBrokerConfig.maxTotalNav);
    }

    return NextResponse.json({
      detected: data.detected ?? uniqueSignals.length,
      synced: created + updated,
      created,
      updated,
      signals: uniqueSignals,
      message: `${created} mới, ${updated} cập nhật (UltimateEngine)`,
    });
  } catch (err) {
    console.error("[/api/scan-now] Error:", err);
    return NextResponse.json(
      { error: "Không kết nối được scanner" },
      { status: 502 }
    );
  }
}
