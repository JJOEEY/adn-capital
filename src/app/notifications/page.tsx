"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Zap,
  BarChart2,
  Clock,
  TrendingUp,
  Sun,
  Moon,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* Icon + color config per notification type */
const typeConfig: Record<string, { icon: typeof Zap; color: string; bg: string; label: string }> = {
  signal_10h:   { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "TÍN HIỆU 10:00" },
  signal_1130:  { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "TÍN HIỆU 11:30" },
  signal_14h:   { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "TÍN HIỆU 14:00" },
  signal_1445:  { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "TÍN HIỆU 14:45" },
  market_17h:   { icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "BÁO CÁO THỊ TRƯỜNG 17:00" },
  eod_19h:      { icon: Moon, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "BẢN TIN EOD 19:00" },
};

function getConfig(type: string) {
  return typeConfig[type] ?? { icon: BarChart2, color: "text-neutral-400", bg: "bg-neutral-500/10 border-neutral-500/20", label: type };
}

export default function NotificationsPage() {
  const { data, isLoading } = useSWR<{ notifications: Notification[] }>(
    "/api/notifications?limit=50",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  const notifications = data?.notifications ?? [];

  // Group by date
  const grouped = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const dateKey = new Date(n.createdAt).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(n);
    return acc;
  }, {});

  return (
    <MainLayout>
      <div className="p-4 pb-24 space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Tin nhắn</h1>
            <p className="text-xs text-neutral-500">Bản tin & tín hiệu tự động hằng ngày</p>
          </div>
        </div>

        {/* Schedule legend */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "10:00", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
            { label: "11:30", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
            { label: "14:00", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
            { label: "14:45", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
            { label: "17:00", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
            { label: "19:00", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
          ].map((s) => (
            <span key={s.label} className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${s.color}`}>
              {s.label}
            </span>
          ))}
        </div>

        {/* Notifications */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-neutral-900 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-12 text-center">
            <Clock className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">Chưa có thông báo nào</p>
            <p className="text-xs text-neutral-600 mt-1">Bản tin sẽ tự động cập nhật vào 10h, 11h30, 14h, 14h45, 17h, 19h</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateStr, items]) => (
            <div key={dateStr} className="space-y-3">
              {/* Date header */}
              <div className="flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-neutral-600" />
                <span className="text-xs font-bold text-neutral-500">{dateStr}</span>
                <span className="text-[10px] text-neutral-700">({items.length} bản tin)</span>
              </div>

              {/* Cards */}
              {items.map((n, idx) => {
                const cfg = getConfig(n.type);
                const Icon = cfg.icon;
                const time = new Date(n.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-2xl border bg-neutral-900/80 p-4 ${cfg.bg}`}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-600 font-mono">{time}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-white mb-2">{n.title}</h3>

                    {/* Content - Render as pre-formatted text for signal-style messages */}
                    <div className="text-xs text-neutral-400 leading-relaxed whitespace-pre-line">
                      {n.content}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </MainLayout>
  );
}
