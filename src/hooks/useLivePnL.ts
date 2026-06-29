"use client";

import { useEffect, useMemo, useState } from "react";
import { useTickStream } from "./useTickStream";

/**
 * Phủ giá realtime (SSE tick DNSE) lên PnL của nhật ký giao dịch.
 *
 * Lý do: /api/journal/pnl tính marketPrice từ close NGÀY (bridge historical) — đứng yên
 * trong phiên. Hook này nhận holdings + giá vốn từ server rồi override marketPrice bằng
 * tick LIVE (đã scale VND, khớp đơn vị giá vốn) để NAV / lãi-lỗ chưa chốt nhảy theo thời gian thực.
 *
 * - Chỉ mở SSE trong phiên (09:00–15:00, T2–T6 giờ VN) và khi có mã đang giữ.
 * - Ngoài phiên / chưa có tick: rơi về marketPrice của server (close ngày) — số khớp y hệt.
 */

export interface LivePnLHolding {
  ticker: string;
  qty: number;
  avgPrice: number;
  totalCost: number;
  marketPrice: number;
  marketValue: number;
}

export interface LivePnLInput {
  initialNAV: number;
  realizedPnL: number;
  holdings: LivePnLHolding[];
}

export interface LivePnLHoldingResult extends LivePnLHolding {
  /** true nếu marketPrice của mã này đến từ tick LIVE (không phải close ngày). */
  isLive: boolean;
}

export interface LivePnLResult {
  holdings: LivePnLHoldingResult[];
  unrealizedPnL: number;
  holdingsMarketValue: number;
  holdingsCostBasis: number;
  currentNAV: number;
  /** SSE đang được phép mở (trong phiên + có mã). */
  enabled: boolean;
  /** Có ít nhất 1 mã đang nhận giá LIVE. */
  isLive: boolean;
  livePrices: Record<string, number>;
  lastUpdate: string | null;
}

/**
 * Phiên giao dịch HOSE: T2–T6, 09:00–14:45 giờ VN (Asia/Ho_Chi_Minh, UTC+7 cố định).
 * Chốt 14:45 vì tick DNSE chỉ chảy tới hết ATC (~14:45) — sau đó giữ SSE mở vô ích.
 */
export function isVietnamTradingSession(now: Date): boolean {
  const vn = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const day = vn.getDay();
  if (day < 1 || day > 5) return false;
  const mins = vn.getHours() * 60 + vn.getMinutes();
  return mins >= 9 * 60 && mins <= 14 * 60 + 45;
}

export function useLivePnL(input: LivePnLInput | null): LivePnLResult {
  // Clock cập nhật mỗi 30s để bật/tắt theo phiên mà không cần refresh.
  // Bắt đầu 0 (SSR-safe), set Date.now() trong effect để tránh hydration mismatch.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const tickers = useMemo(
    () =>
      input
        ? input.holdings.filter((h) => h.qty > 0).map((h) => h.ticker.toUpperCase())
        : [],
    [input],
  );

  const inSession = nowMs > 0 && isVietnamTradingSession(new Date(nowMs));
  const enabled = tickers.length > 0 && inSession;
  const ticks = useTickStream(tickers, enabled);

  return useMemo(() => {
    if (!input) {
      return {
        holdings: [],
        unrealizedPnL: 0,
        holdingsMarketValue: 0,
        holdingsCostBasis: 0,
        currentNAV: 0,
        enabled,
        isLive: false,
        livePrices: {},
        lastUpdate: null,
      };
    }

    const livePrices: Record<string, number> = {};
    let lastUpdate: string | null = null;

    const holdings: LivePnLHoldingResult[] = input.holdings.map((h) => {
      const tick = ticks[h.ticker.toUpperCase()];
      const live = tick?.price;
      const hasLive = typeof live === "number" && live > 0;
      const marketPrice = hasLive ? live : h.marketPrice;
      if (hasLive) {
        livePrices[h.ticker.toUpperCase()] = live;
        if (tick?.updatedAt && (!lastUpdate || tick.updatedAt > lastUpdate)) {
          lastUpdate = tick.updatedAt;
        }
      }
      return { ...h, marketPrice, marketValue: h.qty * marketPrice, isLive: hasLive };
    });

    const holdingsMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0);
    const holdingsCostBasis = input.holdings.reduce((s, h) => s + h.totalCost, 0);
    const unrealizedPnL = holdingsMarketValue - holdingsCostBasis;
    const currentNAV = input.initialNAV + input.realizedPnL + unrealizedPnL;
    const isLive = enabled && holdings.some((h) => h.isLive);

    return {
      holdings,
      unrealizedPnL,
      holdingsMarketValue,
      holdingsCostBasis,
      currentNAV,
      enabled,
      isLive,
      livePrices,
      lastUpdate,
    };
  }, [input, ticks, enabled]);
}
