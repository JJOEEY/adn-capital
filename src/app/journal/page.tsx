"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  BookOpen, Lock, TrendingUp, TrendingDown, Target,
  Brain, DollarSign,
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
            <div key={i} className="h-64 rounded-2xl bg-neutral-900 animate-pulse" />
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
            <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-neutral-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              Đăng nhập để dùng nhật ký
            </h2>
            <p className="text-sm text-neutral-500 mb-5">
              Nhật ký giao dịch lưu trữ cá nhân, cần đăng nhập để AI học hành vi của đại ca.
            </p>
            <button
              onClick={() => router.push("/auth")}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all"
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
            <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-neutral-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              Tính năng VIP
            </h2>
            <p className="text-sm text-neutral-500 mb-5">
              Nâng cấp VIP để sử dụng Nhật Ký Giao Dịch và phân tích tâm lý AI.
            </p>
            <button
              onClick={() => router.push("/pricing")}
              className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-all"
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
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Nhật Ký Giao Dịch</h1>
            <p className="text-sm text-neutral-500">
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
                color: "text-neutral-300",
                bg: "bg-neutral-800/80",
              },
              {
                icon: <TrendingUp className="w-4 h-4" />,
                label: "Mua",
                value: String(buyCount),
                color: "text-emerald-400",
                bg: "bg-emerald-500/8 border-emerald-500/15",
              },
              {
                icon: <TrendingDown className="w-4 h-4" />,
                label: "Bán",
                value: String(sellCount),
                color: "text-red-400",
                bg: "bg-red-500/8 border-red-500/15",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`${s.bg} border border-neutral-800 rounded-xl p-3 flex flex-col`}
              >
                <div className={`${s.color} flex items-center gap-1.5 mb-1`}>
                  {s.icon}
                  <span className="text-[12px] text-neutral-500 font-medium">{s.label}</span>
                </div>
                <p className={`text-xl font-black ${s.color} font-mono`}>{s.value}</p>
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
            <div className="flex gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-sm py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-neutral-800 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className={`text-[12px] rounded-md px-1.5 py-0.5 font-bold ${
                        activeTab === tab.id
                          ? "bg-neutral-700 text-neutral-300"
                          : "bg-neutral-800/80 text-neutral-600"
                      }`}
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
                      <div key={i} className="h-28 rounded-2xl bg-neutral-900 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <JournalList
                    entries={entries}
                    onDeleted={handleDeleted}
                    onDateFilter={handleDateFilter}
                  />
                ))}

              {activeTab === "pnl" && <PnLSummary />}

              {activeTab === "analysis" && <PsychologyAnalysis />}
            </motion.div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
