"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bot, ChartCandlestick, Clock3, RefreshCw, Send, Sparkles } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StockChart } from "@/components/chat/StockChart";
import { useTopic } from "@/hooks/useTopic";

type TabId =
  | "overview"
  | "ta"
  | "fa"
  | "sentiment"
  | "news"
  | "seasonality"
  | "signal"
  | "portfolio";

type JsonRecord = Record<string, unknown>;

type TickerNewsItem = {
  title?: string;
  summary?: string;
  source?: string;
  time?: string;
  published_at?: string;
  url?: string;
};

type WorkbenchPayload = {
  ticker: string;
  market: {
    vnindex: { value?: number; change?: number; changePercent?: number } | null;
    vn30: { value?: number; change?: number; changePercent?: number } | null;
    liquidity?: { total?: number } | null;
    breadth?: { up?: number; down?: number; unchanged?: number } | null;
    investorTrading?: unknown;
  };
  ta?: {
    currentPrice?: number;
    changePct?: number;
    rsi14?: number;
    ema10?: number;
    ema20?: number;
    ema30?: number;
    ema50?: number;
    avgVolume20?: number;
    source?: string;
  } | null;
  fa?: {
    pe?: number | null;
    pb?: number | null;
    eps?: number | null;
    roe?: number | null;
    roa?: number | null;
    revenueGrowthYoY?: number | null;
    profitGrowthYoY?: number | null;
    source?: string;
  } | null;
  seasonality?: {
    winRate?: number | null;
    sharpeRatio?: number | null;
    rrRatio?: number | null;
  } | null;
  investor?: {
    summary?: string;
    data?: unknown[];
  } | null;
  news?: TickerNewsItem[];
  signal?: SignalData | null;
  summary?: {
    hasTA?: boolean;
    hasFA?: boolean;
    hasInvestorFlow?: boolean;
    hasSignal?: boolean;
    hasNews?: boolean;
  };
};

type PortfolioHoldingTopicData = {
  ticker: string;
  connected: boolean;
  holding: {
    ticker: string;
    entryPrice: number | null;
    currentPrice: number | null;
    pnlPercent: number | null;
    navAllocation: number | null;
    status?: string | null;
    tier?: string | null;
    type?: string | null;
  } | null;
};

type TickerResolution = {
  input: string;
  ticker: string;
  valid: boolean;
  source: string;
  reason?: string;
  checkedAt: string;
};

type SignalData = {
  status?: string;
  type?: string;
  entryPrice?: number | null;
  currentPrice?: number | null;
  currentPnl?: number | null;
  target?: number | null;
  stoploss?: number | null;
  aiReasoning?: string | null;
  winRate?: number | null;
  rrRatio?: number | null;
  sharpeRatio?: number | null;
};

type ChatMessage = {
  role: "user" | "bot";
  text: string;
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type RecentResearchItem = {
  ticker: string;
  lastAskedAt: string;
  lastQuestion: string | null;
  askCount: number;
  currentPrice: number | null;
  changePct: number | null;
  source: string | null;
};

type RecentResearchPayload = {
  count: number;
  items: RecentResearchItem[];
  generatedAt: string;
  source: string;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "ta", label: "TA" },
  { id: "fa", label: "FA" },
  { id: "sentiment", label: "Tâm lý" },
  { id: "news", label: "Tin tức" },
  { id: "seasonality", label: "Mùa vụ" },
  { id: "signal", label: "Tín hiệu" },
  { id: "portfolio", label: "Danh mục" },
];

