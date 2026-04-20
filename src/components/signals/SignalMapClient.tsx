"use client";

import { useEffect, useState } from "react";
import { Zap, RefreshCw, Crosshair, Briefcase, CheckCircle, Crown, Lock, Bot } from "lucide-react";
import { SignalCard } from "@/components/signals/SignalCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Signal } from "@/types";
import Link from "next/link";
import { isWithinVnTradingSession } from "@/lib/time";
import { useTopic } from "@/hooks/useTopic";

type Tab = "RADAR" | "ACTIVE" | "CLOSED";
type TierFilter = "all" | "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "TAM_NGAM";

const TABS: { value: Tab; label: string; icon: typeof Crosshair }[] = [
  { value: "RADAR",  label: "Tầm ngắm",     icon: Crosshair  },
  { value: "ACTIVE", label: "Đang nắm giữ", icon: Briefcase  },
  { value: "CLOSED", label: "Đã đóng",      icon: CheckCircle },
];

const TIER_FILTERS: { value: TierFilter; label: string }[] = [
  { value: "all",      label: "Tất cả"     },
  { value: "LEADER",   label: "👑 Leader"  },
  { value: "TRUNG_HAN",label: "🛡️ Trung hạn"},
  { value: "NGAN_HAN", label: "⚡ Ngắn hạn" },
  { value: "TAM_NGAM", label: "🎯 Tiếp cận" },
];

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

