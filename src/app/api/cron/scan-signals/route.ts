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
import {
  validateCronSecret,
  logCron,
  pushNotification,
  isTradingDay,
  getVNDateISO,
  getSignalWindowInfo,
} from "@/lib/cronHelpers";

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
    type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";
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

    // Defensive dedupe in payload, then filter already-sent keys.
    const uniqueSignals = Array.from(
      new Map(scanResult.signals.map((s) => [toSignalKey(s.ticker, s.type), s])).values()
    );
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true },
    });
    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));

    let createdCount = 0;
    let updatedCount = 0;
    const notifySignals: PythonScanResult["signals"] = [];

    await prisma.$transaction(async (tx) => {
      for (const signal of uniqueSignals) {
        const ticker = signal.ticker.toUpperCase().trim();
        const key = toSignalKey(ticker, signal.type);
        const existing = existingMap.get(key);

        if (existing) {
          if (existing.status !== "CLOSED") {
            await tx.signal.update({
              where: { id: existing.id },
              data: {
                entryPrice: signal.entryPrice,
                reason: signal.reason ?? null,
              },
            });
            updatedCount += 1;
          }
        } else {
          await tx.signal.create({
            data: {
              ticker,
              type: signal.type,
              entryPrice: signal.entryPrice,
              reason: signal.reason ?? null,
            },
          });
          createdCount += 1;
        }

        if (!sentToday.has(key)) {
          notifySignals.push({ ...signal, ticker });
        }
      }

      if (notifySignals.length > 0) {
        await tx.signalHistory.createMany({
          data: notifySignals.map((s) => ({
            ticker: s.ticker,
            signalType: s.type,
            sentDate: todayISO,
          })),
          skipDuplicates: true,
        });
      }
    });

    if (notifySignals.length > 0) {
      const signalText = notifySignals
        .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${s.reason ? ` — ${s.reason}` : ""}`)
        .join("\n");
      const windowInfo = getSignalWindowInfo();

      await pushNotification(
        windowInfo.type,
        `📡 ${windowInfo.label} — ${notifySignals.length} tín hiệu đầu cơ mới`,
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
      totalSignaledToday: sentToday.size + notifySignals.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("signal_scan", "error", String(error), duration);
    console.error("[CRON scan-signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
