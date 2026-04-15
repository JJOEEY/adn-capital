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
    const newSignals = uniqueSignals.filter((s) => !sentToday.has(toSignalKey(s.ticker, s.type)));

    if (newSignals.length === 0) {
      const duration = Date.now() - startTime;
      await logCron("signal_scan", "success", "Không có tín hiệu mới", duration);
      return NextResponse.json({
        type: "signal_scan",
        timestamp: new Date().toISOString(),
        message: "Không có tín hiệu mới",
        newSignals: [],
        totalSignaledToday: sentToday.size,
      });
    }

    const savedSignals = await prisma.$transaction(async (tx) => {
      await tx.signalHistory.createMany({
        data: newSignals.map((s) => ({
          ticker: s.ticker.toUpperCase().trim(),
          signalType: s.type,
          sentDate: todayISO,
        })),
        skipDuplicates: true,
      });
      return Promise.all(
        newSignals.map((signal) =>
          tx.signal.create({
            data: {
              ticker: signal.ticker.toUpperCase().trim(),
              type: signal.type,
              entryPrice: signal.entryPrice,
            },
          })
        )
      );
    });

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
      totalSignaledToday: sentToday.size + savedSignals.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("signal_scan", "error", String(error), duration);
    console.error("[CRON scan-signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
