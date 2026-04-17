"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Zap,
  BarChart3,
  BarChart2,
  Clock,
  TrendingUp,
  Heart,
  Newspaper,
  Sun,
  Bell,
  BellRing,
  BellOff,
  Bot,
  Send,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StockChart } from "@/components/chat/StockChart";
import { formatLocalDeviceDate, formatLocalDeviceTime } from "@/lib/time";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
}

type BrokerBadge = "MUA" | "GIỮ" | "BÁN";
type SubTab = "updates" | "chatbot";
type CardId = "ta" | "fa" | "tamly" | "news";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  ticker?: string;
  isCards?: boolean;
  streamState?: "done";
  widgetMeta?: {
    complete: boolean;
    ticker?: string;
    badge?: BrokerBadge;
  };
}

const GUEST_CHAT_STORAGE_KEY = "adn-notifications-chat-v2";
const fetcher = (url: string) => fetch(url).then((r) => r.json());
const TICKER_PATTERN = /^[A-Z]{2,5}$/;
const TICKER_TOKEN_PATTERN = /\b[A-Z]{2,5}\b/g;
const TICKER_STOP_WORDS = new Set([
  "VA", "VOI", "CHO", "CON", "MA", "CP", "THE", "NAY", "NHU", "MUA", "BAN", "GIU", "HOLD",
  "NEU", "DUOC", "SAO", "ROI", "TOI", "MINH", "LAM", "KHI", "NEN", "XEM", "PHAN",
  "TICH", "NHAN", "DINH", "CO", "PHIEU", "TICKER", "TIN", "TUC", "HOM", "VND",
]);

const CARD_OPTIONS: Array<{
  id: CardId;
  title: string;
  sub: string;
  icon: typeof TrendingUp;
}> = [
  { id: "ta", title: "Phân tích kỹ thuật", sub: "Chart, RSI, MACD, hỗ trợ/kháng cự", icon: TrendingUp },
  { id: "fa", title: "Phân tích cơ bản", sub: "P/E, P/B, ROE, tăng trưởng lợi nhuận", icon: BarChart3 },
  { id: "tamly", title: "Tâm lý & hành vi", sub: "Mua/bán chủ động, khối ngoại, dòng tiền", icon: Heart },
  { id: "news", title: "Tin tức & sự kiện", sub: "Tin nhanh doanh nghiệp, bối cảnh vĩ mô", icon: Newspaper },
];

const typeConfig: Record<
  string,
  { icon: typeof Zap; colorHex: string; bg: string; border: string; label: string }
