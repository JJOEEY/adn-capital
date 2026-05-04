"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChartCandlestick,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StockChart, type Candle, type ChartTimeframe } from "@/components/chat/StockChart";
import { useTopic } from "@/hooks/useTopic";
import {
  applyMarketPriceScale,
  chooseMarketDisplayPrice,
  getMarketPayloadRows,
  latestTurnoverPriceFromPayload,
  marketPriceScaleFromPayload,
} from "@/lib/market-price-normalization";
import { extractExplicitTickerCandidate, sanitizeTicker } from "@/lib/ticker-text";

type JsonRecord = Record<string, unknown>;

type SignalData = {
  status?: string;
  type?: string;
  entryPrice?: number | null;
  currentPrice?: number | null;
  currentPnl?: number | null;
  target?: number | null;
  stoploss?: number | null;
};

type WorkbenchPayload = {
  ticker: string;
  ta?: {
    currentPrice?: number;
    changePct?: number;
    avgVolume20?: number;
    sma20?: number | null;
    sma50?: number | null;
    sma200?: number | null;
    ema20?: number | null;
    ema50?: number | null;
    ema200?: number | null;
    source?: string;
  } | null;
  fa?: {
    pe?: number | null;
    pb?: number | null;
    eps?: number | null;
    bookValuePerShare?: number | null;
    roe?: number | null;
    roa?: number | null;
    reportDate?: string | null;
    valuationBasis?: string | null;
    source?: string;
  } | null;
  adnCore?: {
    score?: number | null;
    max_score?: number | null;
    status_badge?: string | null;
    action_message?: string | null;
  } | null;
  art?: {
    score?: number | null;
    ma7?: number | null;
    status?: string | null;
  } | null;
  signal?: SignalData | null;
};

type TickerResolution = {
  ticker: string;
  valid: boolean;
};

type DepthLevel = {
  price: number;
  volume: number;
};

type DepthPayload = {
  ticker: string;
  exchange?: string;
  close: number | null;
  reference: number | null;
  ceiling: number | null;
  floor: number | null;
  bid: DepthLevel[];
  ask: DepthLevel[];
  spread: number | null;
  totalBidVolume: number;
  totalAskVolume: number;
  source: string;
  updatedAt: string;
};

type BoardRow = {
  ticker: string;
  exchange?: string;
  close?: number;
  reference?: number;
  ceiling?: number;
  floor?: number;
  change?: number;
  changePct?: number;
  volume?: number;
  foreignBuyVolume?: number;
  foreignSellVolume?: number;
  bid?: DepthLevel[];
  ask?: DepthLevel[];
  ma20Volume?: number;
};

type BoardPayload = {
  tickers: string[];
  prices: Record<string, BoardRow>;
  source: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  streaming?: boolean;
  tickers?: string[];
};

type AidenRecommendation = {
  ticker?: string | null;
  entryPrice?: number | null;
  target?: number | null;
  stoploss?: number | null;
};

type AidenResponse = {
  message?: string;
  error?: string;
  ticker?: string;
  tickers?: string[];
  recommendation?: AidenRecommendation | null;
};

type PendingAidenQuery = {
  id: string;
  ticker: string;
  text: string;
  displayText: string;
  createdAt: number;
};

const DEFAULT_WATCHLIST = ["SSI", "HPG", "FPT", "GVR", "MBB", "VND", "VCB", "VHM"];
const AIDEN_CHAT_STORAGE_KEY = "adn-stock-aiden-chat-v1";
const AIDEN_RECOMMENDATION_STORAGE_KEY = "adn-stock-aiden-recommendations-v1";
const AIDEN_PENDING_QUERY_STORAGE_KEY = "adn-stock-aiden-pending-query-v1";

