"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSession } from "next-auth/react";
import { TrendingUp, BarChart3, Heart, Newspaper, Send, Zap, Bot } from "lucide-react";
import { StockChart } from "@/components/chat/StockChart";
import { useTheme } from "@/components/providers/ThemeProvider";

type CardId = "ta" | "fa" | "tamly" | "news";
type BrokerBadge = "MUA" | "GIỮ" | "BÁN";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  createdAt: number;
  ticker?: string;
  isCards?: boolean;
  mediaUrl?: string | null;
  showDynamicChart?: boolean;
  brokerBadge?: BrokerBadge;
}

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  widgetMeta?: {
    complete: boolean;
    ticker?: string;
    badge?: BrokerBadge;
  };
}

const TICKER_PATTERN = /^[A-Z]{2,5}$/;
const TICKER_TOKEN_PATTERN = /\b[A-Z]{2,5}\b/g;
const TICKER_STOP_WORDS = new Set([
  "VA", "VOI", "CHO", "CON", "MA", "CP", "THE", "NAY", "NHU", "MUA", "BAN", "GIU", "HOLD",
  "NEU", "DUOC", "SAO", "ROI", "TOI", "MINH", "BAN", "LAM", "KHI", "NEN", "XEM", "PHAN",
  "TICH", "NHAN", "DINH", "CO", "PHIEU", "TICKER", "TIN", "TUC", "HOM", "NAY", "VND",
]);

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

const CARDS = [
  {
    id: "ta" as CardId,
    title: "Phân tích kỹ thuật",
    sub: "Chart, RSI, MACD, hỗ trợ/kháng cự",
    icon: TrendingUp,
  },
  {
    id: "fa" as CardId,
    title: "Phân tích cơ bản",
    sub: "P/E, P/B, ROE, tăng trưởng",
    icon: BarChart3,
  },
  {
    id: "tamly" as CardId,
    title: "Tâm lý & hành vi",
    sub: "Dòng tiền, sentiment, rủi ro",
    icon: Heart,
  },
  {
    id: "news" as CardId,
    title: "Tin tức & sự kiện",
    sub: "Tổng hợp tin và tác động",
    icon: Newspaper,
  },
];

const WELCOME_HINTS = [
  { label: "HPG", desc: "Phân tích Hòa Phát" },
  { label: "VCB", desc: "Phân tích Vietcombank" },
  { label: "Thị trường hôm nay?", desc: "Nhận định chung" },
  { label: "Nên mua cổ nào?", desc: "Tư vấn lựa chọn" },
];

function mapSignalToBadge(signal?: string | null): BrokerBadge {
  const normalized = (signal ?? "").toUpperCase();
  if (normalized.includes("BUY") || normalized.includes("MUA") || normalized.includes("BULL")) return "MUA";
  if (normalized.includes("SELL") || normalized.includes("BAN") || normalized.includes("BÁN") || normalized.includes("BEAR")) return "BÁN";
  return "GIỮ";
}

function badgeStyle(badge: BrokerBadge): { color: string; borderColor: string; background: string } {
  const color = badge === "MUA" ? "#16a34a" : badge === "BÁN" ? "#ef4444" : "#f59e0b";
  return {
    color,
    borderColor: `${color}66`,
    background: `${color}1A`,
  };
}

function BotAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: "var(--border)", background: "var(--primary-light)" }}
    >
      <Bot className="h-4 w-4" style={{ color: "var(--primary)" }} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[85%] rounded-2xl rounded-tr-sm border px-4 py-2.5 text-sm leading-relaxed"
        style={{ background: "var(--primary)", color: "var(--on-primary)", borderColor: "var(--primary-hover)" }}
      >
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <BotAvatar />
      <div
        className="rounded-2xl rounded-tl-sm border px-4 py-3 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
      >
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--text-muted)" }} />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:120ms]" style={{ background: "var(--text-muted)" }} />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:240ms]" style={{ background: "var(--text-muted)" }} />
        </div>
      </div>
    </div>
  );
}

interface TickerCardsProps {
  ticker: string;
  onCardClick: (cardId: CardId, ticker: string) => void;
  loading: CardId | null;
  disabled?: boolean;
}