function fmtValue(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString("vi-VN")}${suffix}`;
}

function fmtPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function readNumber(record: unknown, keys: string[]) {
  if (!record || typeof record !== "object") return null;
  const source = record as JsonRecord;
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function readUnixTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 10_000_000_000) return Math.floor(value / 1000);
    return Math.floor(value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const dateOnly = value.trim().split(" ")[0];
  const timestamp = Date.parse(dateOnly.includes("T") ? dateOnly : `${dateOnly}T00:00:00Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function normalizeHistoricalCandles(payload: unknown): Candle[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as JsonRecord;
  const rows = Array.isArray(record.candles)
    ? record.candles
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.items)
        ? record.items
        : [];

  return rows
    .map((row) => {
      const time = readUnixTime(readNumber(row, ["time", "timestamp"]) ?? (row as JsonRecord)?.date ?? (row as JsonRecord)?.timestamp);
      const open = readNumber(row, ["open", "o"]);
      const high = readNumber(row, ["high", "h"]);
      const low = readNumber(row, ["low", "l"]);
      const close = readNumber(row, ["close", "c"]);
      const volume = readNumber(row, ["volume", "v"]) ?? 0;
      if (time == null || open == null || high == null || low == null || close == null) return null;
      return { time, open, high, low, close, volume };
    })
    .filter((item): item is Candle => item !== null)
    .sort((a, b) => a.time - b.time)
    .filter((item, index, all) => index === 0 || item.time !== all[index - 1].time);
}

function readRealtimePrice(payload: unknown) {
  const direct = readNumber(payload, ["currentPrice", "current", "price", "close"]);
  if (direct != null) return direct;
  const data = payload && typeof payload === "object" ? (payload as JsonRecord).data : null;
  const rows = Array.isArray(data) ? data : [];
  const last = rows.at(-1);
  return readNumber(last, ["close", "price", "current"]);
}

function readRealtimeChangePct(payload: unknown) {
  const direct = readNumber(payload, ["changePct", "change_pct", "changePercent"]);
  if (direct != null) return direct;
  const data = payload && typeof payload === "object" ? (payload as JsonRecord).data : null;
  const rows = Array.isArray(data) ? data : [];
  const first = readNumber(rows[0], ["close", "price"]);
  const last = readNumber(rows.at(-1), ["close", "price"]);
  if (first == null || last == null || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre
      className="max-h-[340px] overflow-auto rounded-xl border p-3 text-xs"
      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FreshnessBadge({ label, freshness }: { label: string; freshness: string | null }) {
  if (!freshness) return null;
  const state = freshness.toLowerCase();
  const isFresh = state === "fresh";
  const isStale = state === "stale";
  const text = isFresh ? "Mới" : isStale ? "Cache" : state.toUpperCase();
  const style = isFresh
    ? { color: "#16a34a", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.10)" }
    : isStale
      ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)" }
      : { color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.10)" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={style}>
      <span>{label}</span>
      <span>· {text}</span>
    </span>
  );
}

function buildActionSummary(signal: SignalData | null, hasHolding: boolean) {
  if (!signal) {
    return {
      title: "Chưa có tín hiệu active",
      tone: "neutral" as const,
      text: "Hệ thống chưa có tín hiệu mới cho mã này. Nhà đầu tư tiếp tục theo dõi trong danh sách quan tâm.",
    };
  }

  const status = (signal.status ?? "").toUpperCase();
  const pnl = signal.currentPnl ?? 0;
  const stoploss = signal.stoploss ?? null;
  const currentPrice = signal.currentPrice ?? null;
  const nearStoploss =
    stoploss != null && currentPrice != null && currentPrice > 0 && (currentPrice - stoploss) / currentPrice <= 0.015;

  if (status === "ACTIVE" || status === "HOLD_TO_DIE") {
    if (nearStoploss) {
      return {
        title: "Cảnh báo rủi ro",
        tone: "danger" as const,
        text: "Giá hiện tại đang sát điểm cắt lỗ. Ưu tiên quản trị rủi ro, không bình quân khi chưa có xác nhận mới.",
      };
    }
    if (pnl >= 10) {
      return {
        title: "Bảo vệ lợi nhuận",
        tone: "success" as const,
        text: "Vị thế đang có lãi tốt. Có thể nâng trailing stop để khóa lợi nhuận và giảm rủi ro đảo chiều.",
      };
    }
    return {
      title: hasHolding ? "Giữ kỷ luật nắm giữ" : "Ứng viên đang active",
      tone: "warning" as const,
      text: hasHolding
        ? "Vị thế đang active. Theo dõi target/cắt lỗ và giữ kỷ luật quản trị NAV."
        : "Tín hiệu active nhưng danh mục chưa có vị thế đồng bộ. Cần kiểm tra lại dữ liệu broker.",
    };
  }

  if (status === "RADAR") {
    return {
      title: "Thiết lập theo dõi",
      tone: "neutral" as const,
      text: "Mã đang ở trạng thái theo dõi. Chờ xác nhận điều kiện kích hoạt trước khi vào lệnh.",
    };
  }

  return {
    title: "Cập nhật vòng đời tín hiệu",
    tone: "neutral" as const,
    text: "Tín hiệu đã chuyển trạng thái. Kiểm tra tab Tín hiệu để xem chi tiết.",
  };
}

