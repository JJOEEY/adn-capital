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
} from "@/lib/cronHelpers";

const PYTHON_BRIDGE = process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

// ═══════════════════════════════════════════════
//  Bảo mật & Anti-duplicate
// ═══════════════════════════════════════════════

async function getSignaledTodayStocks(): Promise<string[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaySignals = await prisma.signal.findMany({
    where: { createdAt: { gte: startOfDay } },
    select: { ticker: true },
  });
  return todaySignals.map((s: { ticker: string }) => s.ticker);
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
    const alreadySignaled = await getSignaledTodayStocks();

    // 1 API call → Python scanner (batches 200 tickers in 4 FiinQuantX calls)
    const scanResult = await scanViaPython();
    console.log(`[scan-signals] Python scanner: ${scanResult.detected} tín hiệu phát hiện`);

    // Filter out already-signaled tickers
    const newSignals = scanResult.signals.filter(
      (s) => !alreadySignaled.includes(s.ticker)
    );

    if (newSignals.length === 0) {
      const duration = Date.now() - startTime;
      await logCron("signal_scan", "success", "Không có tín hiệu mới", duration);
      return NextResponse.json({
        type: "signal_scan",
        timestamp: new Date().toISOString(),
        message: "Không có tín hiệu mới",
        newSignals: [],
        totalSignaledToday: alreadySignaled.length,
      });
    }

    const savedSignals = await prisma.$transaction(
      newSignals.map((signal) =>
        prisma.signal.create({
          data: {
            ticker: signal.ticker,
            type: signal.type,
            entryPrice: signal.entryPrice,
          },
        })
      )
    );

    // Đẩy Notification — include reason from Python scan
    const reasonMap = new Map(newSignals.map((s) => [s.ticker, s.reason ?? ""]));
    const signalText = savedSignals
      .map((s) => {
        const reason = reasonMap.get(s.ticker);
        return `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${reason ? ` — ${reason}` : ""}`;
      })
      .join("\n");

    await pushNotification(
      "signal_5m",
      `📡 ${savedSignals.length} tín hiệu đầu cơ mới`,
      `## TÍN HIỆU MỚI\n\n${signalText}`
    );

    const duration = Date.now() - startTime;
    await logCron("signal_scan", "success", `${savedSignals.length} tín hiệu mới`, duration, {
      newSignals: savedSignals.length,
    });

    return NextResponse.json({
      type: "signal_scan",
      timestamp: new Date().toISOString(),
      message: `Phát hiện ${savedSignals.length} tín hiệu đầu cơ mới`,
      newSignals: savedSignals,
      totalSignaledToday: alreadySignaled.length + savedSignals.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("signal_scan", "error", String(error), duration);
    console.error("[CRON scan-signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
