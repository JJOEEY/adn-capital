"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { RatingTable } from "@/components/rs-rating/RatingTable";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";
import { BarChart2, RefreshCw } from "lucide-react";
import { useTopic } from "@/hooks/useTopic";
import type { StockData } from "@/types";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";

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
  asOfDate?: string | null;
  requestedDate?: string | null;
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

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RSRatingPage() {
  const { isRsRatingLocked } = useSubscription();
  const [selectedDate, setSelectedDate] = useState("");
  const [datedPayload, setDatedPayload] = useState<RsRatingPayload | null>(null);
  const [datedLoading, setDatedLoading] = useState(false);
  const [datedError, setDatedError] = useState<string | null>(null);
  const rsTopic = useTopic<RsRatingPayload>("research:rs-rating:list", {
    refreshInterval: 900_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    if (!selectedDate) {
      setDatedPayload(null);
      setDatedError(null);
      setDatedLoading(false);
      return;
    }

    const controller = new AbortController();
    setDatedLoading(true);
    setDatedError(null);

    fetch(`/api/rs-rating?date=${encodeURIComponent(selectedDate)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = (await res.json()) as RsRatingPayload & { error?: string };
        if (!res.ok) {
          throw new Error(payload.error || "Không thể tải bảng xếp hạng theo ngày đã chọn.");
        }
        setDatedPayload(payload);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setDatedPayload(null);
        setDatedError(err instanceof Error ? err.message : "Không thể tải bảng xếp hạng theo ngày đã chọn.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDatedLoading(false);
      });

    return () => controller.abort();
  }, [selectedDate]);

  const effectivePayload = selectedDate ? datedPayload : rsTopic.data;

  const stocks = useMemo<StockData[]>(() => {
    const raw = effectivePayload?.stocks ?? [];
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
  }, [effectivePayload?.stocks]);

  const effectiveUpdatedAt = effectivePayload?.updatedAt ?? null;
  const effectiveAsOfDate = effectivePayload?.asOfDate ?? (selectedDate || null);
  const isInitialLoading = !selectedDate && rsTopic.isLoading && stocks.length === 0;
  const effectiveError = selectedDate ? datedError : rsTopic.error;

  const handleDownload = useCallback(() => {
    if (stocks.length === 0) return;
    const reportDate = effectiveAsOfDate ?? new Date().toISOString().slice(0, 10);
    const rows = [
      ["Ngày", "Mã CK", "Tên", "Giá", "% thay đổi", "Khối lượng", "ADN Rank", "Xếp loại", "Ngành"],
      ...stocks.map((stock) => [
        reportDate,
        stock.symbol,
        stock.name,
        String(stock.price),
        String(stock.changePercent),
        String(stock.volume),
        String(stock.rsRating),
        stock.rsRating > 90 ? "Super Star" : stock.rsRating >= 80 ? "Star" : stock.rsRating >= 60 ? "Watch" : "Farmer",
        stock.sector,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `adn-rank-${reportDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [effectiveAsOfDate, stocks]);

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
                <h1 className="text-xl font-black sm:text-2xl" style={{ color: "var(--text-primary)" }}>
                  {PRODUCT_NAMES.rsRating}
                </h1>
                <p className="truncate text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
                  Xếp hạng sức mạnh tương đối từ dữ liệu định lượng.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FreshnessBadge freshness={rsTopic.freshness} />
            {effectiveUpdatedAt ? (
              <span className="hidden text-[12px] sm:inline" style={{ color: "var(--text-muted)" }}>
                Cập nhật: {formatUpdatedAt(effectiveUpdatedAt)}
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

        {isInitialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]"
              />
            ))}
            <p className="mt-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Đang tải dữ liệu {PRODUCT_NAMES.rsRating}...
            </p>
          </div>
        ) : effectiveError ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {typeof effectiveError === "string" ? effectiveError : `Không thể tải dữ liệu ${PRODUCT_NAMES.rsRating}.`}
            </p>
            <button
              onClick={() => {
                if (selectedDate) {
                  const date = selectedDate;
                  setSelectedDate("");
                  window.setTimeout(() => setSelectedDate(date), 0);
                } else {
                  void rsTopic.refresh(true);
                }
              }}
              className="mt-3 text-xs hover:underline"
              style={{ color: "#10b981" }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <LockOverlay
            isLocked={isRsRatingLocked}
            message={`Nâng cấp VIP/Premium để xem bảng xếp hạng ${PRODUCT_NAMES.rsRating} đầy đủ`}
          >
            <RatingTable
              stocks={stocks}
              selectedDate={selectedDate}
              asOfDate={effectiveAsOfDate}
              dateLoading={datedLoading}
              onDateChange={setSelectedDate}
              onClearDate={() => setSelectedDate("")}
              onDownload={handleDownload}
            />
          </LockOverlay>
        )}
      </div>
    </MainLayout>
  );
}
