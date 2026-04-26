"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  BookOpen, Lock, TrendingUp, TrendingDown, Target,
  Brain, DollarSign, Sparkles,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useSubscription } from "@/hooks/useSubscription";
import { MainLayout } from "@/components/layout/MainLayout";
import { JournalForm } from "@/components/journal/JournalForm";
import { JournalList } from "@/components/journal/JournalList";
import { PsychologyAnalysis } from "@/components/journal/PsychologyAnalysis";
import { GamificationCard } from "@/components/journal/GamificationCard";
import { PnLSummary } from "@/components/journal/PnLSummary";
import { Card } from "@/components/ui/Card";
import type { JournalEntry } from "@/types";

interface ClosedTrade {
  ticker: string;
  pnl: number;
  buyPrice: number;
  sellPrice: number;
  qty: number;
  date: string;
}

interface PnlData {
  closedTrades: ClosedTrade[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function JournalPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useCurrentDbUser();
  const { isVip } = useSubscription();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"form" | "list" | "analysis" | "pnl">("list");
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchEntries = useCallback(async (from?: string, to?: string) => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/journal?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEntries(dateFilter.from, dateFilter.to);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchEntries, dateFilter]);

  const handleSaved = () => {
    fetchEntries(dateFilter.from, dateFilter.to);
    setActiveTab("list");
  };

  const handleDeleted = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleDateFilter = (from: string, to: string) => {
    setDateFilter({ from, to });
  };

  const buyCount = entries.filter((e) => e.action === "BUY").length;
  const sellCount = entries.filter((e) => e.action === "SELL").length;

  if (!mounted || authLoading) {
    return (
      <MainLayout>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Card className="p-10 text-center max-w-sm">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <Lock className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Đăng nhập để dùng nhật ký
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              Nhật ký giao dịch lưu trữ cá nhân, cần đăng nhập để AI học hành vi của Nhà đầu tư.
            </p>
            <button
              onClick={() => router.push("/auth")}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "var(--primary)", color: "#EBE2CF" }}
            >
              Đăng nhập
            </button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!isVip) {
    return (
      <MainLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Card className="p-10 text-center max-w-sm">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <Lock className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Tính năng VIP
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              Nâng cấp VIP để sử dụng Nhật Ký Giao Dịch và phân tích tâm lý AI.
            </p>
            <button
              onClick={() => router.push("/pricing")}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border)" }}
            >
              Nâng Cấp VIP
            </button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const tabs = [
    { id: "list" as const, label: "Lịch sử", count: entries.length },
    { id: "form" as const, label: "Ghi mới", count: null },
    {
      id: "pnl" as const,
      label: "PnL Tổng",
      count: null,
      icon: <DollarSign className="w-3 h-3" />,
    },
    {
      id: "analysis" as const,
      label: "AI Phân tích",
      count: null,
      icon: <Brain className="w-3 h-3" />,
    },
  ];

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ background: "var(--primary-light)", border: "1px solid var(--border)" }}
          >
            <BookOpen className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>Nhật Ký Giao Dịch</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              AI học hành vi · Phân tích tâm lý · Kỷ luật T+2.5
            </p>
          </div>
        </div>

        {/* Quick Stats Bar */}
        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              {
                icon: <Target className="w-4 h-4" />,
                label: "Tổng lệnh",
                value: String(entries.length),
                color: "var(--text-secondary)",
                bg: "var(--surface-2)",
              },
              {
                icon: <TrendingUp className="w-4 h-4" />,
                label: "Mua",
                value: String(buyCount),
                color: "#16a34a",
                bg: "rgba(22,163,74,0.08)",
              },
              {
                icon: <TrendingDown className="w-4 h-4" />,
                label: "Bán",
                value: String(sellCount),
                color: "var(--danger)",
                bg: "rgba(192,57,43,0.08)",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="border border-[var(--border)] rounded-xl p-3 flex flex-col"
                style={{ background: s.bg }}
              >
                <div className="flex items-center gap-1.5 mb-1" style={{ color: s.color }}>
                  {s.icon}
                  <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                </div>
                <p className="text-xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </motion.div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="xl:col-span-1 space-y-5">
            <GamificationCard entries={entries} />
          </div>

          {/* Right column */}
          <div className="xl:col-span-2 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-xl overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-sm py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "shadow-sm"
                      : ""
                  }`}
                  style={
                    activeTab === tab.id
                      ? { background: "var(--bg-hover)", color: "var(--text-primary)" }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className="text-[12px] rounded-md px-1.5 py-0.5 font-bold"
                      style={
                        activeTab === tab.id
                          ? { background: "var(--surface-2)", color: "var(--text-secondary)" }
                          : { background: "var(--bg-hover)", color: "var(--text-muted)" }
                      }
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "form" && <JournalForm onSaved={handleSaved} />}

              {activeTab === "list" &&
                (loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-28 rounded-2xl bg-[var(--surface)] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <JournalList
                    entries={entries}
                    onDeleted={handleDeleted}
                    onDateFilter={handleDateFilter}
                  />
                ))}

              {activeTab === "pnl" && (
                <>
                  <PnLSummary />
                  <JournalAiReviewCards />
                </>
              )}

              {activeTab === "analysis" && <PsychologyAnalysis />}
            </motion.div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function scoreTrade(pnl: number) {
  if (pnl >= 8) return { score: 9, verdict: "Ky luat tot", color: "#16a34a" };
  if (pnl >= 3) return { score: 8, verdict: "Xu ly on", color: "#22c55e" };
  if (pnl >= 0) return { score: 7, verdict: "Can toi uu diem thoat", color: "#f59e0b" };
  if (pnl >= -3) return { score: 5, verdict: "Can cat lo som hon", color: "#f97316" };
  return { score: 3, verdict: "Vi pham quan tri rui ro", color: "#ef4444" };
}

function JournalAiReviewCards() {
  const { data, isLoading } = useSWR<PnlData>("/api/journal/pnl", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const trades = (data?.closedTrades ?? []).slice(0, 6);

  return (
    <div className="mt-4 rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: "#10b981" }} />
        <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
          AIDEN đánh giá lệnh đã đóng
        </h3>
      </div>
      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Chua co lenh da dong de AI cham diem.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {trades.map((trade, index) => {
            const percent = trade.buyPrice > 0 ? ((trade.sellPrice - trade.buyPrice) / trade.buyPrice) * 100 : 0;
            const review = scoreTrade(percent);
            return (
              <article
                key={`${trade.ticker}-${trade.date}-${index}`}
                className="rounded-xl border p-3"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                    {trade.ticker}
                  </p>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-black"
                    style={{ color: review.color, background: `${review.color}1A` }}
                  >
                    AI {review.score}/10
                  </span>
                </div>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                  {review.verdict}
                </p>
                <p className="text-xs" style={{ color: percent >= 0 ? "#16a34a" : "#ef4444" }}>
                  PnL {percent >= 0 ? "+" : ""}
                  {percent.toFixed(2)}%
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
