"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, ChartCandlestick, RefreshCw, Send } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StockChart } from "@/components/chat/StockChart";
import { useTopic } from "@/hooks/useTopic";
import { useTopics } from "@/hooks/useTopics";

type TabId =
  | "overview"
  | "ta"
  | "fa"
  | "sentiment"
  | "news"
  | "seasonality"
  | "signal"
  | "portfolio";

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
  signal?: {
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
  } | null;
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

type TAData = {
  currentPrice?: number;
  changePct?: number;
  rsi14?: number;
  ema10?: number;
  ema20?: number;
  ema30?: number;
  ema50?: number;
  avgVolume20?: number;
  source?: string;
};

type FAData = {
  pe?: number | null;
  pb?: number | null;
  eps?: number | null;
  roe?: number | null;
  roa?: number | null;
  revenueGrowthYoY?: number | null;
  profitGrowthYoY?: number | null;
  source?: string;
};

type ChatMessage = {
  role: "user" | "bot";
  text: string;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Tong quan" },
  { id: "ta", label: "TA" },
  { id: "fa", label: "FA" },
  { id: "sentiment", label: "Tam ly" },
  { id: "news", label: "News" },
  { id: "seasonality", label: "Seasonality" },
  { id: "signal", label: "Signal" },
  { id: "portfolio", label: "Portfolio" },
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
  const text = isFresh ? "Fresh" : isStale ? "Stale" : state.toUpperCase();
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
      title: "No active signal",
      tone: "neutral" as const,
      text: "He thong chua co signal moi cho ma nay. Nha dau tu theo doi tiep trong Watchlist.",
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
        title: "Risk warning",
        tone: "danger" as const,
        text: "Gia hien tai dang sat stoploss. Uu tien quan tri rui ro, khong binh quan vo ky luat.",
      };
    }
    if (pnl >= 10) {
      return {
        title: "Protect profit",
        tone: "success" as const,
        text: "Vi the dang co lai tot. Co the nang trailing stop de khoa loi va giam rui ro dao chieu.",
      };
    }
    return {
      title: hasHolding ? "Hold discipline" : "Candidate active",
      tone: "warning" as const,
      text: hasHolding
        ? "Vi the dang active. Theo doi moc target/stoploss va giu ky luat quan tri NAV."
        : "Signal active nhung portfolio chua co vi the dong bo. Can kiem tra lai du lieu broker.",
    };
  }

  if (status === "RADAR") {
    return {
      title: "Watchlist setup",
      tone: "neutral" as const,
      text: "Ma dang o trang thai radar. Cho xac nhan dieu kien kich hoat truoc khi vao lenh.",
    };
  }

  return {
    title: "Signal lifecycle update",
    tone: "neutral" as const,
    text: "Signal da chuyen trang thai. Kiem tra tab Signal de xem chi tiet.",
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
        AI Broker quick action
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

function AITalkPanel({
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
    <section className="flex min-h-[560px] flex-col rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <Bot className="h-4 w-4" style={{ color: "#16a34a" }} />
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          AI Talk
        </span>
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
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onSend();
            }}
            placeholder={`Hoi AI ve ${ticker}...`}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <button
            onClick={() => void onSend()}
            disabled={loading}
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

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = useMemo(() => (params?.ticker ?? "VNINDEX").toUpperCase(), [params?.ticker]);
  const [tab, setTab] = useState<TabId>("overview");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: `He thong dang theo doi ma ${ticker}. Nha dau tu co the hoi nhanh ve MUA/GIU/BAN.` },
  ]);
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
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
  const holdingTopic = useTopic<PortfolioHoldingTopicData>(`portfolio:holding:current-user:${resolvedTicker}`, {
    enabled: canLoadWorkbench,
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const lazyTopicKeys = useMemo(() => {
    if (!canLoadWorkbench) return [];
    if (tab === "ta") return [`vn:ta:${resolvedTicker}`];
    if (tab === "fa") return [`vn:fa:${resolvedTicker}`];
    if (tab === "sentiment") return [`vn:investor:${resolvedTicker}`];
    if (tab === "news") return [`news:ticker:${resolvedTicker}`];
    if (tab === "seasonality") return [`vn:seasonality:${resolvedTicker}`];
    if (tab === "signal") return [`signal:ticker:${resolvedTicker}`];
    return [];
  }, [canLoadWorkbench, resolvedTicker, tab]);

  const lazyTopics = useTopics<unknown>(lazyTopicKeys, {
    refreshInterval: tab === "sentiment" ? 60_000 : 0,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const workbench = workbenchTopic.data;
  const lazyTa = lazyTopics.byTopic.get(`vn:ta:${resolvedTicker}`)?.value as TAData | undefined;
  const lazyFa = lazyTopics.byTopic.get(`vn:fa:${resolvedTicker}`)?.value as FAData | undefined;
  const lazyInvestor = lazyTopics.byTopic.get(`vn:investor:${resolvedTicker}`)?.value as unknown;
  const lazyNews = lazyTopics.byTopic.get(`news:ticker:${resolvedTicker}`)?.value as TickerNewsItem[] | undefined;
  const lazySeasonality = lazyTopics.byTopic.get(`vn:seasonality:${resolvedTicker}`)?.value as WorkbenchPayload["seasonality"];
  const lazySignal = lazyTopics.byTopic.get(`signal:ticker:${resolvedTicker}`)?.value as SignalData | undefined;

  const ta = lazyTa ?? workbench?.ta ?? null;
  const fa = lazyFa ?? workbench?.fa ?? null;
  const signal = lazySignal ?? workbench?.signal ?? null;
  const news = lazyNews ?? workbench?.news ?? [];
  const investorData = lazyInvestor ?? workbench?.investor ?? {};
  const seasonality = lazySeasonality ?? workbench?.seasonality ?? null;
  const holding = holdingTopic.data?.holding ?? null;
  const actionSummary = buildActionSummary(signal, Boolean(holding));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);

    try {
      const prompt = `${text}\n\nMa co phieu dang xem: ${resolvedTicker}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      setMessages((prev) => [...prev, { role: "bot", text: data.message || data.error || "He thong chua co phan hoi." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Loi ket noi AI. Vui long thu lai." }]);
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
                Research Workbench: {resolvedTicker}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <FreshnessBadge label="Ticker" freshness={tickerResolutionTopic.freshness} />
              <FreshnessBadge label="Workbench" freshness={workbenchTopic.freshness} />
              <FreshnessBadge label="Portfolio" freshness={holdingTopic.freshness} />
              {lazyTopicKeys.length > 0 ? <FreshnessBadge label="Tab Data" freshness={lazyTopics.envelopes[0]?.freshness ?? null} /> : null}
            </div>
          </div>
          <button
            onClick={() => {
              void tickerResolutionTopic.refresh(true);
              void workbenchTopic.refresh(true);
              void holdingTopic.refresh(true);
              if (lazyTopicKeys.length > 0) {
                void lazyTopics.refresh(true);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${workbenchTopic.isValidating || lazyTopics.isValidating ? "animate-spin" : ""}`} />
            Lam moi
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="xl:col-span-2 space-y-4">
            {tickerResolutionTopic.isLoading ? (
              <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
                Dang xac thuc ma co phieu trong toan thi truong...
              </div>
            ) : null}

            {!tickerResolutionTopic.isLoading && !isTickerValid ? (
              <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--danger)", background: "rgba(192,57,43,0.08)", color: "var(--text-primary)" }}>
                Ma <strong>{ticker}</strong> khong hop le hoac khong ton tai trong du lieu thi truong hien tai.
                <br />
                He thong da chan render Workbench de tranh sai du lieu.
              </div>
            ) : null}

            {isTickerValid ? (
            <div className="rounded-2xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <StockChart symbol={resolvedTicker} />
            </div>
            ) : null}

            {isTickerValid ? <ActionSummaryCard summary={actionSummary} /> : null}

            {isTickerValid ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <InfoItem label="Gia hien tai" value={fmtValue(ta?.currentPrice)} />
              <InfoItem label="Bien dong" value={fmtPercent(ta?.changePct)} />
              <InfoItem label="RSI14" value={fmtValue(ta?.rsi14)} />
              <InfoItem label="Signal" value={signal?.status ?? "--"} />
            </div> : null}

            {isTickerValid ? <WorkbenchTabs tab={tab} setTab={setTab} /> : null}

            {isTickerValid ? <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              {workbenchTopic.isLoading && !workbench ? (
                <div className="space-y-2">
                  <div className="h-6 w-1/2 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="h-24 animate-pulse rounded bg-[var(--surface-2)]" />
                </div>
              ) : tab === "overview" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="VNINDEX" value={fmtValue(workbench?.market?.vnindex?.value)} />
                  <InfoItem label="VN30" value={fmtValue(workbench?.market?.vn30?.value)} />
                  <InfoItem label="Thanh khoan" value={fmtValue(workbench?.market?.liquidity?.total)} />
                  <InfoItem
                    label="Do rong"
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
                  <InfoItem label="Source" value={ta?.source ?? "--"} />
                </div>
              ) : tab === "fa" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="P/E" value={fmtValue(fa?.pe)} />
                  <InfoItem label="P/B" value={fmtValue(fa?.pb)} />
                  <InfoItem label="EPS" value={fmtValue(fa?.eps)} />
                  <InfoItem label="ROE" value={fmtPercent(fa?.roe)} />
                  <InfoItem label="ROA" value={fmtPercent(fa?.roa)} />
                  <InfoItem label="Source" value={fa?.source ?? "--"} />
                </div>
              ) : tab === "sentiment" ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Investor flow and sentiment realtime for {ticker}.
                  </p>
                  <JsonPanel value={investorData} />
                </div>
              ) : tab === "news" ? (
                <div className="space-y-2">
                  {news.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Chua co ban tin moi cho ma nay.
                    </p>
                  ) : (
                    news.slice(0, 8).map((item, idx) => (
                      <div
                        key={`${item.title ?? "news"}-${idx}`}
                        className="rounded-xl border p-3"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                      >
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {item.title ?? "Tin tuc thi truong"}
                        </p>
                        {item.summary ? (
                          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                            {item.summary}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {(item.source ?? "Nguon tong hop")} · {(item.time ?? item.published_at ?? "").toString()}
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
                    <InfoItem label="Status" value={signal?.status ?? "--"} />
                    <InfoItem label="Type" value={signal?.type ?? "--"} />
                    <InfoItem label="Entry" value={fmtValue(signal?.entryPrice)} />
                    <InfoItem label="Current" value={fmtValue(signal?.currentPrice)} />
                    <InfoItem label="Target" value={fmtValue(signal?.target)} />
                    <InfoItem label="Stoploss" value={fmtValue(signal?.stoploss)} />
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
                      Nha dau tu chua co vi the ACTIVE trung ma {resolvedTicker}.
                    </p>
                  ) : (
                    [holding].filter(Boolean).map((item, idx) => (
                      <div
                        key={`${item?.ticker}-${idx}`}
                        className="grid gap-3 rounded-xl border p-3 md:grid-cols-2"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <InfoItem label="Entry" value={fmtValue(item?.entryPrice)} />
                        <InfoItem label="Current" value={fmtValue(item?.currentPrice)} />
                        <InfoItem label="P/L" value={fmtPercent(item?.pnlPercent)} />
                        <InfoItem label="NAV" value={`${fmtValue(item?.navAllocation)}%`} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div> : null}
          </section>

          <AITalkPanel
            ticker={resolvedTicker}
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            loading={chatLoading}
          />
        </div>
      </div>
    </MainLayout>
  );
}
