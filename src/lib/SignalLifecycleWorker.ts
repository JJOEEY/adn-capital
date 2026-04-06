/**
 * SignalLifecycleWorker — Quản lý vòng đời tín hiệu tự động
 *
 * Chạy định kỳ mỗi 5 phút (gọi từ cron endpoint) để:
 * 1. RADAR → ACTIVE: Khi giá breakout + volume xác nhận
 * 2. ACTIVE → cập nhật currentPnl realtime
 * 3. ACTIVE → CLOSED: Khi chạm Target/Stoploss hoặc AI exit signal
 *
 * Tất cả giá lấy từ Python Bridge qua /api/v1/batch-price
 */

import { prisma } from "@/lib/prisma";

const PYTHON_BRIDGE = process.env.PYTHON_BRIDGE_URL ?? "http://localhost:8000";

// Ngưỡng volume xác nhận breakout: Vol hiện tại > 1.5× MA20
const VOLUME_BREAKOUT_RATIO = 1.5;

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

interface BatchPriceItem {
  close: number;
  volume: number;
  ma20Volume: number;
}

interface ExitScanResult {
  ticker: string;
  shouldExit: boolean;
  reason: string | null;
}

interface LifecycleLog {
  ticker: string;
  from: string;
  to: string;
  reason: string;
  price: number;
}

// ═══════════════════════════════════════════════════════════════════
//  Helpers: gọi Python Bridge
// ═══════════════════════════════════════════════════════════════════

async function fetchBatchPrices(tickers: string[]): Promise<Record<string, BatchPriceItem>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/batch-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.prices ?? {};
  } catch (e) {
    console.error("[Lifecycle] Lỗi fetch batch price:", e);
    return {};
  }
}

async function fetchExitScan(ticker: string): Promise<ExitScanResult | null> {
  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/exit-scan/${ticker}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Main: updateSignalLifecycle()
// ═══════════════════════════════════════════════════════════════════

export async function updateSignalLifecycle(): Promise<{
  processed: number;
  activated: number;
  closed: number;
  pnlUpdated: number;
  logs: LifecycleLog[];
}> {
  const logs: LifecycleLog[] = [];
  let activated = 0;
  let closed = 0;
  let pnlUpdated = 0;

  // ── 1. Lấy tất cả tín hiệu RADAR + ACTIVE ────────────────────────────
  const signals = await prisma.signal.findMany({
    where: { status: { in: ["RADAR", "ACTIVE"] } },
  });

  if (signals.length === 0) {
    return { processed: 0, activated: 0, closed: 0, pnlUpdated: 0, logs };
  }

  // ── 2. Batch fetch giá cho tất cả tickers ─────────────────────────────
  const tickers = [...new Set(signals.map((s) => s.ticker))];
  const prices = await fetchBatchPrices(tickers);

  // ── 3. Xử lý từng tín hiệu ───────────────────────────────────────────
  for (const signal of signals) {
    const priceData = prices[signal.ticker];
    if (!priceData) continue;

    const { close: currentPrice, volume: currentVolume, ma20Volume } = priceData;

    // ═══════════════════════════════════════════════════════════════
    //  RADAR → ACTIVE: Breakout + Volume xác nhận
    // ═══════════════════════════════════════════════════════════════
    if (signal.status === "RADAR") {
      const breakoutPrice = signal.entryPrice;
      const volumeOk = ma20Volume > 0 && currentVolume > VOLUME_BREAKOUT_RATIO * ma20Volume;
      const priceOk = currentPrice >= breakoutPrice;

      if (priceOk && volumeOk) {
        await prisma.signal.update({
          where: { id: signal.id },
          data: {
            status: "ACTIVE",
            entryPrice: currentPrice, // Ghi entry price thực tế lúc kích hoạt
            currentPrice,
            currentPnl: 0,
          },
        });

        activated++;
        logs.push({
          ticker: signal.ticker,
          from: "RADAR",
          to: "ACTIVE",
          reason: `Đã báo MUA: Price ${currentPrice.toLocaleString()} >= Breakout ${breakoutPrice.toLocaleString()}, Vol ${currentVolume.toLocaleString()} > ${VOLUME_BREAKOUT_RATIO}× MA20 ${ma20Volume.toLocaleString()}`,
          price: currentPrice,
        });
      }
      continue;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACTIVE: Cập nhật PnL + kiểm tra exit conditions
    // ═══════════════════════════════════════════════════════════════
    if (signal.status === "ACTIVE") {
      const entryPrice = signal.entryPrice;
      const pnl = +((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);

      // ── Check exit conditions ─────────────────────────────────
      let shouldClose = false;
      let closedReason = "";

      // 3a. Chốt lời: currentPrice >= Target
      if (signal.target && currentPrice >= signal.target) {
        shouldClose = true;
        closedReason = `Chốt lời đạt Target: ${currentPrice.toLocaleString()} >= ${signal.target.toLocaleString()} (+${pnl}%)`;
      }

      // 3b. Cắt lỗ: currentPrice <= Stoploss
      if (!shouldClose && signal.stoploss && currentPrice <= signal.stoploss) {
        shouldClose = true;
        closedReason = `Cắt lỗ vi phạm Stoploss: ${currentPrice.toLocaleString()} <= ${signal.stoploss.toLocaleString()} (${pnl}%)`;
      }

      // 3c. AI Exit Signal (chỉ check khi chưa chạm TP/SL)
      if (!shouldClose) {
        const exitScan = await fetchExitScan(signal.ticker);
        if (exitScan?.shouldExit) {
          shouldClose = true;
          closedReason = `AI Bán Khẩn Cấp: ${exitScan.reason}`;
        }
      }

      if (shouldClose) {
        // ── ĐÓNG VỊ THẾ ──────────────────────────────────────────
        await prisma.signal.update({
          where: { id: signal.id },
          data: {
            status: "CLOSED",
            closePrice: currentPrice,
            currentPrice,
            currentPnl: pnl,
            pnl,
            closedReason,
            closedAt: new Date(),
          },
        });

        closed++;
        logs.push({
          ticker: signal.ticker,
          from: "ACTIVE",
          to: "CLOSED",
          reason: closedReason,
          price: currentPrice,
        });
      } else {
        // ── CẬP NHẬT PNL REALTIME ────────────────────────────────
        await prisma.signal.update({
          where: { id: signal.id },
          data: {
            currentPrice,
            currentPnl: pnl,
          },
        });
        pnlUpdated++;
      }
    }
  }

  console.log(
    `[Lifecycle] Xong — ${signals.length} tín hiệu xử lý: ` +
    `${activated} kích hoạt, ${closed} đóng, ${pnlUpdated} cập nhật PnL`
  );

  return {
    processed: signals.length,
    activated,
    closed,
    pnlUpdated,
    logs,
  };
}
