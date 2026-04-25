"use client";

import { useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { RatingTable } from "@/components/rs-rating/RatingTable";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";
import { BarChart2, RefreshCw } from "lucide-react";
import { useTopic } from "@/hooks/useTopic";
import type { StockData } from "@/types";

type RsRatingPayload = {
  stocks?: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    rsRating: number;
    sector: string;
  }>;
  updatedAt?: string | null;
};

function FreshnessBadge({ freshness }: { freshness: string | null }) {
  if (!freshness) return null;
  const state = freshness.toLowerCase();
  const isFresh = state === "fresh";
  const isStale = state === "stale";
  const label = isFresh ? "Fresh" : isStale ? "Stale" : state.toUpperCase();
  const style = isFresh
    ? { color: "#16a34a", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.10)" }
    : isStale
      ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)" }
      : { color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.10)" };
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={style}>
      {label}
    </span>
  );
}

export default function RSRatingPage() {
  const { isRsRatingLocked } = useSubscription();
  const rsTopic = useTopic<RsRatingPayload>("research:rs-rating:list", {
    refreshInterval: 900_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const stocks = useMemo<StockData[]>(() => {
    const raw = rsTopic.data?.stocks ?? [];
    return raw.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      change: s.change,
      changePercent: s.changePercent,
      volume: s.volume,
      rsRating: s.rsRating,
      sector: s.sector,
    }));
  }, [rsTopic.data?.stocks]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-4 p-3 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="rounded-xl border p-2"
                style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.25)" }}
              >
                <BarChart2 className="h-5 w-5" style={{ color: "#10b981" }} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black sm:text-2xl" style={{ color: "var(--text-primary)" }}>RS Rating</h1>
                <p className="truncate text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
                  Xếp hạng sức mạnh tương đối từ dữ liệu định lượng.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FreshnessBadge freshness={rsTopic.freshness} />
            {rsTopic.data?.updatedAt ? (
              <span className="hidden text-[12px] sm:inline" style={{ color: "var(--text-muted)" }}>
                Cập nhật: {new Date(rsTopic.data.updatedAt).toLocaleTimeString("vi-VN")}
              </span>
            ) : null}
            <button
              onClick={() => void rsTopic.refresh(true)}
              disabled={rsTopic.isValidating}
              className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] transition-all hover:text-[var(--text-primary)] disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${rsTopic.isValidating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {rsTopic.isLoading && stocks.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]"
              />
            ))}
            <p className="mt-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Đang tải dữ liệu RS Rating...
            </p>
          </div>
        ) : rsTopic.error ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {typeof rsTopic.error === "string" ? rsTopic.error : "Không thể tải dữ liệu RS Rating."}
            </p>
            <button
              onClick={() => void rsTopic.refresh(true)}
              className="mt-3 text-xs hover:underline"
              style={{ color: "#10b981" }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <LockOverlay
            isLocked={isRsRatingLocked}
            message="Nâng cấp VIP để xem bảng xếp hạng RS Rating đầy đủ"
          >
            <RatingTable stocks={stocks} />
          </LockOverlay>
        )}
      </div>
    </MainLayout>
  );
}
