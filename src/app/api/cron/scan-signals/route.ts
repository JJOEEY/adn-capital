/**
 * API Cron: Quét tín hiệu giao dịch — Delegate sang Python Scanner
 *
 * TỐI ƯU API: Thay vì gọi 60+ VNDirect API per-ticker,
 * delegate toàn bộ sang Python scanner (đã batch 200 mã/4 FiinQuantX calls).
 * TS cron chỉ gọi 1 request duy nhất → Python → webhook tự xử lý.
 *
 * Kết quả lưu DB Signal + đẩy Notification.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSignals } from "@/lib/UltimateSignalEngine";
import {
  getAiBrokerRuntimeConfig,
  shouldAutoActivateSignal,
  rebalanceActiveBasketNav,
} from "@/lib/aiBroker";
import {
  validateCronSecret,
  logCron,
  pushNotification,
  isTradingDay,
  getVNDateISO,
  getSignalWindowInfo,
} from "@/lib/cronHelpers";
import { getVnNow } from "@/lib/time";

const PYTHON_BRIDGE = process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

// ═══════════════════════════════════════════════
//  Bảo mật & Anti-duplicate
// ═══════════════════════════════════════════════

function toSignalKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

async function getSentTodayMap(sentDate: string): Promise<Set<string>> {
  const rows = await prisma.signalHistory.findMany({
    where: { sentDate },
    select: { ticker: true, signalType: true },
  });
  return new Set(rows.map((r) => toSignalKey(r.ticker, r.signalType)));
}

// ═══════════════════════════════════════════════
//  Delegate scanning to Python Bridge (1 API call)
// ═══════════════════════════════════════════════

interface PythonScanResult {
  status: string;
  detected: number;
  signals: Array<{
    ticker: string;
    type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
    entryPrice: number;
    reason?: string;
  }>;
}

async function scanViaPython(): Promise<PythonScanResult> {
  const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════
//  HTTP Handler
// ═══════════════════════════════════════════════

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const startTime = Date.now();

  if (!isTradingDay()) {
    await logCron("signal_scan", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ type: "signal_scan", message: "Không phải ngày giao dịch" });
  }

  try {
    const todayISO = getVNDateISO();
    const sentToday = await getSentTodayMap(todayISO);

    // 1 API call → Python scanner (batches 200 tickers in 4 FiinQuantX calls)
    const scanResult = await scanViaPython();
    console.log(`[scan-signals] Python scanner: ${scanResult.detected} tín hiệu phát hiện`);

    const validSignals = scanResult.signals.filter((s) =>
      s?.ticker &&
      typeof s?.entryPrice === "number" &&
      ["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"].includes(s?.type)
    );
    const uniqueSignals = Array.from(
      new Map(validSignals.map((s) => [toSignalKey(s.ticker, s.type), s])).values()
    );
    const processed = await processSignals(uniqueSignals);
    const aiBrokerConfig = await getAiBrokerRuntimeConfig();

    const startOfDay = getVnNow().startOf("day").toDate();
    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true },
    });
    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));

    let createdCount = 0;
    let updatedCount = 0;
    const createCandidatesForNotify: PythonScanResult["signals"] = [];

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
        updatedCount += 1;
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

      createdCount += 1;
      createCandidatesForNotify.push({
        ticker: normalizedTicker,
        type: s.type,
        entryPrice: s.entryPrice,
        reason: s.reason,
      });
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

    const notifySignals = createCandidatesForNotify.filter(
      (s) => !sentToday.has(toSignalKey(s.ticker, s.type))
    );
    const backfillCandidates = createCandidatesForNotify.filter(
      (s) => sentToday.has(toSignalKey(s.ticker, s.type))
    );

    if (notifySignals.length > 0) {
      await prisma.signalHistory.createMany({
        data: notifySignals.map((s) => ({
          ticker: s.ticker,
          signalType: s.type,
          sentDate: todayISO,
        })),
        skipDuplicates: true,
      });
    }

    const reconciliationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSignalNotifications = await prisma.notification.findMany({
      where: {
        type: {
          in: [
            "signal_10h",
            "signal_1030",
            "signal_14h",
            "signal_1420",
            "signal_1130", // legacy
            "signal_1445", // legacy
            "signal_scan",
          ],
        },
        createdAt: { gte: reconciliationCutoff },
      },
      select: { content: true },
    });
    const recentContent = recentSignalNotifications.map((n) => n.content).join("\n");
    const missingOnWeb = backfillCandidates.filter((s) => !recentContent.includes(s.ticker));

    const webNotifySignals = Array.from(
      new Map(
        [...notifySignals, ...missingOnWeb].map((s) => [toSignalKey(s.ticker, s.type), s]),
      ).values(),
    );

    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${s.reason ? ` — ${s.reason}` : ""}`)
        .join("\n");
      const windowInfo = getSignalWindowInfo();

      await pushNotification(
        windowInfo.type,
        `📡 ${windowInfo.label} — ${webNotifySignals.length} tín hiệu đầu cơ mới`,
        `## TÍN HIỆU MỚI (${windowInfo.label})\n\n${signalText}`
      );
    }

    const duration = Date.now() - startTime;
    await logCron(
      "signal_scan",
      "success",
      `Đồng bộ ${createdCount + updatedCount} tín hiệu (mới ${createdCount}, cập nhật ${updatedCount}, notify ${notifySignals.length})`,
      duration,
      {
        created: createdCount,
        updated: updatedCount,
        notified: notifySignals.length,
        reconciledWebOnly: missingOnWeb.length,
      }
    );

    return NextResponse.json({
      type: "signal_scan",
      timestamp: new Date().toISOString(),
      message:
        createdCount + updatedCount > 0
          ? `Đồng bộ ${createdCount + updatedCount} tín hiệu`
          : "Không có tín hiệu cần đồng bộ",
      created: createdCount,
      updated: updatedCount,
      notified: notifySignals.length,
      reconciledWebOnly: missingOnWeb.length,
      totalSignaledToday: sentToday.size + notifySignals.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("signal_scan", "error", String(error), duration);
    console.error("[CRON scan-signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
