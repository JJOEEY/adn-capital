"use client";

import { useState } from "react";
import useSWR from "swr";
import { Zap, RefreshCw, History, Calendar } from "lucide-react";
import { SignalCard } from "@/components/signals/SignalCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Signal } from "@/types";

type BoLoc = "all" | "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";
type Tab = "today" | "history";

const danhSachBoLoc: { value: BoLoc; label: string; color: string }[] = [
  { value: "all", label: "Tất cả", color: "" },
  { value: "SIEU_CO_PHIEU", label: "Siêu Cổ Phiếu", color: "text-purple-400" },
  { value: "TRUNG_HAN", label: "Trung Hạn", color: "text-emerald-400" },
  { value: "DAU_CO", label: "Lướt sóng", color: "text-yellow-400" },
];

/** Fetcher cho SWR */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Component bản đồ tín hiệu — chỉ dành cho user VIP.
 * Tự động làm mới mỗi 5 phút nhờ SWR refreshInterval.
 */
export function SignalMapClient() {
  const [tab, setTab] = useState<Tab>("today");

  // Lịch sử 30 ngày (dùng cho cả 2 tab, lọc client-side)
  const { data, isLoading, isValidating, mutate } = useSWR<{ signals: Signal[] }>(
    "/api/signals?days=30",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const allSignals = data?.signals ?? [];
  const [filter, setFilter] = useState<BoLoc>("all");

  // Lọc "hôm nay" theo ngày VN (so sánh phần date của createdAt theo locale vi-VN)
  const todayStr = new Date().toLocaleDateString("vi-VN");
  const todaySignals = allSignals.filter(
    (s) => new Date(s.createdAt).toLocaleDateString("vi-VN") === todayStr
  );
  // Lịch sử = các tín hiệu KHÔNG phải hôm nay
  const historySignals = allSignals.filter(
    (s) => new Date(s.createdAt).toLocaleDateString("vi-VN") !== todayStr
  );

  const isHistoryLoading = isLoading;

  const activeSignals = tab === "today" ? todaySignals : historySignals;
  const daLoc = filter === "all" ? activeSignals : activeSignals.filter((s) => s.type === filter);

  const soLuong = {
    SIEU_CO_PHIEU: activeSignals.filter((s) => s.type === "SIEU_CO_PHIEU").length,
    TRUNG_HAN: activeSignals.filter((s) => s.type === "TRUNG_HAN").length,
    DAU_CO: activeSignals.filter((s) => s.type === "DAU_CO").length,
  };

  // Group history signals by date
  const groupedByDate = tab === "history"
    ? daLoc.reduce<Record<string, Signal[]>>((acc, s) => {
        const dateKey = new Date(s.createdAt).toLocaleDateString("vi-VN", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(s);
        return acc;
      }, {})
    : {};

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
      {/* === Tiêu đề + nút làm mới === */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex-shrink-0">
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white">Bản đồ Tín hiệu</h1>
            <p className="text-xs sm:text-sm text-neutral-500 truncate">
              {tab === "today"
                ? "Tín hiệu giao dịch hôm nay · Tự động cập nhật mỗi 5 phút"
                : "Lịch sử tín hiệu 30 ngày gần nhất"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          loading={isValidating}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* === Tabs: Hôm nay / Lịch sử === */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("today")}
          className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border transition-all ${
            tab === "today"
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Hôm nay
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border transition-all ${
            tab === "history"
              ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
              : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Lịch sử 30 ngày
        </button>
      </div>

      {/* === Thống kê nhanh === */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Siêu Cổ Phiếu", count: soLuong.SIEU_CO_PHIEU, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "Trung Hạn", count: soLuong.TRUNG_HAN, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Lướt sóng", count: soLuong.DAU_CO, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
        ].map((item) => (
          <Card key={item.label} className={`p-2.5 sm:p-4 text-center ${item.bg}`}>
            <p className={`text-xl sm:text-2xl font-black ${item.color}`}>{item.count}</p>
            <p className="text-[10px] sm:text-xs text-neutral-500 mt-0.5">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* === Bộ lọc loại tín hiệu === */}
      <div className="flex gap-2 flex-wrap">
        {danhSachBoLoc.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              filter === item.value
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
            }`}
          >
            <span className={filter === item.value ? "" : item.color}>{item.label}</span>
            {item.value !== "all" && (
              <span className="ml-1.5 opacity-60">({soLuong[item.value] ?? 0})</span>
            )}
          </button>
        ))}
      </div>

      {/* === Lưới tín hiệu === */}
      {(tab === "today" ? isLoading : isHistoryLoading) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-neutral-900 animate-pulse" />
          ))}
        </div>
      ) : tab === "today" ? (
        // Today: flat grid
        daLoc.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {daLoc.map((signal, index) => (
              <SignalCard key={signal.id} signal={signal} index={index} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Zap className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">Chưa có tín hiệu nào trong ngày hôm nay</p>
          </Card>
        )
      ) : (
        // History: grouped by date
        Object.keys(groupedByDate).length > 0 ? (
          <div className="space-y-5">
            {Object.entries(groupedByDate).map(([dateStr, signals]) => (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-2.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-400">{dateStr}</span>
                  <span className="text-[10px] text-neutral-600">({signals.length} tín hiệu)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {signals.map((signal, index) => (
                    <SignalCard key={signal.id} signal={signal} index={index} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <History className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">Chưa có tín hiệu nào trong 30 ngày qua</p>
          </Card>
        )
      )}

      {/* === Footer CTA === */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
        <p className="text-xs sm:text-sm text-neutral-400">
          💡 Gõ lệnh{" "}
          <span className="text-emerald-400 font-semibold">/ta [Mã]</span>{" "}
          vào khung Chat AI để nhận chiến lược chốt lời/cắt lỗ chi tiết.
        </p>
      </div>
    </div>
  );
}