> = {
  morning_brief: {
    icon: Sun,
    colorHex: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.20)",
    label: "MORNING BRIEF 08:00",
  },
  morning: {
    icon: Sun,
    colorHex: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.20)",
    label: "MORNING BRIEF 08:00",
  },
  signal_10h: {
    icon: Zap,
    colorHex: "#eab308",
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.20)",
    label: "CẬP NHẬT 10:00",
  },
  signal_1030: {
    icon: Zap,
    colorHex: "#eab308",
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.20)",
    label: "CẬP NHẬT 10:30",
  },
  signal_14h: {
    icon: TrendingUp,
    colorHex: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
    label: "CẬP NHẬT 14:00",
  },
  signal_1420: {
    icon: TrendingUp,
    colorHex: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
    label: "CẬP NHẬT 14:20",
  },
  signal_1130: {
    icon: Zap,
    colorHex: "#eab308",
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.20)",
    label: "CẬP NHẬT 11:30",
  },
  signal_1445: {
    icon: TrendingUp,
    colorHex: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
    label: "CẬP NHẬT 14:45",
  },
  stats_10h: {
    icon: Zap,
    colorHex: "#eab308",
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.20)",
    label: "CẬP NHẬT THÔNG TIN 10:00",
  },
  stats_1130: {
    icon: Zap,
    colorHex: "#eab308",
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.20)",
    label: "CẬP NHẬT THÔNG TIN 11:30",
  },
  stats_14h: {
    icon: TrendingUp,
    colorHex: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
    label: "CẬP NHẬT THÔNG TIN 14:00",
  },
  stats_1445: {
    icon: TrendingUp,
    colorHex: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
    label: "CẬP NHẬT THÔNG TIN 14:45",
  },
  intraday_update: {
    icon: TrendingUp,
    colorHex: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
    label: "INTRADAY UPDATE",
  },
  eod_brief: {
    icon: Clock,
    colorHex: "#06b6d4",
    bg: "rgba(6,182,212,0.10)",
    border: "rgba(6,182,212,0.20)",
    label: "BẢN TIN KẾT PHIÊN 15:00",
  },
  close_brief_15h: {
    icon: Clock,
    colorHex: "#06b6d4",
    bg: "rgba(6,182,212,0.10)",
    border: "rgba(6,182,212,0.20)",
    label: "BẢN TIN KẾT PHIÊN 15:00",
  },
  eod_full_19h: {
    icon: Clock,
    colorHex: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.20)",
    label: "BẢN TIN TỔNG HỢP 19:00",
  },
  eod: {
    icon: Clock,
    colorHex: "#06b6d4",
    bg: "rgba(6,182,212,0.10)",
    border: "rgba(6,182,212,0.20)",
    label: "BẢN TIN KẾT PHIÊN 15:00",
  },
  ai_weekly_review: {
    icon: Bot,
    colorHex: "#a855f7",
    bg: "rgba(168,85,247,0.10)",
    border: "rgba(168,85,247,0.20)",
    label: "AI ĐÁNH GIÁ TÂM LÝ",
  },
};

function getConfig(type: string) {
  return (
    typeConfig[type] ?? {
      icon: BarChart2,
      colorHex: "var(--text-muted)",
      bg: "rgba(115,115,115,0.10)",
      border: "rgba(115,115,115,0.20)",
      label: String(type ?? "UPDATE").replace(/_/g, " ").toUpperCase(),
    }
  );
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getIosVersion() {
  if (typeof navigator === "undefined") return null;
  const match = navigator.userAgent.match(/OS (\d+)[._](\d+)/i);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function getPushBlockedReason() {
  if (typeof window === "undefined") return "";
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (!isIOS) return "";

  const version = getIosVersion();
  const supportsWebPush = !!version && (version.major > 16 || (version.major === 16 && version.minor >= 4));
  if (!supportsWebPush) {
    return "Push trên iOS yêu cầu iOS 16.4 trở lên.";
  }
  if (!isStandalonePwa()) {
    return "Với iPhone, hãy bấm Share → Add to Home Screen trước khi bật thông báo.";
  }
  return "";
}

function loadGuestHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-100);
  } catch {
    return [];
  }
}

function saveGuestHistory(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-100)));
}

function mapSignalToBadge(signal?: string | null): BrokerBadge {
  const normalized = (signal ?? "").toUpperCase();
  if (normalized.includes("BUY") || normalized.includes("MUA") || normalized.includes("BULL")) return "MUA";
  if (normalized.includes("SELL") || normalized.includes("BAN") || normalized.includes("BÁN") || normalized.includes("BEAR")) return "BÁN";
  return "GIỮ";
}

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectTicker(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const exact = trimmed.toUpperCase();
  if (TICKER_PATTERN.test(exact) && !TICKER_STOP_WORDS.has(exact)) return exact;

  const upper = trimmed.toUpperCase();
  const normalizedUpper = stripDiacritics(trimmed).toUpperCase();
  const candidates = [
    ...(upper.match(TICKER_TOKEN_PATTERN) ?? []),
    ...(normalizedUpper.match(TICKER_TOKEN_PATTERN) ?? []),
  ];
  const contextRegex = /\b(?:MA|CO PHIEU|CP|TICKER|XEM|PHAN TICH|NHAN DINH)\s*[:\-]?\s*([A-Z]{2,5})\b/g;
  for (const match of normalizedUpper.matchAll(contextRegex)) {
    candidates.push(match[1]);
  }

  const deduped = [...new Set(candidates)];
  return deduped.find((code) => TICKER_PATTERN.test(code) && !TICKER_STOP_WORDS.has(code)) ?? null;
}

