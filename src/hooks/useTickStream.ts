"use client";

import { useEffect, useRef, useState } from "react";

export type RealtimeTick = {
  price: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
  reference: number | null;
  updatedAt: string;
};

/**
 * Nhận tick DNSE realtime qua SSE /api/stream/ticks.
 * CHỈ mở kết nối khi `enabled` (mặc định false) — vì server gate bằng SSE_TICK_STREAM_ENABLED;
 * caller nên truyền enabled theo cờ public để tránh EventSource retry khi server OFF (503).
 * Trả map ticker → tick mới nhất.
 */
export function useTickStream(symbols: string[], enabled = false) {
  const [ticks, setTicks] = useState<Record<string, RealtimeTick>>({});
  const esRef = useRef<EventSource | null>(null);
  const key = symbols.join(",");

  useEffect(() => {
    if (!enabled || !key) return;
    const es = new EventSource(`/api/stream/ticks?symbols=${encodeURIComponent(key)}`);
    esRef.current = es;
    es.addEventListener("tick", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as { ticks?: Record<string, RealtimeTick> };
        if (payload.ticks) setTicks((prev) => ({ ...prev, ...payload.ticks }));
      } catch {
        /* bỏ qua message lỗi */
      }
    });
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [enabled, key]);

  return ticks;
}
