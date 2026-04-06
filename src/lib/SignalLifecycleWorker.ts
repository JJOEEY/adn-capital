/**
 * SignalLifecycleWorker — Quản lý vòng đời tín hiệu tự động
 *
 * Chạy định kỳ mỗi 5 phút (gọi từ cron endpoint) để:
 * 1. RADAR → ACTIVE: Khi giá breakout + volume xác nhận
 * 2. ACTIVE → cập nhật currentPnl realtime
 * 3. ACTIVE → CLOSED: Khi chạm Target/Stoploss hoặc AI exit signal
 *
 * API Budget mỗi lần chạy:
 * - 1 batch-price request (tất cả tickers)
 * - 1 batch-exit-scan request (chỉ ACTIVE tickers)
 * = TỐI ĐA 2 API calls / 5 phút
 */

import { prisma } from "@/lib/prisma";
import { getBatchPrices, getBatchExitScan, type PriceItem, type ExitScanItem } from "@/lib/PriceCache";

// Ngưỡng volume xác nhận breakout: Vol hiện tại > 1.5× MA20
const VOLUME_BREAKOUT_RATIO = 1.5;

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

interface LifecycleLog {
  ticker: string;
  from: string;
  to: string;
  reason: string;
  price: number;
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

  const radarCount = signals.filter((s) => s.status === "RADAR").length;
  const activeCount = signals.filter((s) => s.status === "ACTIVE").length;
  console.log(`[Lifecycle] Bắt đầu — ${radarCount} RADAR, ${activeCount} ACTIVE`);

  // ── 2. Batch fetch giá cho tất cả tickers (1 API call) ──────────────
  const tickers = [...new Set(signals.map((s) => s.ticker))];
  const prices = await getBatchPrices(tickers);

  const pricedTickers = Object.keys(prices).length;
  console.log(`[Lifecycle] Giá: ${pricedTickers}/${tickers.length} tickers có dữ liệu`);

  if (pricedTickers === 0) {
    console.error("[Lifecycle] CẢNH BÁO: Không lấy được giá nào! Kiểm tra Python Bridge / API quota.");
    return { processed: signals.length, activated: 0, closed: 0, pnlUpdated: 0, logs };
  }

  // ── 3. Batch exit-scan cho ACTIVE tickers (1 API call) ────────────────
  const activeTickers = [...new Set(
    signals.filter((s) => s.status === "ACTIVE").map((s) => s.ticker)
  )];
  const exitScans = activeTickers.length > 0
    ? await getBatchExitScan(activeTickers)
    : {};

  // ── 3. Xử lý từng tín hiệu ───────────────────────────────────────────
  for (const signal of signals) {
    const priceData = prices[signal.ticker];
    if (!priceData) continue;

    const { close: currentPrice, volume: currentVolume, ma20Volume } = priceData;

    // ═══════════════════════════════════════════════════════════════
    //  RADAR → ACTIVE: Breakout + Volume xác nhận
    //  Nếu không có MA20 (CafeF fallback), chỉ dùng price breakout
    // ═══════════════════════════════════════════════════════════════
    if (signal.status === "RADAR") {
      const breakoutPrice = signal.entryPrice;
      const hasMA20 = ma20Volume > 0;
      const volumeOk = hasMA20
        ? currentVolume > VOLUME_BREAKOUT_RATIO * ma20Volume
        : true; // CafeF không có MA20 → skip volume check
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
      if (!entryPrice || entryPrice <= 0) continue;

      const pnl = +((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);

      // ── Check exit conditions ─────────────────────────────────
      let shouldClose = false;
      let closedReason = "";

      // Auto-calculate target/stoploss nếu chưa có:
      // Target = +10%, Stoploss = -7% (conservative defaults)
      const target = signal.target ?? entryPrice * 1.10;
      const stoploss = signal.stoploss ?? entryPrice * 0.93;

      // 3a. Chốt lời: currentPrice >= Target
      if (currentPrice >= target) {
        shouldClose = true;
        const targetLabel = signal.target ? "Target gốc" : "Target tự động +10%";
        closedReason = `Chốt lời đạt ${targetLabel}: ${currentPrice.toLocaleString()} >= ${target.toLocaleString()} (+${pnl}%)`;
      }

      // 3b. Cắt lỗ: currentPrice <= Stoploss
      if (!shouldClose && currentPrice <= stoploss) {
        shouldClose = true;
        const slLabel = signal.stoploss ? "Stoploss gốc" : "Stoploss tự động -7%";
        closedReason = `Cắt lỗ vi phạm ${slLabel}: ${currentPrice.toLocaleString()} <= ${stoploss.toLocaleString()} (${pnl}%)`;
      }

      // 3c. AI Exit Signal (từ batch exit-scan, KHÔNG gọi API per-ticker)
      if (!shouldClose) {
        const exitResult = exitScans[signal.ticker];
        if (exitResult?.shouldExit) {
          shouldClose = true;
          closedReason = `AI Bán Khẩn Cấp: ${exitResult.reason}`;
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