export function SignalMapClient({
  isPremium = false,
  showExecutionActions = false,
}: {
  isPremium?: boolean;
  showExecutionActions?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("RADAR");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [isScanning, setIsScanning] = useState(false);
  const [isTradingSession, setIsTradingSession] = useState(false);

  useEffect(() => {
    const updateTradingSession = () => setIsTradingSession(isWithinVnTradingSession());
    updateTradingSession();
    const timer = window.setInterval(updateTradingSession, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshInterval =
    tab === "ACTIVE"
      ? isTradingSession
        ? 30_000
        : 15 * 60_000
      : isTradingSession
        ? 5 * 60_000
        : 15 * 60_000;

  const signalMapTopic = useTopic<{ signals: Signal[] }>("signal:map:latest", {
    refreshInterval,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const allSignals = signalMapTopic.data?.signals ?? [];
  const tabSignals = allSignals.filter((s) => {
    const status = s.status ?? "RADAR";
    if (tab === "ACTIVE") return status === "ACTIVE" || status === "HOLD_TO_DIE";
    return status === tab;
  });
  const filtered = tierFilter === "all"
    ? tabSignals
    : tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === tierFilter);

  const stats = {
    radar:  allSignals.filter((s) => (s.status ?? "RADAR") === "RADAR").length,
    active: allSignals.filter((s) => s.status === "ACTIVE" || s.status === "HOLD_TO_DIE").length,
    closed: allSignals.filter((s) => s.status === "CLOSED").length,
    totalPnl: allSignals
      .filter((s) => s.status === "CLOSED" && s.pnl != null)
      .reduce((sum, s) => sum + (s.pnl ?? 0), 0),
    winCount:  allSignals.filter((s) => s.status === "CLOSED" && (s.pnl ?? 0) > 0).length,
    loseCount: allSignals.filter((s) => s.status === "CLOSED" && (s.pnl ?? 0) <= 0).length,
  };

  const tierCounts = {
    LEADER:   tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === "LEADER").length,
    TRUNG_HAN:tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === "TRUNG_HAN").length,
    NGAN_HAN: tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === "NGAN_HAN").length,
    TAM_NGAM: tabSignals.filter((s) => s.tier === "TAM_NGAM").length,
  };

  const tabCount = (t: Tab) => t === "RADAR" ? stats.radar : t === "ACTIVE" ? stats.active : stats.closed;

  const pnlColor = stats.totalPnl >= 0 ? "#16a34a" : "var(--danger)";
  const pnlBg    = stats.totalPnl >= 0 ? "rgba(22,163,74,0.05)" : "rgba(192,57,43,0.05)";
  const pnlBorder= stats.totalPnl >= 0 ? "rgba(22,163,74,0.20)" : "rgba(192,57,43,0.20)";
  const isRefreshing = signalMapTopic.isValidating || isScanning;

  async function handleRefresh() {
    setIsScanning(true);
    try {
      const res = await fetch("/api/scan-now", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
    } catch (error) {
      console.error("[SignalMap] Refresh scan failed:", error);
    } finally {
      await signalMapTopic.refresh(true);
      setIsScanning(false);
    }
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="p-2 rounded-xl flex-shrink-0"
            style={{
              background: "var(--primary-light)",
              border: "1px solid var(--border)",
            }}
          >
            <Bot className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              ADN AI Broker
            </h1>
            <p className="text-xs sm:text-sm truncate" style={{ color: "var(--text-secondary)" }}>
              Broker System Powered by ADN Capital
            </p>
            <div className="mt-1">
              <FreshnessBadge freshness={signalMapTopic.freshness} />
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} loading={isRefreshing}>
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* ═══ Stats Overview ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Tầm ngắm",   val: stats.radar,   color: "var(--primary)" },
          { label: "Đang giữ",   val: stats.active,  color: "#16a34a"         },
          { label: "Đã đóng",    val: stats.closed,  color: "var(--text-primary)" },
        ].map((item) => (
          <div
            key={item.label}
            className="glow-card rounded-[14px] border transition-all duration-200 p-3 text-center"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <p className="text-2xl font-black" style={{ color: item.color }}>{item.val}</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {item.label}
            </p>
          </div>
        ))}
        <div
          className="glow-card rounded-[14px] border transition-all duration-200 p-3 text-center"
          style={{ background: pnlBg, border: `1px solid ${pnlBorder}` }}
        >
          <p className="text-2xl font-black" style={{ color: pnlColor }}>
            {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(1)}%
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
            PnL tổng ({stats.winCount}W / {stats.loseCount}L)
          </p>
        </div>
      </div>

      {/* ═══ Tab bar ═══ */}
      <div className="flex gap-2">
        {TABS.map(({ value, label, icon: Icon }) => {
          const isActive = tab === value;
          const isLocked = value === "CLOSED" && !isPremium;
          return (
            <button
              key={value}
              onClick={() => { if (!isLocked) setTab(value); }}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all"
              style={
                isLocked
                  ? { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", opacity: 0.6, cursor: "not-allowed" }
                  : isActive
                    ? { border: "1px solid var(--border-strong)", background: "var(--primary-light)", color: "var(--primary)" }
                    : { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }
              }
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Icon className="w-3.5 h-3.5" />}
              {label}
              <span className="text-[12px] opacity-60">({tabCount(value)})</span>
              {isLocked && (
                <span
                  className="text-[12px] font-bold px-1 rounded"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  VIP
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ Tier filter ═══ */}
      <div className="flex gap-2 flex-wrap">
        {TIER_FILTERS.map((item) => {
          const isActive = tierFilter === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setTierFilter(item.value)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={
                isActive
                  ? { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border-strong)" }
                  : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
              }
            >
              {item.label}
              {item.value !== "all" && (
                <span className="ml-1.5 opacity-60">
                  ({tierCounts[item.value as keyof typeof tierCounts] ?? 0})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ Signal grid ═══ */}
      {signalMapTopic.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : tab === "CLOSED" && !isPremium ? (
        <Card className="p-12 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.20)" }}
          >
            <Crown className="w-8 h-8" style={{ color: "#f59e0b" }} />
          </div>
          <h3 className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>
            Dành riêng cho VIP
          </h3>
          <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
            Nâng cấp lên gói VIP để xem toàn bộ lịch sử tín hiệu đã đóng và hiệu suất PnL.
          </p>
          <Link href="/pricing">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
              style={{ background: "#f59e0b", color: "#1C2B22" }}
            >
              <Crown className="w-4 h-4" />
              Nâng cấp VIP
            </button>
          </Link>
        </Card>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((signal, index) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              index={index}
              showBuyAction={showExecutionActions && tab === "RADAR"}
              buyHref={`/dashboard/dnse-trading?ticker=${encodeURIComponent(signal.ticker)}`}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {tab === "RADAR"  && "Chưa có tín hiệu nào trong tầm ngắm"}
            {tab === "ACTIVE" && "Chưa có vị thế đang nắm giữ"}
            {tab === "CLOSED" && "Chưa có vị thế nào đã đóng"}
          </p>
        </Card>
      )}

      {/* ═══ Footer ═══ */}
      <div
        className="rounded-xl p-4 text-center"
        style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
          🤖 Tất cả các khuyến nghị đều mang tính chất tham khảo, khách hàng vui lòng tự chịu trách nhiệm trong quyết định đầu tư của mình.
        </p>
      </div>
    </div>
  );
}
