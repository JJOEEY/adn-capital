/**
 * SignalLifecycleWorker — Quản lý vòng đời tín hiệu (v3 — Trailing Stop Bậc Thang)
 *
 * Logic Gồng Lãi Bậc Thang (Staircase Trailing Stop):
 * - Khi PnL >= 20%: Chuyển ACTIVE → HOLD_TO_DIE
 * - Mỗi khi PnL nhảy thêm 10% → Dời SL lên mốc bảo toàn (PnL_floor - 10%)
 *   Ví dụ: PnL 25% → SL = +10% | PnL 32% → SL = +20% | PnL 41% → SL = +30%
 * - Đóng lệnh khi: giá xuống chạm SL mới HOẶC TEI >= 4.8
 * - Alert khi chạm ngưỡng cũ (target), không tự đóng lệnh
 *
 * API Budget / 5 phút:
 * - 1 batch-price request
 * - 1 batch-exit-scan request (ACTIVE + HOLD_TO_DIE)
 * - 1 TEI request (chỉ HOLD_TO_DIE tickers)
 */

import { prisma } from "@/lib/prisma";
import {
  getBatchPrices,
  getBatchExitScan,
} from "@/lib/PriceCache";
import {
  getAiBrokerRuntimeConfig,
  shouldAutoActivateSignal,
  rebalanceActiveBasketNav,
} from "@/lib/aiBroker";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const HOLD_TO_DIE_THRESHOLD = 20;   // % PnL để vào HOLD_TO_DIE
const TEI_EXIT_THRESHOLD    = 4.8;  // TEI hưng phấn cực độ → chốt lời
const PYTHON_BRIDGE = getPythonBridgeUrl();

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

interface TEIResult {
  ticker: string;
  tei: number;
  sentiment: string;
}

// ═══════════════════════════════════════════════════════════════════
//  Trailing Stop Calculator (Staircase)
//
//  Công thức: SL mới = Math.floor(currentPnl / 10) * 10 - 10
//  PnL 20% → SL = +10%
//  PnL 25% → SL = +10%
//  PnL 30% → SL = +20%
//  PnL 35% → SL = +20%
//  PnL 40% → SL = +30%
// ═══════════════════════════════════════════════════════════════════

function inferMaxProfitFromCurrentStop(currentStopPct: number): number {
  if (currentStopPct >= 20) return currentStopPct + 10;
  if (currentStopPct >= 15) return 20;
  if (currentStopPct >= 10) return 20; // backward compatible with old staircase
  return 0;
}

function calcTrailingStopLevel(maxProfitPct: number): number {
  if (maxProfitPct < HOLD_TO_DIE_THRESHOLD) return 0;
  if (maxProfitPct < 30) return 15;
  return +(maxProfitPct - 10).toFixed(2);
}

