"use client";

import { motion } from "framer-motion";
import { Trophy, Target, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { JournalEntry } from "@/types";

interface GamificationCardProps {
  entries: JournalEntry[];
}

const BADGES = [
  {
    id: "first-trade",
    name: "Nhập Môn",
    description: "Ghi nhật ký lệnh đầu tiên",
    icon: "🎯",
    check: (e: JournalEntry[]) => e.length >= 1,
  },
  {
    id: "disciplined",
    name: "Kế Hoạch Rõ",
    description: "3+ lệnh có kế hoạch",
    icon: "✅",
    check: (e: JournalEntry[]) =>
      e.filter((j) => j.psychology === "Có kế hoạch").length >= 3,
  },
  {
    id: "fomo-slayer",
    name: "FOMO Slayer",
    description: "Kháng cự FOMO, 80%+ lệnh có kế hoạch",
    icon: "🛡️",
    check: (e: JournalEntry[]) => {
      if (e.length < 5) return false;
      return e.filter((j) => j.psychology === "Có kế hoạch").length / e.length >= 0.8;
    },
  },
  {
    id: "active-10",
    name: "Kiên Nhẫn",
    description: "Ghi 10+ nhật ký giao dịch",
    icon: "⚔️",
    check: (e: JournalEntry[]) => e.length >= 10,
  },
  {
    id: "active-20",
    name: "Thói Quen Tốt",
    description: "Ghi 20+ nhật ký giao dịch",
    icon: "📖",
    check: (e: JournalEntry[]) => e.length >= 20,
  },
  {
    id: "warrior-50",
    name: "Chiến Binh",
    description: "Ghi 50+ nhật ký giao dịch",
    icon: "🏆",
    check: (e: JournalEntry[]) => e.length >= 50,
  },
];

export function GamificationCard({ entries }: GamificationCardProps) {
  const buyCount = entries.filter((e) => e.action === "BUY").length;
  const sellCount = entries.filter((e) => e.action === "SELL").length;
  const planned = entries.filter((e) => e.psychology === "Có kế hoạch").length;
  const planRatio = entries.length > 0 ? (planned / entries.length) * 100 : 0;

  const earnedIds = new Set(BADGES.filter((b) => b.check(entries)).map((b) => b.id));

  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <Trophy className="w-4 h-4" style={{ color: "#eab308" }} />
        Thống Kê & Huy Hiệu
      </h3>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          {
            icon: <Target className="w-3.5 h-3.5" />,
            label: "Tổng lệnh",
            value: String(entries.length),
            color: "var(--text-secondary)",
            bg: "var(--surface-2)",
          },
          {
            icon: <BarChart2 className="w-3.5 h-3.5" />,
            label: "Có kế hoạch",
            value: `${planRatio.toFixed(0)}%`,
            color: planRatio >= 70 ? "#16a34a" : "#eab308",
            bg: planRatio >= 70 ? "rgba(22,163,74,0.08)" : "rgba(234,179,8,0.08)",
          },
          {
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            label: "Lệnh Mua",
            value: String(buyCount),
            color: "#16a34a",
            bg: "rgba(22,163,74,0.08)",
          },
          {
            icon: <TrendingDown className="w-3.5 h-3.5" />,
            label: "Lệnh Bán",
            value: String(sellCount),
            color: "var(--danger)",
            bg: "rgba(192,57,43,0.08)",
          },
        ].map((s) => (
          <div key={s.label} className="border rounded-xl p-3" style={{ background: s.bg, borderColor: "var(--border)" }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: s.color }}>
              {s.icon}
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{s.label}</span>
            </div>
            <p className="text-lg font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider mb-2.5 flex items-center justify-between" style={{ color: "var(--text-muted)" }}>
          Huy Hiệu
          <span style={{ color: "var(--text-muted)" }}>{earnedIds.size}/{BADGES.length}</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {BADGES.map((badge) => {
            const earned = earnedIds.has(badge.id);
            return (
              <motion.div
                key={badge.id}
                whileHover={{ scale: 1.02 }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
                  earned ? "" : "opacity-35"
                }`}
                style={earned ? { background: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.25)" } : { background: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                <span className="text-lg">{badge.icon}</span>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold truncate" style={{ color: earned ? "#eab308" : "var(--text-muted)" }}>
                    {badge.name}
                  </p>
                  <p className="text-[11px] leading-tight truncate" style={{ color: "var(--text-muted)" }}>
                    {badge.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
