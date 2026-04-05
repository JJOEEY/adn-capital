"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Zap,
  BarChart2,
  Clock,
  TrendingUp,
  Sun,
  Moon,
  Bell,
  Bot,
  Send,
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

type SubTab = "updates" | "chatbot";

export default function NotificationsPage() {
  const [subTab, setSubTab] = useState<SubTab>("updates");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

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

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const { reply } = await res.json();
      setChatMessages((prev) => [...prev, { role: "bot", text: reply || "Không có phản hồi." }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "bot", text: "Lỗi kết nối. Vui lòng thử lại." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto">
        {/* Sub-tab header */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="flex gap-2 bg-neutral-900/80 rounded-xl p-1 border border-white/[0.06]">
            <button
              onClick={() => setSubTab("updates")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === "updates"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Cập nhật thông tin
            </button>
            <button
              onClick={() => setSubTab("chatbot")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === "chatbot"
                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Tư vấn đầu tư
            </button>
          </div>
        </div>

        {/* Content */}
        {subTab === "updates" ? (
          /* ── Cập nhật thông tin ── */
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
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
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-neutral-600" />
                    <span className="text-xs font-bold text-neutral-500">{dateStr}</span>
                    <span className="text-[10px] text-neutral-700">({items.length} bản tin)</span>
                  </div>
                  {items.map((n, idx) => {
                    const cfg = getConfig(n.type);
                    const Icon = cfg.icon;
                    const time = new Date(n.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`rounded-2xl border bg-neutral-900/80 p-4 ${cfg.bg}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                              <Icon className={`w-4 h-4 ${cfg.color}`} />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <span className="text-[10px] text-neutral-600 font-mono">{time}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">{n.title}</h3>
                        <div className="text-xs text-neutral-400 leading-relaxed whitespace-pre-line">{n.content}</div>
                      </motion.div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        ) : (
          /* ── Tư vấn đầu tư (Chatbot AI) ── */
          <div className="flex-1 flex flex-col">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-1">ADN AI Advisor</h3>
                  <p className="text-xs text-neutral-500 max-w-xs">
                    Hỏi bất kỳ điều gì về thị trường chứng khoán, phân tích kỹ thuật, hoặc chiến
                    lược đầu tư.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {["Nhận định VN-Index hôm nay?", "Phân tích HPG", "Có nên mua FPT?"].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setChatInput(q); }}
                        className="text-[10px] px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-all cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/20 rounded-br-md"
                        : "bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-bl-md"
                    }`}
                  >
                    <div className="whitespace-pre-line">{m.text}</div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-purple-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className="shrink-0 px-4 pb-4">
              <div className="flex gap-2 items-end">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                  placeholder="Hỏi về thị trường, cổ phiếu..."
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