function fmtValue(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString("vi-VN")}${suffix}`;
}

function fmtPrice(value: number | null | undefined) {
  return fmtValue(value);
}

function buildAdnLinkHref(ticker: string, source = "aiden") {
  const query = new URLSearchParams({
    ticker: ticker.trim().toUpperCase(),
    side: "BUY",
    source,
  });
  return `/dashboard/dnse-trading?${query.toString()}`;
}

function fmtMultiple(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Đang tính";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}x`;
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
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const normalized = text.includes("T")
    ? text
    : text.includes(" ")
      ? `${text.replace(" ", "T")}+07:00`
      : `${text}T00:00:00+07:00`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function normalizeCandles(payload: unknown): Candle[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as JsonRecord;
  const rows = getMarketPayloadRows(record);
  const scale = marketPriceScaleFromPayload(record);

  return rows
    .map((row) => {
      const item = row as JsonRecord;
      const time = readUnixTime(item.time ?? item.timestamp ?? item.date);
      const open = applyMarketPriceScale(readNumber(row, ["open", "o"]), scale);
      const high = applyMarketPriceScale(readNumber(row, ["high", "h"]), scale);
      const low = applyMarketPriceScale(readNumber(row, ["low", "l"]), scale);
      const close = applyMarketPriceScale(readNumber(row, ["close", "c", "price"]), scale);
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
  return readNumber(rows.at(-1), ["close", "price", "current"]);
}

function readRealtimeChangePct(payload: unknown) {
  const data = payload && typeof payload === "object" ? (payload as JsonRecord).data : null;
  const rows = Array.isArray(data) ? data : [];
  const first = readNumber(rows[0], ["close", "price"]);
  const last = readNumber(rows.at(-1), ["close", "price"]);
  if (first == null || last == null || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function marketDefaultTimeframe(): ChartTimeframe {
  return "1D";
}

const MIN_USABLE_INTRADAY_CANDLES = 20;
const MAX_INTRADAY_DAILY_DEVIATION = 0.08;

function hasUsableIntradayCandles(intraday: Candle[], daily: Candle[]) {
  if (intraday.length < MIN_USABLE_INTRADAY_CANDLES) return false;
  const intradayClose = intraday.at(-1)?.close;
  const dailyClose = daily.at(-1)?.close;
  if (!intradayClose || !dailyClose) return true;
  return Math.abs(intradayClose - dailyClose) / Math.max(1, dailyClose) <= MAX_INTRADAY_DAILY_DEVIATION;
}

function readHistoricalMarketPrice(payload: unknown) {
  const rows = getMarketPayloadRows(payload);
  const last = rows.at(-1);
  const scale = marketPriceScaleFromPayload(payload);
  const scaledClose = applyMarketPriceScale(readNumber(last, ["close", "c", "price"]), scale);
  return chooseMarketDisplayPrice(scaledClose, latestTurnoverPriceFromPayload(payload));
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function FreshnessBadge({ label, freshness }: { label: string; freshness: string | null }) {
  if (!freshness) return null;
  const fresh = freshness === "fresh";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
      style={{
        borderColor: fresh ? "rgba(22,163,74,0.25)" : "rgba(245,158,11,0.25)",
        background: fresh ? "rgba(22,163,74,0.10)" : "rgba(245,158,11,0.10)",
        color: fresh ? "#16a34a" : "#f59e0b",
      }}
    >
      {label} · {fresh ? "Mới" : "Gần nhất"}
    </span>
  );
}

function StockOverviewPanel({ workbench, realtimePrice, realtimeChangePct, aidenRecommendation }: {
  workbench: WorkbenchPayload | null;
  realtimePrice: number | null;
  realtimeChangePct: number | null;
  aidenRecommendation: AidenRecommendation | null;
}) {
  const signal = workbench?.signal ?? null;
  const ta = workbench?.ta ?? null;
  const fa = workbench?.fa ?? null;
  const reference = aidenRecommendation ?? {
    entryPrice: signal?.entryPrice,
    target: signal?.target,
    stoploss: signal?.stoploss,
  };
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Tổng quan</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Giá: {fmtPrice(realtimePrice ?? ta?.currentPrice)} · {fmtPercent(realtimeChangePct ?? ta?.changePct)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <InfoItem label="Giá khuyến nghị" value={fmtPrice(reference.entryPrice)} />
        <InfoItem label="Giá mục tiêu" value={fmtPrice(reference.target)} />
        <InfoItem label="Giá cắt lỗ" value={fmtPrice(reference.stoploss)} />
        <InfoItem label="Volume MA20" value={fmtValue(ta?.avgVolume20)} />
        <InfoItem label="P/E" value={fmtMultiple(fa?.pe)} />
        <InfoItem label="P/B" value={fmtMultiple(fa?.pb)} />
      </div>
    </section>
  );
}

function OrderBookPanel({ depth, loading }: { depth: DepthPayload | null; loading: boolean }) {
  const bid = depth?.bid ?? [];
  const ask = depth?.ask ?? [];
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Sổ lệnh mua/bán</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            3 mức giá mua và bán tốt nhất đang chờ khớp trên thị trường.
          </p>
        </div>
        <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
          Chênh lệch giá {fmtPrice(depth?.spread)}
        </span>
      </div>
      <div className="mb-3 rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
        Bên mua là giá nhà đầu tư đang đặt mua. Bên bán là giá nhà đầu tư đang chào bán. Chênh lệch giá càng nhỏ thì mã thường càng dễ mua/bán nhanh.
      </div>
      {loading && !depth ? (
        <div className="h-28 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      ) : !depth ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sổ lệnh mua/bán đang được cập nhật cho mã này.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <DepthSide title="Bên mua" levels={bid} tone="bid" />
          <DepthSide title="Bên bán" levels={ask} tone="ask" />
          <InfoItem label="Tổng cầu" value={fmtValue(depth.totalBidVolume)} />
          <InfoItem label="Tổng cung" value={fmtValue(depth.totalAskVolume)} />
        </div>
      )}
    </section>
  );
}

function DepthSide({ title, levels, tone }: { title: string; levels: DepthLevel[]; tone: "bid" | "ask" }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="mb-2 text-xs font-bold" style={{ color: tone === "bid" ? "#16a34a" : "#ef4444" }}>{title}</p>
      <div className="space-y-1">
        {[0, 1, 2].map((index) => {
          const level = levels[index];
          return (
            <div key={index} className="grid grid-cols-3 gap-2 text-xs">
              <span style={{ color: "var(--text-muted)" }}>Mức {index + 1}</span>
              <span className="font-bold" style={{ color: tone === "bid" ? "#16a34a" : "#ef4444" }}>{fmtPrice(level?.price)}</span>
              <span className="text-right" style={{ color: "var(--text-secondary)" }}>{fmtValue(level?.volume)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WatchlistBoard({
  items,
  board,
  onAdd,
  onRemove,
  onMove,
  onOpen,
}: {
  items: string[];
  board: BoardPayload | null;
  onAdd: (ticker: string) => void;
  onRemove: (ticker: string) => void;
  onMove: (ticker: string, direction: -1 | 1) => void;
  onOpen: (ticker: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const rows = items.map((ticker) => board?.prices?.[ticker] ?? { ticker });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd(draft);
    setDraft("");
  };

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Danh sách theo dõi</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Bảng giá rút gọn, tự cập nhật khoảng 15-30 giây.</p>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.toUpperCase())}
            placeholder="Thêm mã"
            className="w-24 rounded-lg border px-2 py-1 text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
          />
          <button type="submit" aria-label="Thêm mã vào watchlist" className="rounded-lg border px-2" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </div>
      <div className="max-h-[360px] overflow-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[760px] text-xs">
          <thead style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
            <tr>
              <th className="px-2 py-2 text-left">Mã</th>
              <th className="px-2 py-2 text-right">Giá</th>
              <th className="px-2 py-2 text-right">%</th>
              <th className="px-2 py-2 text-right" title="Khối lượng đã khớp trong phiên">Khối lượng</th>
              <th className="px-2 py-2 text-right" title="Giá trần, giá sàn và giá tham chiếu">Trần/Sàn/TC</th>
              <th className="px-2 py-2 text-right" title="Giá mua tốt nhất đang chờ khớp và khối lượng đặt mua">Mua tốt nhất</th>
              <th className="px-2 py-2 text-right" title="Giá bán tốt nhất đang chờ khớp và khối lượng chào bán">Bán tốt nhất</th>
              <th className="px-2 py-2 text-right" title="Khối ngoại mua/bán trong phiên">Nước ngoài</th>
              <th className="px-2 py-2 text-right">Sắp xếp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const changePct = Number(row.changePct ?? 0);
              const tone = changePct > 0 ? "#16a34a" : changePct < 0 ? "#ef4444" : "var(--text-secondary)";
              return (
                <tr key={row.ticker} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => onOpen(row.ticker)} className="font-mono font-black" style={{ color: "var(--primary)" }}>
                      {row.ticker}
                    </button>
                    <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{row.exchange ?? ""}</span>
                  </td>
                  <td className="px-2 py-2 text-right font-bold" style={{ color: tone }}>{fmtPrice(row.close)}</td>
                  <td className="px-2 py-2 text-right" style={{ color: tone }}>{fmtPercent(row.changePct)}</td>
                  <td className="px-2 py-2 text-right">{fmtValue(row.volume)}</td>
                  <td className="px-2 py-2 text-right">{fmtPrice(row.ceiling)}/{fmtPrice(row.floor)}/{fmtPrice(row.reference)}</td>
                  <td className="px-2 py-2 text-right text-emerald-600">{fmtPrice(row.bid?.[0]?.price)} · {fmtValue(row.bid?.[0]?.volume)}</td>
                  <td className="px-2 py-2 text-right text-red-500">{fmtPrice(row.ask?.[0]?.price)} · {fmtValue(row.ask?.[0]?.volume)}</td>
                  <td className="px-2 py-2 text-right">{fmtValue(row.foreignBuyVolume)}/{fmtValue(row.foreignSellVolume)}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Đưa lên" disabled={index === 0} onClick={() => onMove(row.ticker, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label="Đưa xuống" disabled={index === rows.length - 1} onClick={() => onMove(row.ticker, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label="Xóa" onClick={() => onRemove(row.ticker)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-40"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

function AidenPanel({
  ticker,
  messages,
  input,
  setInput,
  onSend,
  onTickerSelect,
  loading,
}: {
  ticker: string;
  messages: ChatMessage[];
  input: string;
  setInput: (next: string) => void;
  onSend: () => Promise<void>;
  onTickerSelect: (ticker: string) => void;
  loading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <section className="flex h-[72vh] min-h-[520px] max-h-[730px] flex-col overflow-hidden rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>AIDEN</span>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Hỏi trực tiếp mã cổ phiếu, AIDEN trả lời bằng dữ liệu thị trường và báo cáo mới nhất.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((message, index) => (
          <div key={message.id || `${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[94%] rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role === "bot" ? "aiden-markdown" : "whitespace-pre-wrap"}`}
              style={
                message.role === "user"
                  ? { background: "var(--primary)", color: "var(--on-primary)" }
                  : { background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }
              }
            >
              {message.role === "bot" ? (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                  {message.streaming ? <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-sm bg-current align-text-bottom" /> : null}
                </>
              ) : message.text}
              {message.tickers?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {message.tickers.map((tickerItem) => (
                    <span key={`${message.id}-${tickerItem}`} className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTickerSelect(tickerItem)}
                        className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface)",
                          color: "var(--primary)",
                        }}
                      >
                        {tickerItem}
                      </button>
                      {message.role === "bot" ? (
                        <a
                          href={buildAdnLinkHref(tickerItem)}
                          className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                          style={{
                            borderColor: "rgba(22,163,74,0.25)",
                            background: "rgba(22,163,74,0.10)",
                            color: "#15803d",
                          }}
                        >
                          Đặt lệnh
                        </a>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              AIDEN đang phân tích...
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void onSend();
              }
            }}
            placeholder={`Hỏi AIDEN về ${ticker}...`}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
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

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const router = useRouter();
  const ticker = useMemo(() => (params?.ticker ?? "VNINDEX").toUpperCase(), [params?.ticker]);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>(() => marketDefaultTimeframe());
  const [search, setSearch] = useState(ticker);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [recommendationsHydrated, setRecommendationsHydrated] = useState(false);
  const [aidenRecommendations, setAidenRecommendations] = useState<Record<string, AidenRecommendation>>({});
  const typingTimerRef = useRef<number | null>(null);

  const tickerResolutionTopic = useTopic<TickerResolution>(`ticker:resolve:${ticker}`, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const resolvedTicker = tickerResolutionTopic.data?.valid ? tickerResolutionTopic.data.ticker : ticker;
  const isTickerValid = tickerResolutionTopic.data?.valid === true;

  const workbenchTopic = useTopic<WorkbenchPayload>(`research:workbench:${resolvedTicker}`, {
    enabled: isTickerValid,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const realtimeTopic = useTopic<unknown>(`vn:realtime:${resolvedTicker}:${timeframe === "1D" ? "5m" : timeframe}`, {
    enabled: isTickerValid,
    refreshInterval: timeframe === "1D" ? 0 : 5_000,
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });
  const historicalTopic = useTopic<unknown>(`vn:historical:${resolvedTicker}:1d`, {
    enabled: isTickerValid,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const depthTopic = useTopic<DepthPayload>(`vn:depth:${resolvedTicker}`, {
    enabled: isTickerValid,
    refreshInterval: 15_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  useEffect(() => {
    setSearch(resolvedTicker);
  }, [resolvedTicker]);

  useEffect(() => {
    if (chatHydrated) return;
    try {
      const raw = window.sessionStorage.getItem(AIDEN_CHAT_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) as ChatMessage[] : [];
      if (Array.isArray(saved) && saved.length > 0) {
        setMessages(saved.map((message) => ({ ...message, streaming: false })));
        setChatHydrated(true);
        return;
      }
    } catch {
      // Session restore is best-effort only.
    }
    setMessages([
      {
        id: `intro-${Date.now()}`,
        role: "bot",
        text: `AIDEN đang theo dõi **${resolvedTicker}**. Anh/chị có thể hỏi: **Phân tích ${resolvedTicker}**, **có nên mua không**, hoặc nhập một mã khác.`,
        tickers: [resolvedTicker],
      },
    ]);
    setChatHydrated(true);
  }, [chatHydrated, resolvedTicker]);

  useEffect(() => {
    if (!chatHydrated) return;
    try {
      const persisted = messages
        .slice(-60)
        .map((message) => ({ ...message, streaming: false }));
      window.sessionStorage.setItem(AIDEN_CHAT_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Session persistence is best-effort only.
    }
  }, [chatHydrated, messages]);

  useEffect(() => {
    if (recommendationsHydrated) return;
    try {
      const raw = window.sessionStorage.getItem(AIDEN_RECOMMENDATION_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) as Record<string, AidenRecommendation> : {};
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        setAidenRecommendations(saved);
      }
    } catch {
      // Session restore is best-effort only.
    }
    setRecommendationsHydrated(true);
  }, [recommendationsHydrated]);

  useEffect(() => {
    if (!recommendationsHydrated) return;
    try {
      window.sessionStorage.setItem(AIDEN_RECOMMENDATION_STORAGE_KEY, JSON.stringify(aidenRecommendations));
    } catch {
      // Session persistence is best-effort only.
    }
  }, [aidenRecommendations, recommendationsHydrated]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("adn-stock-watchlist");
    const saved = raw ? JSON.parse(raw) as string[] : [];
    const merged = Array.from(new Set([resolvedTicker, ...saved, ...DEFAULT_WATCHLIST])).slice(0, 30);
    setWatchlist(merged);
  }, [resolvedTicker]);

  useEffect(() => {
    if (watchlist.length > 0) {
      window.localStorage.setItem("adn-stock-watchlist", JSON.stringify(watchlist));
    }
  }, [watchlist]);

  const boardKey = watchlist.length > 0 ? `vn:board:${watchlist.join(",")}` : "";
  const boardTopic = useTopic<BoardPayload>(boardKey, {
    enabled: watchlist.length > 0,
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });

  const historicalCandles = useMemo(() => normalizeCandles(historicalTopic.data), [historicalTopic.data]);
  const realtimeCandles = useMemo(() => normalizeCandles(realtimeTopic.data), [realtimeTopic.data]);
  const intradayUsable = useMemo(
    () => hasUsableIntradayCandles(realtimeCandles, historicalCandles),
    [historicalCandles, realtimeCandles],
  );
  const chartCandles = timeframe === "1D" || !intradayUsable ? historicalCandles : realtimeCandles;
  const workbench = workbenchTopic.data;
  const historicalMarketPrice = useMemo(() => readHistoricalMarketPrice(historicalTopic.data), [historicalTopic.data]);
  const realtimePrice = chooseMarketDisplayPrice(
    readRealtimePrice(realtimeTopic.data) ?? workbench?.ta?.currentPrice ?? null,
    historicalMarketPrice,
  );
  const realtimeChangePct = readRealtimeChangePct(realtimeTopic.data) ?? workbench?.ta?.changePct ?? null;
  const activeAidenRecommendation = aidenRecommendations[resolvedTicker] ?? null;

  useEffect(() => {
    if (timeframe !== "1D" && !realtimeTopic.isLoading && !realtimeTopic.isValidating && !intradayUsable && historicalCandles.length > 0) {
      setTimeframe("1D");
    }
  }, [timeframe, realtimeTopic.isLoading, realtimeTopic.isValidating, intradayUsable, historicalCandles.length]);

  const refreshAll = () => {
    void tickerResolutionTopic.refresh(true);
    void workbenchTopic.refresh(true);
    void realtimeTopic.refresh(true);
    void historicalTopic.refresh(true);
    void depthTopic.refresh(true);
    void boardTopic.refresh(true);
  };

  const selectTicker = useCallback((nextTicker: string) => {
    const next = sanitizeTicker(nextTicker);
    if (!next) return null;
    setTimeframe("1D");
    setSearch(next);
    if (next !== ticker) {
      router.replace(`/stock/${next}`, { scroll: false });
    }
    return next;
  }, [router, ticker]);

  const addWatchlist = (value: string) => {
    const next = sanitizeTicker(value);
    if (!next) return;
    setWatchlist((prev) => Array.from(new Set([next, ...prev])).slice(0, 50));
  };

  const removeWatchlist = (value: string) => {
    setWatchlist((prev) => prev.filter((tickerItem) => tickerItem !== value));
  };

  const moveWatchlist = (value: string, direction: -1 | 1) => {
    setWatchlist((prev) => {
      const index = prev.indexOf(value);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const saveAidenRecommendation = (recommendation: AidenRecommendation | null | undefined, fallbackTicker: string | null) => {
    if (!recommendation) return;
    const tickerKey = sanitizeTicker(recommendation.ticker) || sanitizeTicker(fallbackTicker);
    if (!tickerKey) return;
    const cleaned: AidenRecommendation = {
      ticker: tickerKey,
      entryPrice: Number.isFinite(Number(recommendation.entryPrice)) ? Number(recommendation.entryPrice) : null,
      target: Number.isFinite(Number(recommendation.target)) ? Number(recommendation.target) : null,
      stoploss: Number.isFinite(Number(recommendation.stoploss)) ? Number(recommendation.stoploss) : null,
    };
    if (cleaned.entryPrice == null && cleaned.target == null && cleaned.stoploss == null) return;
    setAidenRecommendations((prev) => ({ ...prev, [tickerKey]: cleaned }));
  };

  const streamBotMessage = (fullText: string, tickers: string[] = []) => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const id = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stepSize = Math.max(2, Math.ceil(fullText.length / 280));
    let index = 0;
    const cleanTickers = Array.from(new Set(tickers.map((item) => sanitizeTicker(item)).filter(Boolean)));
    setMessages((prev) => [...prev, { id, role: "bot", text: "", streaming: true, tickers: cleanTickers }]);

    const tick = () => {
      index = Math.min(fullText.length, index + stepSize);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id
            ? { ...message, text: fullText.slice(0, index), streaming: index < fullText.length, tickers: cleanTickers }
            : message,
        ),
      );

      if (index < fullText.length) {
        typingTimerRef.current = window.setTimeout(tick, 16);
      } else {
        typingTimerRef.current = null;
      }
    };

    typingTimerRef.current = window.setTimeout(tick, 35);
  };

  const submitAidenQuery = async (
    rawText: string,
    options: { explicitTicker?: string | null; displayText?: string; clearInput?: boolean } = {},
  ) => {
    const text = rawText.trim();
    if (!text || chatLoading) return;
    const parsedTicker = sanitizeTicker(options.explicitTicker) || extractExplicitTickerCandidate(text);
    const displayText = options.displayText?.trim() || text;
    if (parsedTicker && parsedTicker !== resolvedTicker) {
      try {
        const pending: PendingAidenQuery = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ticker: parsedTicker,
          text,
          displayText,
          createdAt: Date.now(),
        };
        window.sessionStorage.setItem(AIDEN_PENDING_QUERY_STORAGE_KEY, JSON.stringify(pending));
      } catch {
        // Pending query persistence is best-effort only.
      }
      selectTicker(parsedTicker);
      return;
    }
    const requestTicker = parsedTicker ?? resolvedTicker;
    const userTickers = parsedTicker ? [parsedTicker] : [];
    if (options.clearInput ?? true) setInput("");
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text: displayText, tickers: userTickers }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, currentTicker: requestTicker, surface: "stock" }),
      });
      const data = (await res.json()) as AidenResponse;
      const botText = data.message || data.error || "AIDEN chưa có phản hồi phù hợp. Vui lòng thử lại.";
      const botTickers = Array.from(new Set((data.tickers ?? [data.ticker]).map((item) => sanitizeTicker(item)).filter(Boolean)));
      streamBotMessage(botText, botTickers);
      const nextTicker = sanitizeTicker(data.ticker) || botTickers[0] || null;
      saveAidenRecommendation(data.recommendation, nextTicker ?? requestTicker);
      if (nextTicker && nextTicker !== requestTicker) selectTicker(nextTicker);
    } catch {
      streamBotMessage("Lỗi kết nối AIDEN. Vui lòng thử lại.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!chatHydrated || chatLoading) return;
    let pending: PendingAidenQuery | null = null;
    try {
      const raw = window.sessionStorage.getItem(AIDEN_PENDING_QUERY_STORAGE_KEY);
      pending = raw ? JSON.parse(raw) as PendingAidenQuery : null;
    } catch {
      window.sessionStorage.removeItem(AIDEN_PENDING_QUERY_STORAGE_KEY);
      return;
    }
    if (!pending) return;
    if (Date.now() - pending.createdAt > 2 * 60 * 1000) {
      window.sessionStorage.removeItem(AIDEN_PENDING_QUERY_STORAGE_KEY);
      return;
    }
    if (sanitizeTicker(pending.ticker) !== resolvedTicker) return;

    window.sessionStorage.removeItem(AIDEN_PENDING_QUERY_STORAGE_KEY);
    void submitAidenQuery(pending.text, {
      explicitTicker: pending.ticker,
      displayText: pending.displayText,
      clearInput: false,
    });
  }, [chatHydrated, chatLoading, resolvedTicker]);

  const handleSend = async () => {
    await submitAidenQuery(input, { clearInput: true });
  };

  const handleSearchEnter = () => {
    const next = sanitizeTicker(search);
    if (!next) return;
    void submitAidenQuery(`Phân tích ${next}`, {
      explicitTicker: next,
      displayText: `Phân tích ${next}`,
      clearInput: false,
    });
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const next = sanitizeTicker(search);
    if (!next) return;
    void submitAidenQuery(`Phân tích ${next}`, {
      explicitTicker: next,
      displayText: `Phân tích ${next}`,
      clearInput: false,
    });
  };

  const handleAidenTickerSelect = (nextTicker: string) => {
    const next = sanitizeTicker(nextTicker);
    if (!next) return;
    void submitAidenQuery(`Phân tích ${next}`, {
      explicitTicker: next,
      displayText: `Phân tích ${next}`,
      clearInput: false,
    });
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1800px] space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ChartCandlestick className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Tra cứu cổ phiếu: {resolvedTicker}</h1>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <FreshnessBadge label="Mã" freshness={tickerResolutionTopic.freshness} />
              <FreshnessBadge label="Phân tích" freshness={workbenchTopic.freshness} />
              <FreshnessBadge label="Giá" freshness={realtimeTopic.freshness} />
              <FreshnessBadge label="Sổ lệnh" freshness={depthTopic.freshness} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    handleSearchEnter();
                  }
                }}
                placeholder="Mã cổ phiếu"
                className="w-36 rounded-lg border px-3 py-2 text-sm font-bold outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
                aria-label="Tìm mã cổ phiếu"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
              >
                <Search className="h-4 w-4" />
                Phân tích
              </button>
            </form>
            <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
              <RefreshCw className={`h-4 w-4 ${workbenchTopic.isValidating || realtimeTopic.isValidating ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
        </div>

        {!tickerResolutionTopic.isLoading && !isTickerValid ? (
          <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--danger)", background: "rgba(192,57,43,0.08)", color: "var(--text-primary)" }}>
            Mã <strong>{ticker}</strong> không hợp lệ hoặc chưa có trong dữ liệu thị trường hiện tại.
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-4">
            {isTickerValid ? (
              <>
                <StockChart
                  symbol={resolvedTicker}
                  candles={chartCandles}
                  sourceLabel="ADN Stock"
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  allowFallbackFetch={false}
                />
                <StockOverviewPanel
                  workbench={workbench ?? null}
                  realtimePrice={realtimePrice}
                  realtimeChangePct={realtimeChangePct}
                  aidenRecommendation={activeAidenRecommendation}
                />
                <div className="grid gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
                  <OrderBookPanel depth={depthTopic.data} loading={depthTopic.isLoading} />
                  <WatchlistBoard
                    items={watchlist}
                    board={boardTopic.data}
                    onAdd={addWatchlist}
                    onRemove={removeWatchlist}
                    onMove={moveWatchlist}
                    onOpen={(next) => selectTicker(next)}
                  />
                </div>
              </>
            ) : null}
          </section>
          <AidenPanel
            ticker={resolvedTicker}
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            onTickerSelect={handleAidenTickerSelect}
            loading={chatLoading}
          />
        </div>
      </div>
    </MainLayout>
  );
}