async function saveChatHistory(role: "user" | "assistant", message: string) {
  await fetch("/api/chat/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, message }),
  });
}

async function subscribePush(): Promise<boolean> {
  try {
    const blockedReason = getPushBlockedReason();
    if (blockedReason) return false;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

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
  const { status } = useSession();
  const [subTab, setSubTab] = useState<SubTab>("updates");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState<CardId | null>(null);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushBlockedReason, setPushBlockedReason] = useState("");
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR<{ notifications: NotificationItem[] }>(
    "/api/notifications?limit=50&scope=updates",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  const notifications = data?.notifications ?? [];

  useEffect(() => {
    setPushBlockedReason(getPushBlockedReason());
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  useEffect(() => {
    const updateViewportType = () => setIsMobileViewport(window.innerWidth < 1024);
    updateViewportType();
    window.addEventListener("resize", updateViewportType);
    return () => window.removeEventListener("resize", updateViewportType);
  }, []);

  useEffect(() => {
    if (subTab !== "chatbot") return;
    const vv = window.visualViewport;
    const updateViewport = () => {
      const height = Math.round(vv?.height ?? window.innerHeight);
      setViewportHeight(height);
      const keyboardHeight = Math.max(0, window.innerHeight - height - (vv?.offsetTop ?? 0));
      setKeyboardOpen(keyboardHeight > 120);
    };
    updateViewport();
    vv?.addEventListener("resize", updateViewport);
    vv?.addEventListener("scroll", updateViewport);
    return () => {
      vv?.removeEventListener("resize", updateViewport);
      vv?.removeEventListener("scroll", updateViewport);
    };
  }, [subTab]);

  useEffect(() => {
    setChatHydrated(false);
  }, [status]);

  useEffect(() => {
    if (subTab !== "chatbot" || chatHydrated) return;
    let isActive = true;

    const hydrate = async () => {
      if (status === "authenticated") {
        try {
          const res = await fetch("/api/chat/history?limit=80", { cache: "no-store" });
          const payload = (await res.json()) as { messages?: ChatMessage[] };
          if (!isActive) return;
          setChatMessages(Array.isArray(payload.messages) ? payload.messages : []);
        } catch {
          if (isActive) setChatMessages([]);
        } finally {
          if (isActive) setChatHydrated(true);
        }
        return;
      }

      if (status === "unauthenticated") {
        setChatMessages(loadGuestHistory());
        setChatHydrated(true);
      }
    };

    hydrate();
    return () => {
      isActive = false;
    };
  }, [chatHydrated, status, subTab]);

  useEffect(() => {
    if (status === "authenticated") return;
    if (!chatHydrated) return;
    saveGuestHistory(chatMessages);
  }, [chatMessages, chatHydrated, status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [cardLoading, chatMessages, chatLoading, keyboardOpen]);

  const grouped = useMemo(
    () =>
      notifications.reduce<Record<string, NotificationItem[]>>((acc, n) => {
        const dateKey = formatLocalDeviceDate(n.createdAt, {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(n);
        return acc;
      }, {}),
    [notifications]
  );

  const handleTogglePush = async () => {
    const blockedReason = getPushBlockedReason();
    if (blockedReason) {
      setPushBlockedReason(blockedReason);
      return;
    }

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

  const handleCardAction = useCallback(
    async (cardId: CardId, ticker: string) => {
      if (chatLoading || cardLoading) return;

      setCardLoading(cardId);
      const commandMap: Record<CardId, string> = {
        ta: `/ta ${ticker}`,
        fa: `/fa ${ticker}`,
        tamly: `/tamly ${ticker}`,
        news: `/news ${ticker}`,
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: commandMap[cardId] }),
          signal: AbortSignal.timeout(45_000),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (res.status === 429) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: data.message ?? "Nhà đầu tư đã dùng hết lượt tư vấn hôm nay.",
              createdAt: new Date().toISOString(),
              streamState: "done",
            },
          ]);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

        const isTa = cardId === "ta";
        const text = data.message || "Không có dữ liệu phân tích.";
        const badge = mapSignalToBadge(text);

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text,
          createdAt: new Date().toISOString(),
          streamState: "done",
          widgetMeta: isTa
            ? {
                complete: true,
                ticker,
                badge,
              }
            : undefined,
        };

        setChatMessages((prev) => [...prev, assistantMessage]);

        if (status === "authenticated") {
          const persistText = isTa ? `[WIDGET:${ticker}:${badge}] ${text}` : text;
          await saveChatHistory("assistant", persistText);
        }
      } catch {
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Không thể tải dữ liệu, vui lòng thử lại.",
            createdAt: new Date().toISOString(),
            streamState: "done",
          },
        ]);
      } finally {
        setCardLoading(null);
        setTimeout(() => {
          inputRef.current?.focus();
          chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 80);
      }
    },
    [cardLoading, chatLoading, status]
  );

  const handleChatSend = useCallback(async () => {
    const raw = chatInput.trim();
    if (!raw || chatLoading || cardLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: raw,
      createdAt: new Date().toISOString(),
      streamState: "done",
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    const directTicker = detectTicker(raw);
    if (directTicker) {
      const cardsMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Nhà đầu tư muốn phân tích ${directTicker}? Hãy chọn loại phân tích:`,
        ticker: directTicker,
        isCards: true,
        createdAt: new Date().toISOString(),
        streamState: "done",
      };
      setChatMessages((prev) => [...prev, cardsMessage]);

      if (status === "authenticated") {
        await Promise.all([
          saveChatHistory("user", raw),
          saveChatHistory("assistant", cardsMessage.text),
        ]).catch(() => undefined);
      }
      return;
    }

    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: raw,
          guestUsage: status === "authenticated" ? undefined : chatMessages.filter((m) => m.role === "assistant").length,
        }),
      });
      const payload = (await res.json()) as {
        message?: string;
        reply?: string;
        error?: string;
        type?: "widget";
        ticker?: string;
        streamState?: "done";
        widgetMeta?: { complete?: boolean; ticker?: string; badge?: BrokerBadge };
        data?: {
          technical?: { data?: { signal?: string | null } | null; aiInsight?: string };
          fundamental?: { aiInsight?: string };
        };
      };

      if (!res.ok) {
        const botError: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.error || "Hệ thống tạm bận, vui lòng thử lại.",
          createdAt: new Date().toISOString(),
          streamState: "done",
        };
        setChatMessages((prev) => [...prev, botError]);
        return;
      }

      const isWidget = payload.type === "widget" && !!payload.ticker;
      const derivedBadge = mapSignalToBadge(payload.data?.technical?.data?.signal);
      const widgetMeta = isWidget
        ? {
            complete: payload.widgetMeta?.complete === true,
            ticker: payload.widgetMeta?.ticker ?? payload.ticker,
            badge: payload.widgetMeta?.badge ?? derivedBadge,
          }
        : undefined;

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: isWidget
          ? `${payload.data?.technical?.aiInsight ?? payload.data?.fundamental?.aiInsight ?? `Đã phân tích nhanh mã ${payload.ticker}.`}`
          : payload.message || payload.reply || "Hệ thống chưa có phản hồi, Nhà đầu tư vui lòng thử lại.",
        createdAt: new Date().toISOString(),
        streamState: payload.streamState ?? "done",
        widgetMeta,
      };

      setChatMessages((prev) => [...prev, botMessage]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Lỗi kết nối. Vui lòng thử lại.",
          createdAt: new Date().toISOString(),
          streamState: "done",
        },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 80);
    }
  }, [cardLoading, chatInput, chatLoading, chatMessages, status]);

  const chatPanelHeight = viewportHeight ? `calc(${viewportHeight}px - 64px)` : "calc(100dvh - 64px)";

  return (
    <MainLayout disableSwipe={subTab === "chatbot"}>
      <div className="flex flex-col min-h-0" style={{ height: chatPanelHeight }}>
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex gap-1.5 bg-[var(--surface)] rounded-xl p-1 border border-white/[0.06]">
            <button
              onClick={() => setSubTab("updates")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={
                subTab === "updates"
                  ? { background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }
                  : { color: "var(--text-muted)" }
              }
            >
              <Bell className="w-3.5 h-3.5" />
              Cập nhật thông tin
            </button>
            <button
              onClick={() => setSubTab("chatbot")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={
                subTab === "chatbot"
                  ? { background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }
                  : { color: "var(--text-muted)" }
              }
            >
              <Bot className="w-3.5 h-3.5" />
              Tư vấn đầu tư
            </button>
          </div>
        </div>

        {subTab === "updates" ? (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {pushBlockedReason && (
              <div
                className="rounded-xl border p-3 text-xs"
                style={{
                  background: "rgba(245,158,11,0.10)",
                  borderColor: "rgba(245,158,11,0.25)",
                  color: "#f59e0b",
                }}
              >
                {pushBlockedReason}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2 flex-wrap flex-1">
                {[
                  { label: "10:00", color: "#eab308", bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.20)" },
                  { label: "10:30", color: "#eab308", bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.20)" },
                  { label: "11:30", color: "#eab308", bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.20)" },
                  { label: "14:00", color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)" },
                  { label: "14:20", color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)" },
                  { label: "14:45", color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)" },
                ].map((s) => (
                  <span key={s.label} className="text-[11px] font-bold px-2 py-1 rounded-lg border" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
                    {s.label}
                  </span>
                ))}
              </div>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading || !!pushBlockedReason}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${pushLoading ? "opacity-50" : ""}`}
                style={
                  pushEnabled
                    ? { background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }
                }
              >
                {pushEnabled ? (
                  <>
                    <BellRing className="w-3.5 h-3.5" /> Đang bật
                  </>
                ) : (
                  <>
                    <BellOff className="w-3.5 h-3.5" /> Bật thông báo
                  </>
                )}
              </button>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-[var(--surface)] animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
                <Clock className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">Chưa có thông báo nào</p>
                <p className="text-xs text-neutral-600 mt-1">Feed chỉ hiển thị 2 nhóm: scan mã cổ phiếu và scan thị trường theo các mốc 10:00, 10:30, 11:30, 14:00, 14:20, 14:45.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([dateStr, items]) => (
                <div key={dateStr} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-neutral-600" />
                    <span className="text-xs font-bold text-neutral-500">{dateStr}</span>
                    <span className="text-[12px] text-neutral-700">({items.length} bản tin)</span>
                  </div>
                  {items.map((n, idx) => {
                    const cfg = getConfig(n.type);
                    const Icon = cfg.icon;
                    const time = formatLocalDeviceTime(n.createdAt, { hour: "2-digit", minute: "2-digit" });
                    const safeTitle = n.title?.trim() ? n.title : "Bản tin thị trường";
                    const safeContent = n.content?.trim() ? n.content : "Dữ liệu đang cập nhật. Vui lòng kiểm tra lại sau ít phút.";
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="rounded-2xl border bg-[var(--surface)] p-4"
                        style={{ borderColor: cfg.border }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg border" style={{ background: cfg.bg, borderColor: cfg.border }}>
                              <Icon className="w-4 h-4" style={{ color: cfg.colorHex }} />
                            </div>
                            <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: cfg.colorHex }}>
                              {cfg.label}
                            </span>
                          </div>
                          <span className="text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>
                            {time}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                          {safeTitle}
                        </h3>
                        <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-muted)" }}>
                          {safeContent}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3 sm:px-4 sm:pt-3 md:pb-4 space-y-3 overscroll-contain">
              {chatMessages.length === 0 && chatHydrated && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-1">ADN AI Advisor</h3>
                  <p className="text-xs text-neutral-500 max-w-xs mb-4">
                    Nhập trực tiếp mã cổ phiếu (ví dụ: HPG) để mở 4 thẻ phân tích, hoặc dùng lệnh:
                    <br />
                    <span className="text-purple-400 font-mono">/ta Mã</span> · <span className="text-purple-400 font-mono">/fa Mã</span> ·{" "}
                    <span className="text-purple-400 font-mono">/news Mã</span>
                  </p>
                </div>
              )}

              {chatMessages.map((m) => {
                const isUser = m.role === "user";
                const badgeColor =
                  m.widgetMeta?.badge === "MUA" ? "#16a34a" : m.widgetMeta?.badge === "BÁN" ? "#ef4444" : "#f59e0b";

                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mr-2 mt-1">
                        <Bot className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    )}
                    <div className={`max-w-[88%] ${isUser ? "" : "w-full sm:max-w-[88%]"}`}>
                      <div
                        className="rounded-2xl px-4 py-3 text-[15px] leading-relaxed border"
                        style={
                          isUser
                            ? {
                                background: "rgba(16,185,129,0.15)",
                                color: "#d1fae5",
                                borderColor: "rgba(16,185,129,0.20)",
                                borderRadius: "16px 16px 4px 16px",
                              }
                            : {
                                background: "var(--surface)",
                                color: "var(--text-secondary)",
                                borderColor: "var(--border)",
                                borderRadius: "16px 16px 16px 4px",
                              }
                        }
                      >
                        <div className="whitespace-pre-line break-words">{m.text}</div>
                      </div>

                      {!isUser && m.isCards && m.ticker && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {CARD_OPTIONS.map((card) => {
                            const Icon = card.icon;
                            const isLoadingCard = cardLoading === card.id;
                            return (
                              <button
                                key={`${m.id}-${card.id}`}
                                onClick={() => handleCardAction(card.id, m.ticker!)}
                                disabled={chatLoading || cardLoading !== null}
                                className="text-left rounded-xl border px-3 py-2.5 transition-all disabled:opacity-50 cursor-pointer"
                                style={{
                                  background: "var(--surface)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{
                                      background: "rgba(16,185,129,0.12)",
                                      border: "1px solid rgba(16,185,129,0.25)",
                                    }}
                                  >
                                    {isLoadingCard ? (
                                      <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                                    ) : (
                                      <Icon className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                                      {card.title}
                                    </p>
                                    <p className="text-[11px] leading-snug mt-0.5" style={{ color: "var(--text-muted)" }}>
                                      {card.sub}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {!isUser && m.widgetMeta?.complete === true && m.widgetMeta.ticker && (
                        <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
                          <div className="flex items-center justify-between px-2 pt-1 pb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Khu vực AI Nhận định
                            </span>
                            <span
                              className="text-[11px] font-black px-2 py-0.5 rounded-full border"
                              style={{
                                color: badgeColor,
                                borderColor: `${badgeColor}55`,
                                background: `${badgeColor}1A`,
                              }}
                            >
                              AI BROKER: {m.widgetMeta.badge ?? "GIỮ"}
                            </span>
                          </div>
                          <StockChart symbol={m.widgetMeta.ticker} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mr-2 mt-1">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{ background: "#a855f7" }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div
              className="sticky bottom-0 z-10 shrink-0 border-t px-3 py-2"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                paddingBottom: keyboardOpen
                  ? 10
                  : isMobileViewport
                    ? "calc(env(safe-area-inset-bottom, 0px) + 74px)"
                    : 10,
              }}
            >
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80)}
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
                  className="w-full border rounded-full px-4 py-2.5 text-[16px] placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                    fontSize: "16px",
                  }}
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || cardLoading !== null || !chatInput.trim()}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 transition-all cursor-pointer active:scale-95"
                  style={{ background: "#a855f7", color: "#ffffff" }}
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
