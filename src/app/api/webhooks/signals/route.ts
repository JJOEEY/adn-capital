/**
 * POST /api/webhooks/signals
 * Webhook nhận tín hiệu từ Python Scanner → chạy qua UltimateSignalEngine → lưu DB.
 * Logic: Nếu tín hiệu cùng ticker+type đã tồn tại trong ngày → UPDATE giá mới nhất.
 *        Nếu chưa có → CREATE mới với đầy đủ tier, NAV, target/stoploss, AI reasoning.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSignals } from "@/lib/UltimateSignalEngine";
import { getSignalWindowInfo, getVNDateISO, pushNotification } from "@/lib/cronHelpers";
import {
  getAiBrokerRuntimeConfig,
  shouldAutoActivateSignal,
  rebalanceActiveBasketNav,
} from "@/lib/aiBroker";
import { getVnNow } from "@/lib/time";
import { emitWorkflowTrigger } from "@/lib/workflows";
import { invalidateTopics } from "@/lib/datahub/core";
import { claimSignalNotifications } from "@/lib/signals/notification-dedupe";

// Secret chia sẻ giữa Python scanner và Next.js
const WEBHOOK_SECRET = process.env.SCANNER_SECRET ?? "adn-scanner-secret-key";

interface IncomingSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Xác thực secret ───────────────────────────────────────────────
    const body = await req.json();
    const { signals, secret } = body as {
      signals: IncomingSignal[];
      secret: string;
    };

    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ saved: 0, updated: 0, message: "Không có tín hiệu" });
    }

    // Validate signals
    const validSignals = signals.filter((s) => {
      if (!s.ticker || !s.type || !s.entryPrice) return false;
      if (!["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"].includes(s.type)) return false;
      return true;
    });

    if (validSignals.length === 0) {
      return NextResponse.json({ saved: 0, updated: 0, message: "Không có tín hiệu hợp lệ" });
    }

    // ── 2. Chạy qua UltimateSignalEngine (VSA → Seasonality → AI Broker) ──
    const processed = await processSignals(validSignals);

    // ── 3. Lấy tín hiệu hôm nay để xác định create vs update ───────────
    const startOfDay = getVnNow().startOf("day").toDate();

    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true, entryPrice: true },
    });

    const existingMap = new Map<string, { id: string; status: string; entryPrice: number }>();
    for (const s of todaySignals) {
      existingMap.set(`${s.ticker}|${s.type}`, { id: s.id, status: s.status, entryPrice: s.entryPrice });
    }

    const todayISO = getVNDateISO();

    // ── 4. Upsert: update nếu đã có, create nếu chưa ───────────────────
    let created = 0;
    let updated = 0;
    const createdSignalsForNotify: IncomingSignal[] = [];
    const activatedSignals: Array<{
      ticker: string;
      signalType: string;
      fromStatus: string;
      toStatus: string;
      entryPrice: number;
      reason: string | null;
    }> = [];
    const aiBrokerConfig = await getAiBrokerRuntimeConfig();

    const operations = processed.map((s) => {
      const key = `${s.ticker.toUpperCase().trim()}|${s.type}`;
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
        updated++;
        if (existing.status !== nextStatus && nextStatus === "ACTIVE") {
          activatedSignals.push({
            ticker: s.ticker.toUpperCase().trim(),
            signalType: s.type,
            fromStatus: existing.status,
            toStatus: nextStatus,
            entryPrice: s.entryPrice,
            reason: s.reason ?? null,
          });
        }
        const isExistingLive = existing.status === "ACTIVE" || existing.status === "HOLD_TO_DIE";
        const isNextLive = nextStatus === "ACTIVE" || nextStatus === "HOLD_TO_DIE";
        const effectiveEntryPrice =
          isExistingLive && isNextLive && existing.entryPrice > 0 ? existing.entryPrice : s.entryPrice;
        const livePayload =
          isNextLive && s.entryPrice > 0 && effectiveEntryPrice > 0
            ? {
                currentPrice: s.entryPrice,
                currentPnl: +(((s.entryPrice - effectiveEntryPrice) / effectiveEntryPrice) * 100).toFixed(2),
              }
            : {};

        return prisma.signal.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            entryPrice: effectiveEntryPrice,
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
            ...livePayload,
          },
        });
      } else {
        created++;
        if (nextStatus === "ACTIVE") {
          activatedSignals.push({
            ticker: s.ticker.toUpperCase().trim(),
            signalType: s.type,
            fromStatus: "NEW",
            toStatus: nextStatus,
            entryPrice: s.entryPrice,
            reason: s.reason ?? null,
          });
        }
        createdSignalsForNotify.push({
          ticker: s.ticker.toUpperCase().trim(),
          type: s.type,
          entryPrice: s.entryPrice,
          reason: s.reason,
        });
        return prisma.signal.create({
          data: {
            ticker: s.ticker.toUpperCase().trim(),
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
      }
    });

    await prisma.$transaction(operations);
    await rebalanceActiveBasketNav(aiBrokerConfig.maxTotalNav);

    const webNotifySignals = await claimSignalNotifications(createdSignalsForNotify, todayISO);

    if (webNotifySignals.length > 0) {
      const windowInfo = getSignalWindowInfo();
      const signalText = webNotifySignals
        .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${s.reason ? ` — ${s.reason}` : ""}`)
        .join("\n");

      await pushNotification(
        windowInfo.type,
        `⚡ ${windowInfo.label} — ${webNotifySignals.length} tín hiệu mới`,
        `## TÍN HIỆU MỚI (${windowInfo.label})\n\n${signalText}`
      );
    }
    if (activatedSignals.length > 0) {
      await Promise.all(
        activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "webhook:signals",
            payload: signal,
          }),
        ),
      );
    }
    invalidateTopics({ tags: ["signal", "broker", "portfolio"] });

    console.log(
      `[Webhook] ${created} tín hiệu mới, ${updated} cập nhật giá, tổng ${processed.length} xử lý (UltimateEngine)`
    );

    return NextResponse.json({
      saved: created,
      updated,
      reconciledWebOnly: 0,
      tickers: processed.map((s) => s.ticker),
      message: `${created} mới, ${updated} cập nhật (UltimateEngine)`,
    });
  } catch (error) {
    console.error("[Webhook /api/webhooks/signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi xử lý webhook" }, { status: 500 });
  }
}