function TickerCards({ ticker, onCardClick, loading, disabled = false }: TickerCardsProps) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const isLoading = loading === card.id;
        return (
          <button
            key={card.id}
            onClick={() => onCardClick(card.id, ticker)}
            disabled={loading !== null || disabled}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--border-strong)] disabled:opacity-60"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(46,77,61,0.12)]">
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
              ) : (
                <Icon className="h-4 w-4 text-[var(--text-primary)]" />
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">{card.title}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-secondary)]">{card.sub}</p>
          </button>
        );
      })}
    </div>
  );
}

interface BotBubbleProps {
  message: Message;
  onCardClick?: (cardId: CardId, ticker: string) => void;
  cardLoading?: CardId | null;
  cardDisabled?: boolean;
}

function BotBubble({ message, onCardClick, cardLoading, cardDisabled = false }: BotBubbleProps) {
  const brokerBadge = message.brokerBadge ?? "GIỮ";
  const brokerBadgeDesign = badgeStyle(brokerBadge);

  return (
    <div className="flex items-start gap-2.5">
      <BotAvatar />
      <div className="flex max-w-[90%] flex-col gap-2">
        {message.text && (
          <div
            className="rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm leading-relaxed"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}

        {message.showDynamicChart && message.ticker && (
          <div className="rounded-2xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Khu vực AI nhận định
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-black"
                style={brokerBadgeDesign}
              >
                AI BROKER: {brokerBadge}
              </span>
            </div>
            <StockChart symbol={message.ticker} />
          </div>
        )}

        {message.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.mediaUrl}
            alt={`Chart ${message.ticker ?? ""}`}
            className="w-full rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          />
        )}

        {message.isCards && message.ticker && onCardClick && (
          <TickerCards
            ticker={message.ticker}
            onCardClick={onCardClick}
            loading={cardLoading ?? null}
            disabled={cardDisabled}
          />
        )}
      </div>
    </div>
  );
}

interface InvestmentChatProps {
  onSendFreeText?: (text: string) => void;
  freeTextLoading?: boolean;
  extraMessages?: Message[];
  disableInput?: boolean;
  disableReason?: string;
}

