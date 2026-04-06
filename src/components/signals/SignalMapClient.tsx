"use client";

import { useState } from "react";
import useSWR from "swr";
import { Zap, RefreshCw, Crosshair, Briefcase, CheckCircle, Crown, Lock, Bot, TrendingUp } from "lucide-react";
import { SignalCard } from "@/components/signals/SignalCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Signal } from "@/types";
import Link from "next/link";

type Tab = "RADAR" | "ACTIVE" | "CLOSED";
type TierFilter = "all" | "LEADER" | "TRUNG_HAN" | "NGAN_HAN";

const TABS: { value: Tab; label: string; icon: typeof Crosshair; color: string }[] = [
  { value: "RADAR", label: "Tầm ngắm", icon: Crosshair, color: "cyan" },
  { value: "ACTIVE", label: "Đang nắm giữ", icon: Briefcase, color: "emerald" },
  { value: "CLOSED", label: "Đã đóng", icon: CheckCircle, color: "neutral" },
];

const TIER_FILTERS: { value: TierFilter; label: string; icon: string; color: string }[] = [
  { value: "all", label: "Tất cả", icon: "", color: "" },
  { value: "LEADER", label: "👑 Leader", icon: "👑", color: "text-purple-400" },
  { value: "TRUNG_HAN", label: "🛡️ Trung hạn", icon: "🛡️", color: "text-blue-400" },
  { value: "NGAN_HAN", label: "⚡ Ngắn hạn", icon: "⚡", color: "text-amber-400" },
];

const TAB_ACTIVE_STYLES: Record<Tab, string> = {
  RADAR: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CLOSED: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SignalMapClient({ isPremium = false }: { isPremium?: boolean }) {
  const [tab, setTab] = useState<Tab>("RADAR");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const { data, isLoading, isValidating, mutate } = useSWR<{ signals: Signal[] }>(
    "/api/signals?days=90",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const allSignals = data?.signals ?? [];

  // Filter by tab (status)
  const tabSignals = allSignals.filter((s) => (s.status ?? "RADAR") === tab);

  // Filter by tier
  const filtered = tierFilter === "all"
    ? tabSignals
    : tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === tierFilter);

  // Stats
  const stats = {
    radar: allSignals.filter((s) => (s.status ?? "RADAR") === "RADAR").length,
    active: allSignals.filter((s) => s.status === "ACTIVE").length,
    closed: allSignals.filter((s) => s.status === "CLOSED").length,
    totalPnl: allSignals
      .filter((s) => s.status === "CLOSED" && s.pnl != null)
      .reduce((sum, s) => sum + (s.pnl ?? 0), 0),
    winCount: allSignals.filter((s) => s.status === "CLOSED" && (s.pnl ?? 0) > 0).length,
    loseCount: allSignals.filter((s) => s.status === "CLOSED" && (s.pnl ?? 0) <= 0).length,
  };

  const tierCounts = {
    LEADER: tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === "LEADER").length,
    TRUNG_HAN: tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === "TRUNG_HAN").length,
    NGAN_HAN: tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === "NGAN_HAN").length,
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex-shrink-0">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white">Signal Dashboard</h1>
            <p className="text-xs sm:text-sm text-neutral-500 truncate">
              UltimateSignalEngine — VSA × Seasonality × AI Broker
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => mutate()} loading={isValidating}>
          <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* ═══ Stats Overview ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3 text-center bg-cyan-500/5 border-cyan-500/20">
          <p className="text-2xl font-black text-cyan-400">{stats.radar}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Tầm ngắm</p>
        </Card>
        <Card className="p-3 text-center bg-emerald-500/5 border-emerald-500/20">
          <p className="text-2xl font-black text-emerald-400">{stats.active}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Đang giữ</p>
        </Card>
        <Card className="p-3 text-center bg-neutral-500/5 border-neutral-700">
          <p className="text-2xl font-black text-neutral-300">{stats.closed}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Đã đóng</p>
        </Card>
        <Card className={`p-3 text-center ${stats.totalPnl >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
          <p className={`text-2xl font-black ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(1)}%
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">PnL tổng ({stats.winCount}W / {stats.loseCount}L)</p>
        </Card>
      </div>

      {/* ═══ Tab bar: RADAR / ACTIVE / CLOSED ═══ */}
      <div className="flex gap-2">
        {TABS.map(({ value, label, icon: Icon, color }) => (
          <button
            key={value}
            onClick={() => {
              if (value === "CLOSED" && !isPremium) return;
              setTab(value);
            }}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border transition-all ${
              value === "CLOSED" && !isPremium
                ? "text-neutral-600 border-neutral-800 bg-neutral-900 cursor-not-allowed opacity-60"
                : tab === value
                ? TAB_ACTIVE_STYLES[value]
                : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
            }`}
          >
            {value === "CLOSED" && !isPremium ? <Lock className="w-3 h-3" /> : <Icon className="w-3.5 h-3.5" />}
            {label}
            <span className="text-[10px] opacity-60">
              ({value === "RADAR" ? stats.radar : value === "ACTIVE" ? stats.active : stats.closed})
            </span>
            {value === "CLOSED" && !isPremium && (
              <span className="text-[8px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1 py-0 rounded">VIP</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ Tier filter ═══ */}
      <div className="flex gap-2 flex-wrap">
        {TIER_FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => setTierFilter(item.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              tierFilter === item.value
                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
            }`}
          >
            <span className={tierFilter === item.value ? "" : item.color}>{item.label}</span>
            {item.value !== "all" && (
              <span className="ml-1.5 opacity-60">({tierCounts[item.value] ?? 0})</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ Signal grid ═══ */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-neutral-900 animate-pulse" />
          ))}
        </div>
      ) : tab === "CLOSED" && !isPremium ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-black text-white mb-2">Dành riêng cho VIP</h3>
          <p className="text-sm text-neutral-500 mb-4 max-w-sm mx-auto">
            Nâng cấp lên gói VIP để xem toàn bộ lịch sử tín hiệu đã đóng và hiệu suất PnL.
          </p>
          <Link href="/pricing">
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all cursor-pointer">
              <Crown className="w-4 h-4" />
              Nâng cấp VIP
            </button>
          </Link>
        </Card>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((signal, index) => (
            <SignalCard key={signal.id} signal={signal} index={index} />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Crosshair className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">
            {tab === "RADAR" && "Chưa có tín hiệu nào trong tầm ngắm"}
            {tab === "ACTIVE" && "Chưa có vị thế đang nắm giữ"}
            {tab === "CLOSED" && "Chưa có vị thế nào đã đóng"}
          </p>
        </Card>
      )}

      {/* ═══ Footer ═══ */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
        <p className="text-xs sm:text-sm text-neutral-400">
          🤖 Tín hiệu được xử lý bởi <span className="text-cyan-400 font-semibold">UltimateSignalEngine</span> — VSA scan → Seasonality filter → AI Broker output
        </p>
      </div>
    </div>
  );
}