function calcTrailingStopPrice(entryPrice: number, trailingStopPct: number): number {
  return +(entryPrice * (1 + trailingStopPct / 100)).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════
//  TEI Fetch
// ═══════════════════════════════════════════════════════════════════

async function fetchTEIBatch(tickers: string[]): Promise<Record<string, TEIResult>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/batch-tei`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FiinQuant-User": process.env.FIINQUANT_USER ?? "",
        "X-FiinQuant-Pass": process.env.FIINQUANT_PASS ?? "",
      },
      body: JSON.stringify({ tickers }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return (data.results ?? {}) as Record<string, TEIResult>;
  } catch (e) {
    console.error("[TEIFetch] Error:", e);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Main: updateSignalLifecycle()
// ═══════════════════════════════════════════════════════════════════

export async function updateSignalLifecycle(): Promise<{
  processed: number;
  activated: number;
  closed: number;
  holdToDie: number;
  trailingUpdated: number;
  alerted: number;
  pnlUpdated: number;
  logs: LifecycleLog[];
}> {
  const logs: LifecycleLog[] = [];
  let activated = 0, closed = 0, holdToDie = 0, trailingUpdated = 0, alerted = 0, pnlUpdated = 0;

  // ── 1. Lấy tất cả tín hiệu cần xử lý ───────────────────────────
  const signals = await prisma.signal.findMany({
    where: { status: { in: ["RADAR", "ACTIVE", "HOLD_TO_DIE"] } },
  });
  if (signals.length === 0) {
    return { processed: 0, activated: 0, closed: 0, holdToDie: 0, trailingUpdated: 0, alerted: 0, pnlUpdated: 0, logs };
  }

  console.log(`[Lifecycle] ${signals.filter(s=>s.status==="RADAR").length} RADAR | ${signals.filter(s=>s.status==="ACTIVE").length} ACTIVE | ${signals.filter(s=>s.status==="HOLD_TO_DIE").length} HOLD_TO_DIE`);

  // ── 2. Batch giá (1 API call) ────────────────────────────────────
  const tickers = [...new Set(signals.map(s => s.ticker))];
  const prices = await getBatchPrices(tickers);
  if (Object.keys(prices).length === 0) {
    console.error("[Lifecycle] Không lấy được giá!");
    return { processed: signals.length, activated: 0, closed: 0, holdToDie: 0, trailingUpdated: 0, alerted: 0, pnlUpdated: 0, logs };
  }

  // ── 3. Batch exit-scan (1 API call) ──────────────────────────────
  const activeTickers = [...new Set(signals.filter(s => s.status !== "RADAR").map(s => s.ticker))];
  const exitScans = activeTickers.length > 0 ? await getBatchExitScan(activeTickers) : {};

  // ── 4. TEI batch — chỉ HOLD_TO_DIE (1 API call) ─────────────────
  const holdTickers = [...new Set(signals.filter(s => s.status === "HOLD_TO_DIE").map(s => s.ticker))];
  const teiMap = holdTickers.length > 0 ? await fetchTEIBatch(holdTickers) : {};
  const aiBrokerConfig = await getAiBrokerRuntimeConfig();

  // ── 5. Xử lý từng tín hiệu ───────────────────────────────────────
  for (const signal of signals) {
    const priceData = prices[signal.ticker];
    if (!priceData) continue;
    const { close: currentPrice } = priceData;

    // ═══════════════════════════════════════════════════════════
    //  RADAR → ACTIVE
    // ═══════════════════════════════════════════════════════════
    if (signal.status === "RADAR") {
      const hasAiMetrics =
        typeof signal.winRate === "number" &&
        signal.winRate > 0 &&
        typeof signal.rrRatio === "string" &&
        signal.rrRatio.length > 0;

      const autoActivate = shouldAutoActivateSignal(
        {
          entryPrice: signal.entryPrice,
          currentPrice,
          winRate: signal.winRate,
          rrRatio: signal.rrRatio,
        },
        aiBrokerConfig
      );

      const fallbackActivate = !hasAiMetrics && currentPrice >= signal.entryPrice;
      if (autoActivate || fallbackActivate) {
        await prisma.signal.update({
          where: { id: signal.id },
          data: { status: "ACTIVE", entryPrice: currentPrice, currentPrice, currentPnl: 0 },
        });
        activated++;
        logs.push({
          ticker: signal.ticker,
          from: "RADAR",
          to: "ACTIVE",
          reason: autoActivate
            ? `NexPilot Active (${currentPrice.toLocaleString()})`
            : `Breakout Active (${currentPrice.toLocaleString()})`,
          price: currentPrice,
        });
      }
      continue;
    }

    const entryPrice = signal.entryPrice;
    if (!entryPrice || entryPrice <= 0) continue;
    const pnl = +((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);

    // ═══════════════════════════════════════════════════════════
    //  ACTIVE: Gồng lãi / cắt lỗ / cảnh báo
    // ═══════════════════════════════════════════════════════════
    if (signal.status === "ACTIVE") {
      const stoploss  = signal.stoploss ?? +(entryPrice * 0.93).toFixed(2);
      const alertLevel = signal.target  ?? +(entryPrice * 1.10).toFixed(2);

      // 1. Upgrade → HOLD_TO_DIE
      if (pnl >= HOLD_TO_DIE_THRESHOLD) {
        const trailingStopPct = calcTrailingStopLevel(pnl);
        const trailingStopPrice = calcTrailingStopPrice(entryPrice, trailingStopPct);
        const holdingAction = `🔥 Lợi nhuận đạt ${pnl}%, đề nghị tiếp tục GỒNG LÃI. Đã tự động dời Stoploss bảo toàn vốn lên mốc +${trailingStopPct}%.`;

        await prisma.signal.update({
          where: { id: signal.id },
          data: {
            status: "HOLD_TO_DIE",
            stoploss: trailingStopPrice,
            currentPrice,
            currentPnl: pnl,
            holdingAction,
          },
        });
        holdToDie++;
        logs.push({ ticker: signal.ticker, from: "ACTIVE", to: "HOLD_TO_DIE", reason: holdingAction, price: currentPrice });
        continue;
      }

      // 2. Cắt lỗ
      if (currentPrice <= stoploss) {
        await prisma.signal.update({
          where: { id: signal.id },
          data: { status: "CLOSED", closePrice: currentPrice, currentPrice, currentPnl: pnl, pnl,
            closedReason: `🛑 Cắt lỗ SL ${stoploss.toLocaleString()} (${pnl}%)`, closedAt: new Date() },
        });
        closed++;
        logs.push({ ticker: signal.ticker, from: "ACTIVE", to: "CLOSED", reason: `Cắt lỗ ${pnl}%`, price: currentPrice });
        continue;
      }

      // 3. Alert ngưỡng cảnh báo (không đóng)
      if (currentPrice >= alertLevel) {
        alerted++;
        logs.push({ ticker: signal.ticker, from: "ACTIVE", to: "ACTIVE",
          reason: `🔔 Alert: chạm ngưỡng ${alertLevel.toLocaleString()} (+${pnl}%) — Chờ TEI`, price: currentPrice });
      }

      // 4. AI exit
      const exitResult = exitScans[signal.ticker];
      if (exitResult?.shouldExit) {
        await prisma.signal.update({
          where: { id: signal.id },
          data: { status: "CLOSED", closePrice: currentPrice, currentPrice, currentPnl: pnl, pnl,
            closedReason: `🤖 AI Exit: ${exitResult.reason}`, closedAt: new Date() },
        });
        closed++;
        logs.push({ ticker: signal.ticker, from: "ACTIVE", to: "CLOSED", reason: `AI Exit`, price: currentPrice });
        continue;
      }

      // 5. Cập nhật PnL
      await prisma.signal.update({ where: { id: signal.id }, data: { currentPrice, currentPnl: pnl } });
      pnlUpdated++;
    }

    // ═══════════════════════════════════════════════════════════
    //  HOLD_TO_DIE: Trailing Stop Bậc Thang
    // ═══════════════════════════════════════════════════════════
    if (signal.status === "HOLD_TO_DIE") {
      const currentTrailingSL = signal.stoploss ?? entryPrice;
      const currentStopPct = +(((currentTrailingSL - entryPrice) / entryPrice) * 100).toFixed(2);
      const inferredMaxProfit = inferMaxProfitFromCurrentStop(currentStopPct);
      const maxProfit = Math.max(inferredMaxProfit, pnl);
      const newTrailingPct = calcTrailingStopLevel(maxProfit);
      const newTrailingPrice = calcTrailingStopPrice(entryPrice, newTrailingPct);

      // Chỉ dời SL lên, không bao giờ kéo xuống
      const effectiveSL = Math.max(currentTrailingSL, newTrailingPrice);

      // Cập nhật trailing SL nếu nhảy nấc mới
      if (newTrailingPrice > currentTrailingSL) {
        const holdingAction = `🔥 Lợi nhuận đạt ${pnl}%, đề nghị tiếp tục GỒNG LÃI. Đã tự động dời Stoploss bảo toàn vốn lên mốc +${newTrailingPct}%.`;
        await prisma.signal.update({
          where: { id: signal.id },
          data: { stoploss: newTrailingPrice, currentPrice, currentPnl: pnl, holdingAction },
        });
        trailingUpdated++;
        logs.push({ ticker: signal.ticker, from: "HOLD_TO_DIE", to: "HOLD_TO_DIE",
          reason: holdingAction, price: currentPrice });
        continue;
      }

      // Vi phạm Trailing Stop → đóng, chốt lãi
      if (currentPrice <= effectiveSL) {
        await prisma.signal.update({
          where: { id: signal.id },
          data: { status: "CLOSED", closePrice: currentPrice, currentPrice, currentPnl: pnl, pnl,
            closedReason: `✅ [GỒNG LÃI] Chốt lãi: giá chạm Trailing SL ${effectiveSL.toLocaleString()} (+${newTrailingPct}%) | Thực nhận: +${pnl}%`,
            closedAt: new Date(), holdingAction: null },
        });
        closed++;
        logs.push({ ticker: signal.ticker, from: "HOLD_TO_DIE", to: "CLOSED",
          reason: `Trailing SL hit +${pnl}%`, price: currentPrice });
        continue;
      }

      // TEI hưng phấn → chủ động chốt
      const tei = teiMap[signal.ticker];
      if (tei && tei.tei >= TEI_EXIT_THRESHOLD) {
        await prisma.signal.update({
          where: { id: signal.id },
          data: { status: "CLOSED", closePrice: currentPrice, currentPrice, currentPnl: pnl, pnl,
            closedReason: `🎯 [GỒNG LÃI] TEI ${tei.tei.toFixed(1)} >= ${TEI_EXIT_THRESHOLD} (${tei.sentiment}) — Chốt toàn bộ +${pnl}%`,
            closedAt: new Date(), holdingAction: null },
        });
        closed++;
        logs.push({ ticker: signal.ticker, from: "HOLD_TO_DIE", to: "CLOSED",
          reason: `TEI hưng phấn: +${pnl}%`, price: currentPrice });
        continue;
      }

      // Tiếp tục gồng — chỉ cập nhật PnL
      await prisma.signal.update({ where: { id: signal.id }, data: { currentPrice, currentPnl: pnl } });
      pnlUpdated++;
    }
  }

  await rebalanceActiveBasketNav(aiBrokerConfig.maxTotalNav);
  console.log(`[Lifecycle] Xong — Activated:${activated} | HOLD:${holdToDie} | Trailing↑:${trailingUpdated} | Closed:${closed} | Alert:${alerted} | PnL:${pnlUpdated}`);
  return { processed: signals.length, activated, closed, holdToDie, trailingUpdated, alerted, pnlUpdated, logs };
}