export function InvestmentChat({
  onSendFreeText,
  freeTextLoading = false,
  extraMessages = [],
  disableInput = false,
  disableReason = "",
}: InvestmentChatProps) {
  const { data: session } = useSession();
  const { theme } = useTheme();
  const userId = (session?.user as { id?: string })?.id ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [cardLoading, setCardLoading] = useState<CardId | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateDevice = () => setIsMobile(window.innerWidth < 1024);
    updateDevice();
    window.addEventListener("resize", updateDevice);
    return () => window.removeEventListener("resize", updateDevice);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setViewportHeight(null);
      setKeyboardOpen(false);
      return;
    }

    const visualViewport = window.visualViewport;
    const updateViewport = () => {
      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      setViewportHeight(height);
      const keyboardHeight = Math.max(0, window.innerHeight - height - (visualViewport?.offsetTop ?? 0));
      setKeyboardOpen(keyboardHeight > 120);
    };

    updateViewport();
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!userId) return;
    let isActive = true;

    const hydrateHistory = async () => {
      try {
        const response = await fetch("/api/chat/history?limit=80", { cache: "no-store" });
        const payload = (await response.json()) as { messages?: HistoryMessage[] };
        if (!isActive || !Array.isArray(payload.messages)) return;

        const mapped = payload.messages.map((item) => ({
          id: item.id,
          role: item.role === "assistant" ? "bot" : "user",
          text: item.text,
          createdAt: new Date(item.createdAt).getTime(),
          ticker: item.widgetMeta?.ticker,
          showDynamicChart: item.widgetMeta?.complete === true && !!item.widgetMeta?.ticker,
          brokerBadge: item.widgetMeta?.badge,
        })) as Message[];

        setMessages(mapped);
      } catch {
        // ignore history errors
      }
    };

    void hydrateHistory();
    return () => {
      isActive = false;
    };
  }, [userId]);

  const allMessages = useMemo(
    () =>
      [...messages, ...extraMessages].sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        if (a.id === b.id) return 0;
        return a.id.localeCompare(b.id);
      }),
    [messages, extraMessages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [allMessages, cardLoading, botLoading, freeTextLoading, keyboardOpen]);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const newMessage: Message = { ...msg, id: crypto.randomUUID() };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  const handleCardClick = useCallback(
    async (cardId: CardId, ticker: string) => {
      setCardLoading(cardId);
      const commandMap: Record<CardId, string> = {
        ta: `/ta ${ticker}`,
        fa: `/fa ${ticker}`,
        tamly: `/tamly ${ticker}`,
        news: `/news ${ticker}`,
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: commandMap[cardId] }),
          signal: AbortSignal.timeout(45_000),
        });
        const data = (await response.json()) as { message?: string; error?: string };

        if (response.status === 429) {
          addMessage({
            role: "bot",
            text: data.message ?? "Nhà đầu tư đã hết lượt tư vấn hôm nay.",
            createdAt: Date.now(),
          });
          return;
        }
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);

        const text = data.message ?? "Không có dữ liệu phân tích.";
        const taBadge = cardId === "ta" ? mapSignalToBadge(text) : undefined;
        addMessage({
          role: "bot",
          text,
          createdAt: Date.now(),
          ticker,
          mediaUrl: null,
          showDynamicChart: cardId === "ta",
          brokerBadge: taBadge,
        });

        if (userId) {
          const persistedText = cardId === "ta" ? `[WIDGET:${ticker}:${taBadge ?? "GIỮ"}] ${text}` : text;
          await saveChatHistory("assistant", persistedText).catch(() => undefined);
        }
      } catch {
        addMessage({
          role: "bot",
          text: "Không thể tải dữ liệu, vui lòng thử lại.",
          createdAt: Date.now(),
        });
      } finally {
        setCardLoading(null);
      }
    },
    [addMessage, userId],
  );

  const handleSubmit = useCallback(() => {
    if (disableInput) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    const ticker = detectTicker(trimmed);
    addMessage({ role: "user", text: trimmed, createdAt: Date.now() });

    if (ticker) {
      addMessage({
        role: "bot",
        text: `Nhà đầu tư muốn phân tích ${ticker}? Hãy chọn loại phân tích bên dưới.`,
        createdAt: Date.now(),
        ticker,
        isCards: true,
      });
      if (userId) {
        Promise.all([
          saveChatHistory("user", trimmed),
          saveChatHistory("assistant", `Nhà đầu tư muốn phân tích ${ticker}? Hãy chọn loại phân tích bên dưới.`),
        ]).catch(() => undefined);
      }
      return;
    }

    if (onSendFreeText) {
      setBotLoading(true);
      onSendFreeText(trimmed);
    }
  }, [disableInput, input, addMessage, onSendFreeText, userId]);

  useEffect(() => {
    if (extraMessages.length > 0) {
      setBotLoading(false);
    }
  }, [extraMessages]);

  const isLoading = cardLoading !== null || botLoading || freeTextLoading;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-page)",
        borderColor: "var(--border)",
        height: isMobile ? (viewportHeight ? `${viewportHeight}px` : "100dvh") : "100%",
      }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--primary-light)]">
              <Zap className="h-7 w-7 text-[var(--primary)]" />
            </div>
            <h3 className="mb-1 text-base font-bold text-[var(--text-primary)]">ADN AI Broker sẵn sàng hỗ trợ</h3>
            <p className="mb-5 max-w-xs text-sm text-[var(--text-secondary)]">
              Nhập mã cổ phiếu (VD: HPG) để mở 4 card phân tích, hoặc đặt câu hỏi tự do.
            </p>
            <div className="grid w-full max-w-xs grid-cols-2 gap-2">
              {WELCOME_HINTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setInput(item.label)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition hover:border-[var(--border-strong)]"
                >
                  <p className="text-xs font-semibold text-[var(--primary)]">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {allMessages.map((msg) =>
          msg.role === "user" ? (
            <UserBubble key={msg.id} text={msg.text} />
          ) : (
            <BotBubble
              key={msg.id}
              message={msg}
              onCardClick={msg.isCards ? handleCardClick : undefined}
              cardLoading={cardLoading}
              cardDisabled={disableInput}
            />
          ),
        )}

        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div
        className="sticky bottom-0 z-10 border-t p-3"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          paddingBottom: isMobile
            ? keyboardOpen
              ? "0.75rem"
              : "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
            : "0.75rem",
        }}
      >
        {disableInput && <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>{disableReason || "Đã hết lượt tư vấn trong ngày."}</p>}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => {
              setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }, 120);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isLoading && !disableInput) {
                handleSubmit();
              }
            }}
            disabled={isLoading || disableInput}
            placeholder="Nhập mã CP (HPG) hoặc câu hỏi tự do..."
            className="h-11 flex-1 rounded-full border px-4 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim() || disableInput}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
            style={{
              background: "var(--primary)",
              color: "var(--on-primary)",
              filter: theme === "dark" ? "none" : "saturate(0.95)",
            }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
