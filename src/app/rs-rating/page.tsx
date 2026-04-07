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
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex-shrink-0">
              <BarChart2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-white">RS Rating</h1>
              <p className="text-xs sm:text-sm text-neutral-500 truncate">
                Xếp hạng sức mạnh tương đối — dữ liệu real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-[12px] text-neutral-600 hidden sm:inline">
                Cập nhật: {new Date(updatedAt).toLocaleTimeString("vi-VN")}
              </span>
            )}
            <button
              onClick={fetchRsRating}
              disabled={loading}
              className="p-2 rounded-lg border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Chú thích màu sắc RS */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Super Star (RS > 90)", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
            { label: "Star (80-90)", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
            { label: "Watch (60-80)", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
            { label: "Farmer (< 60)", color: "bg-neutral-800 text-neutral-400 border-neutral-700" },
          ].map((item) => (
            <div
              key={item.label}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${item.color}`}
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
                className="h-12 bg-neutral-900 rounded-xl animate-pulse border border-neutral-800/50"
              />
            ))}
            <p className="text-center text-xs text-neutral-600 mt-4">
              Đang tính toán RS Rating từ dữ liệu giá thực...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchRsRating}
              className="mt-3 text-xs text-emerald-400 hover:underline"
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
