"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Zap,
  BarChart2,
  Clock,
  TrendingUp,
  Sun,
  Bell,
  BellRing,
  BellOff,
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
  signal_10h:   { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "CẬP NHẬT 10:00" },
  signal_1130:  { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "CẬP NHẬT 11:30" },
  signal_14h:   { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "CẬP NHẬT 14:00" },
  signal_1445:  { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "CẬP NHẬT 14:45" },
};

function getConfig(type: string) {
  return typeConfig[type] ?? { icon: BarChart2, color: "text-neutral-400", bg: "bg-neutral-500/10 border-neutral-500/20", label: type };
}

type SubTab = "updates" | "chatbot";

/** Helper: Đăng ký web push subscription */
async function subscribePush(): Promise<boolean> {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn("[Push] VAPID public key chưa cấu hình");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    return true;
  } catch (err) {
    console.error("[Push] Lỗi đăng ký:", err);
    return false;
  }
}

/** Helper: Hủy web push subscription */
async function unsubscribePush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    await fetch("/api/push-subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });

    await sub.unsubscribe();
    return true;
  } catch (err) {
    console.error("[Push] Lỗi hủy:", err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationsPage() {
  const [subTab, setSubTab] = useState<SubTab>("updates");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const { data, isLoading } = useSWR<{ notifications: Notification[] }>(
    "/api/notifications?limit=50",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  const notifications = data?.notifications ?? [];

  // Check push subscription status on mount
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        const ok = await unsubscribePush();
        if (ok) setPushEnabled(false);
      } else {
        const ok = await subscribePush();
        if (ok) setPushEnabled(true);
      }
    } finally {
      setPushLoading(false);
    }
  };

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

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const handleChatSend = useCallback(async () => {
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
      const data = await res.json();
      // API returns { message: "..." } — not { reply }
      const botReply = data.message || data.reply || data.error || "Không có phản hồi từ AI.";
      setChatMessages((prev) => [...prev, { role: "bot", text: botReply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "bot", text: "Lỗi kết nối. Vui lòng thử lại." }]);
    } finally {
      setChatLoading(false);
      // Refocus input after sending on mobile
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatInput, chatLoading]);

  const handleQuickQuestion = (q: string) => {
    setChatInput(q);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <MainLayout disableSwipe={subTab === "chatbot"}>
      <div className="flex flex-col" style={{ height: "calc(100dvh - 80px)" }}>
        {/* Sub-tab header */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex gap-1.5 bg-neutral-900/80 rounded-xl p-1 border border-white/[0.06]">
            <button
              onClick={() => setSubTab("updates")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            {/* Push toggle + filter tags */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2 flex-wrap flex-1">
                {[
                  { label: "10:00", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
                  { label: "11:30", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
                  { label: "14:00", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                  { label: "14:45", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                ].map((s) => (
                  <span key={s.label} className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${s.color}`}>
                    {s.label}
                  </span>
                ))}
              </div>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  pushEnabled
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                    : "bg-neutral-800/50 text-neutral-400 border-neutral-700 hover:text-white hover:border-emerald-500/30"
                } ${pushLoading ? "opacity-50" : ""}`}
              >
                {pushEnabled ? (
                  <><BellRing className="w-3.5 h-3.5" /> Đang bật</>
                ) : (
                  <><BellOff className="w-3.5 h-3.5" /> Bật thông báo</>
                )}
              </button>
            </div>
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
                <p className="text-xs text-neutral-600 mt-1">Bản tin sẽ tự động cập nhật vào 10h, 11h30, 14h, 14h45</p>
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
                            <div className={`p-1.5 rounded-lg ${cfg.bg}`}><Icon className={`w-4 h-4 ${cfg.color}`} /></div>
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
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat messages - scrollable area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-1">ADN AI Advisor</h3>
                  <p className="text-xs text-neutral-500 max-w-xs mb-4">
                    Hỏi bất kỳ điều gì về thị trường chứng khoán, hoặc dùng lệnh:<br />
                    <span className="text-purple-400 font-mono">/ta MÃ</span> · <span className="text-purple-400 font-mono">/fa MÃ</span> · <span className="text-purple-400 font-mono">/news MÃ</span>
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Nhận định VN-Index?", "/ta FPT", "/fa HPG", "Có nên mua VNM?"].map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuickQuestion(q)}
                        className="text-[11px] px-3 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:border-purple-500/30 hover:bg-purple-500/5 transition-all cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "bot" && (
                    <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mr-2 mt-1">
                      <Bot className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/20 rounded-br-sm"
                        : "bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-bl-sm"
                    }`}
                  >
                    <div className="whitespace-pre-line break-words">{m.text}</div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mr-2">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-purple-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input - fixed at bottom, above tab bar */}
            <div className="shrink-0 px-3 py-2 bg-[#0a0a0a] border-t border-white/[0.06]">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder="Hỏi về thị trường, cổ phiếu..."
                  autoComplete="off"
                  autoCorrect="off"
                  enterKeyHint="send"
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2.5 text-[16px] text-white placeholder:text-neutral-600 focus:outline-none focus:border-purple-500/40 transition-colors"
                  style={{ fontSize: "16px" }}
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center disabled:opacity-30 disabled:bg-neutral-800 transition-all cursor-pointer active:scale-95"
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
