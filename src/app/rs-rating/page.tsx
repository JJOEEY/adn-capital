"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { RatingTable } from "@/components/rs-rating/RatingTable";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";
import { BarChart2, RefreshCw } from "lucide-react";
import type { StockData } from "@/types";

export default function RSRatingPage() {
  const { isRsRatingLocked } = useSubscription();
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchRsRating = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rs-rating");
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");
      const data = await res.json();
      const mapped: StockData[] = (data.stocks ?? []).map(
        (s: { symbol: string; name: string; price: number; change: number; changePercent: number; volume: number; rsRating: number; sector: string }) => ({
          symbol: s.symbol,
          name: s.name,
          price: s.price,
          change: s.change,
          changePercent: s.changePercent,
          volume: s.volume,
          rsRating: s.rsRating,
          sector: s.sector,
        })
      );
      setStocks(mapped);
      setUpdatedAt(data.updatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRsRating();
  }, []);

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl border flex-shrink-0" style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.25)" }}>
              <BarChart2 className="w-5 h-5" style={{ color: "#10b981" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>RS Rating</h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: "var(--text-muted)" }}>
                Xếp hạng sức mạnh tương đối — dữ liệu real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-[12px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                Cập nhật: {new Date(updatedAt).toLocaleTimeString("vi-VN")}
              </span>
            )}
            <button
              onClick={fetchRsRating}
              disabled={loading}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Chú thích màu sắc RS */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Super Star (RS > 90)", style: { background: "rgba(168,85,247,0.15)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" } },
            { label: "Star (80-90)", style: { background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)" } },
            { label: "Watch (60-80)", style: { background: "rgba(234,179,8,0.15)", color: "#eab308", borderColor: "rgba(234,179,8,0.25)" } },
            { label: "Farmer (< 60)", style: { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" } },
          ].map((item) => (
            <div
              key={item.label}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={item.style}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Loading / Error / Table */}
        {loading && stocks.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-[var(--surface)] rounded-xl animate-pulse border border-[var(--border)]"
              />
            ))}
            <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
              Đang tính toán RS Rating từ dữ liệu giá thực...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
            <button
              onClick={fetchRsRating}
              className="mt-3 text-xs hover:underline" style={{ color: "#10b981" }}
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