function ActionSummaryCard({ summary }: { summary: ReturnType<typeof buildActionSummary> }) {
  const style =
    summary.tone === "success"
      ? { borderColor: "rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.08)", title: "#16a34a" }
      : summary.tone === "danger"
        ? { borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", title: "#ef4444" }
        : summary.tone === "warning"
          ? { borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)", title: "#f59e0b" }
          : { borderColor: "var(--border)", background: "var(--surface)", title: "var(--text-primary)" };

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: style.borderColor, background: style.background }}>
      <p className="text-xs font-black uppercase tracking-wider" style={{ color: style.title }}>
        Gợi ý theo dõi từ ADN Stock
      </p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {summary.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {summary.text}
      </p>
    </div>
  );
}

function WorkbenchTabs({
  tab,
  setTab,
}: {
  tab: TabId;
  setTab: (tab: TabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((item) => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
          style={
            tab === item.id
              ? { borderColor: "var(--border-strong)", background: "var(--primary-light)", color: "var(--primary)" }
              : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function RecentResearchPanel({
  activeTicker,
  payload,
  isLoading,
}: {
  activeTicker: string;
  payload: RecentResearchPayload | null;
  isLoading: boolean;
}) {
  const items = payload?.items ?? [];
  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Mã khách hàng hỏi gần đây
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Dữ liệu lấy từ DataHub, chỉ làm mới giá realtime.
          </p>
        </div>
        <span className="rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          DataHub
        </span>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Chưa có mã nào trong lịch sử hỏi gần đây.
        </p>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {items.map((item) => {
            const active = item.ticker === activeTicker;
            return (
              <Link
                key={item.ticker}
                href={`/stock/${item.ticker}`}
                className="rounded-xl border p-3 transition-colors"
                style={{
                  borderColor: active ? "var(--border-strong)" : "var(--border)",
                  background: active ? "var(--primary-light)" : "var(--surface-2)",
                  color: "var(--text-primary)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-black">{item.ticker}</span>
                  <span className="text-xs font-bold" style={{ color: item.changePct && item.changePct > 0 ? "#16a34a" : item.changePct && item.changePct < 0 ? "#ef4444" : "var(--text-muted)" }}>
                    {fmtValue(item.currentPrice)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDateTime(item.lastAskedAt)}
                  </span>
                  <span>{item.askCount} lượt hỏi</span>
                </div>
                {item.lastQuestion ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {item.lastQuestion}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AidenPanel({
  ticker,
  messages,
  input,
  setInput,
  onSend,
  loading,
}: {
  ticker: string;
  messages: ChatMessage[];
  input: string;
  setInput: (next: string) => void;
  onSend: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <section className="flex min-h-[680px] flex-col rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" style={{ color: "#16a34a" }} />
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            AIDEN
          </span>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Hỏi mã cổ phiếu, AIDEN sẽ mở biểu đồ trong ADN Stock.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm"
              style={
                message.role === "user"
                  ? { background: "var(--primary)", color: "var(--on-primary)" }
                  : { background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }
              }
            >
              {message.text}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              AIDEN đang xử lý...
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onSend();
            }}
            placeholder={`Hỏi AIDEN về ${ticker}...`}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <button
            onClick={() => void onSend()}
            disabled={loading}
            aria-label="Gửi câu hỏi cho AIDEN"
            className="rounded-xl px-3 text-sm font-bold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

type AidenResponse = {
  message?: string;
  error?: string;
  ticker?: string;
  chartStock?: string;
  chartExchange?: string;
  widgetType?: string;
  widgetMeta?: { ticker?: string };
};

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const router = useRouter();
  const ticker = useMemo(() => (params?.ticker ?? "VNINDEX").toUpperCase(), [params?.ticker]);
  const [tab, setTab] = useState<TabId>("overview");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const tickerResolutionTopic = useTopic<TickerResolution>(`ticker:resolve:${ticker}`, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const resolvedTicker = tickerResolutionTopic.data?.valid ? tickerResolutionTopic.data.ticker : ticker;
  const isTickerValid = tickerResolutionTopic.data?.valid === true;
  const canLoadWorkbench = isTickerValid;

  const workbenchTopic = useTopic<WorkbenchPayload>(`research:workbench:${resolvedTicker}`, {
    enabled: canLoadWorkbench,
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const realtimeTopic = useTopic<unknown>(`vn:realtime:${resolvedTicker}:5m`, {
    enabled: canLoadWorkbench,
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const historicalTopic = useTopic<unknown>(`vn:historical:${resolvedTicker}:1d`, {
    enabled: canLoadWorkbench,
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const holdingTopic = useTopic<PortfolioHoldingTopicData>(`portfolio:holding:current-user:${resolvedTicker}`, {
    enabled: canLoadWorkbench,
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const recentResearchTopic = useTopic<RecentResearchPayload>("research:recent-tickers", {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });

  useEffect(() => {
    setMessages([
      {
        role: "bot",
        text: `AIDEN đang theo dõi mã ${resolvedTicker}. Anh/chị có thể hỏi nhanh về xu hướng, rủi ro hoặc nhập mã khác để mở biểu đồ.`,
      },
    ]);
  }, [resolvedTicker]);

  const workbench = workbenchTopic.data;
  const ta = workbench?.ta ?? null;
  const fa = workbench?.fa ?? null;
  const signal = workbench?.signal ?? null;
  const news = workbench?.news ?? [];
  const investorData = workbench?.investor ?? {};
  const seasonality = workbench?.seasonality ?? null;
  const holding = holdingTopic.data?.holding ?? null;
  const historicalCandles = useMemo(() => normalizeHistoricalCandles(historicalTopic.data), [historicalTopic.data]);
  const realtimePrice = readRealtimePrice(realtimeTopic.data) ?? ta?.currentPrice ?? null;
  const realtimeChangePct = readRealtimeChangePct(realtimeTopic.data) ?? ta?.changePct ?? null;
  const actionSummary = buildActionSummary(signal, Boolean(holding));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);

    try {
      const prompt = `${text}\n\nMã cổ phiếu đang xem: ${resolvedTicker}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const data = (await res.json()) as AidenResponse;
      const nextTicker = (data.ticker ?? data.chartStock ?? data.widgetMeta?.ticker ?? "").trim().toUpperCase();
      const botText =
        data.message ||
        data.error ||
        (nextTicker
          ? `AIDEN đã mở biểu đồ ${nextTicker} trong ADN Stock.`
          : "AIDEN chưa có phản hồi phù hợp. Anh/chị thử nhập mã cổ phiếu hoặc câu hỏi rõ hơn.");

      setMessages((prev) => [...prev, { role: "bot", text: botText }]);
      void recentResearchTopic.refresh(true);
      if (nextTicker && nextTicker !== resolvedTicker) {
        router.push(`/stock/${nextTicker}`);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Lỗi kết nối AIDEN. Vui lòng thử lại." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ChartCandlestick className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
                Tra cứu cổ phiếu: {resolvedTicker}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <FreshnessBadge label="Mã" freshness={tickerResolutionTopic.freshness} />
              <FreshnessBadge label="DataHub" freshness={workbenchTopic.freshness} />
              <FreshnessBadge label="Giá realtime" freshness={realtimeTopic.freshness} />
              <FreshnessBadge label="Lịch sử hỏi" freshness={recentResearchTopic.freshness} />
            </div>
          </div>
          <button
            onClick={() => {
              void tickerResolutionTopic.refresh(true);
              void workbenchTopic.refresh(true);
              void realtimeTopic.refresh(true);
              void historicalTopic.refresh(true);
              void holdingTopic.refresh(true);
              void recentResearchTopic.refresh(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${workbenchTopic.isValidating || realtimeTopic.isValidating ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="space-y-4 xl:col-span-2">
            {tickerResolutionTopic.isLoading ? (
              <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
                Đang xác thực mã cổ phiếu trong toàn thị trường...
              </div>
            ) : null}

            {!tickerResolutionTopic.isLoading && !isTickerValid ? (
              <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--danger)", background: "rgba(192,57,43,0.08)", color: "var(--text-primary)" }}>
                Mã <strong>{ticker}</strong> không hợp lệ hoặc chưa có trong dữ liệu thị trường hiện tại.
                <br />
                Hệ thống đã chặn render ADN Stock để tránh sai dữ liệu.
              </div>
            ) : null}

            {isTickerValid ? (
              <div className="rounded-2xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                {historicalTopic.isLoading && historicalCandles.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center rounded-xl bg-[var(--surface-2)] text-sm md:h-[500px]" style={{ color: "var(--text-secondary)" }}>
                    Đang tải biểu đồ từ DataHub...
                  </div>
                ) : (
                  <StockChart symbol={resolvedTicker} candles={historicalCandles} sourceLabel="DataHub" />
                )}
              </div>
            ) : null}

            {isTickerValid ? <ActionSummaryCard summary={actionSummary} /> : null}

            {isTickerValid ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <InfoItem label="Giá hiện tại" value={fmtValue(realtimePrice)} />
                <InfoItem label="Biến động" value={fmtPercent(realtimeChangePct)} />
                <InfoItem label="RSI14" value={fmtValue(ta?.rsi14)} />
                <InfoItem label="Tín hiệu" value={signal?.status ?? "--"} />
              </div>
            ) : null}

            <RecentResearchPanel
              activeTicker={resolvedTicker}
              payload={recentResearchTopic.data}
              isLoading={recentResearchTopic.isLoading}
            />

            {isTickerValid ? <WorkbenchTabs tab={tab} setTab={setTab} /> : null}

            {isTickerValid ? (
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                {workbenchTopic.isLoading && !workbench ? (
                  <div className="space-y-2">
                    <div className="h-6 w-1/2 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="h-24 animate-pulse rounded bg-[var(--surface-2)]" />
                  </div>
                ) : tab === "overview" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem label="VNINDEX" value={fmtValue(workbench?.market?.vnindex?.value)} />
                    <InfoItem label="VN30" value={fmtValue(workbench?.market?.vn30?.value)} />
                    <InfoItem label="Thanh khoản" value={fmtValue(workbench?.market?.liquidity?.total)} />
                    <InfoItem
                      label="Độ rộng"
                      value={`${workbench?.market?.breadth?.up ?? 0}/${workbench?.market?.breadth?.down ?? 0}/${workbench?.market?.breadth?.unchanged ?? 0}`}
                    />
                  </div>
                ) : tab === "ta" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem label="EMA10" value={fmtValue(ta?.ema10)} />
                    <InfoItem label="EMA20" value={fmtValue(ta?.ema20)} />
                    <InfoItem label="EMA30" value={fmtValue(ta?.ema30)} />
                    <InfoItem label="EMA50" value={fmtValue(ta?.ema50)} />
                    <InfoItem label="Volume MA20" value={fmtValue(ta?.avgVolume20)} />
                    <InfoItem label="Nguồn" value={ta?.source ?? "--"} />
                  </div>
                ) : tab === "fa" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem label="P/E" value={fmtValue(fa?.pe)} />
                    <InfoItem label="P/B" value={fmtValue(fa?.pb)} />
                    <InfoItem label="EPS" value={fmtValue(fa?.eps)} />
                    <InfoItem label="ROE" value={fmtPercent(fa?.roe)} />
                    <InfoItem label="ROA" value={fmtPercent(fa?.roa)} />
                    <InfoItem label="Nguồn" value={fa?.source ?? "--"} />
                  </div>
                ) : tab === "sentiment" ? (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Dòng tiền và tâm lý realtime của {resolvedTicker}.
                    </p>
                    <JsonPanel value={investorData} />
                  </div>
                ) : tab === "news" ? (
                  <div className="space-y-2">
                    {news.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        Chưa có bản tin mới cho mã này.
                      </p>
                    ) : (
                      news.slice(0, 8).map((item, idx) => (
                        <div
                          key={`${item.title ?? "news"}-${idx}`}
                          className="rounded-xl border p-3"
                          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                        >
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {item.title ?? "Tin tức thị trường"}
                          </p>
                          {item.summary ? (
                            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                              {item.summary}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {(item.source ?? "Nguồn tổng hợp")} · {(item.time ?? item.published_at ?? "").toString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                ) : tab === "seasonality" ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoItem label="Winrate" value={fmtPercent(seasonality?.winRate)} />
                    <InfoItem label="Sharpe" value={fmtValue(seasonality?.sharpeRatio)} />
                    <InfoItem label="R/R" value={fmtValue(seasonality?.rrRatio)} />
                  </div>
                ) : tab === "signal" ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoItem label="Trạng thái" value={signal?.status ?? "--"} />
                      <InfoItem label="Loại tín hiệu" value={signal?.type ?? "--"} />
                      <InfoItem label="Giá kích hoạt" value={fmtValue(signal?.entryPrice)} />
                      <InfoItem label="Giá hiện tại" value={fmtValue(signal?.currentPrice ?? realtimePrice)} />
                      <InfoItem label="Mục tiêu" value={fmtValue(signal?.target)} />
                      <InfoItem label="Cắt lỗ" value={fmtValue(signal?.stoploss)} />
                      <InfoItem label="P/L" value={fmtPercent(signal?.currentPnl)} />
                      <InfoItem label="Winrate/RR" value={`${fmtPercent(signal?.winRate)} / ${fmtValue(signal?.rrRatio)}`} />
                    </div>
                    {signal?.aiReasoning ? (
                      <div
                        className="rounded-xl border p-3 text-sm leading-relaxed"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        {signal.aiReasoning}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!holding ? (
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        Nhà đầu tư chưa có vị thế ACTIVE trùng mã {resolvedTicker}.
                      </p>
                    ) : (
                      <div
                        className="grid gap-3 rounded-xl border p-3 md:grid-cols-2"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <InfoItem label="Giá vốn" value={fmtValue(holding.entryPrice)} />
                        <InfoItem label="Giá hiện tại" value={fmtValue(holding.currentPrice ?? realtimePrice)} />
                        <InfoItem label="P/L" value={fmtPercent(holding.pnlPercent)} />
                        <InfoItem label="NAV" value={`${fmtValue(holding.navAllocation)}%`} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <div className="space-y-4">
            <AidenPanel
              ticker={resolvedTicker}
              messages={messages}
              input={input}
              setInput={setInput}
              onSend={handleSend}
              loading={chatLoading}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
