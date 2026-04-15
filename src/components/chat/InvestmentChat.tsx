"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSession } from "next-auth/react";
import {
  TrendingUp,
  BarChart3,
  Heart,
  Newspaper,
  Send,
  Zap,
  Bot,
} from "lucide-react";
import { StockChart } from "@/components/chat/StockChart";


// ── Types ──────────────────────────────────────────────────────────────────

type CardId = "ta" | "fa" | "tamly" | "news";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  ticker?: string;
  isCards?: boolean;
  mediaUrl?: string | null;
  showDynamicChart?: boolean;
}

// ── Ticker detection ────────────────────────────────────────────────────────

const TICKER_PATTERN = /^[A-Z]{2,5}$/;

function detectTicker(input: string): string | null {
  const t = input.trim().toUpperCase();
  if (TICKER_PATTERN.test(t)) return t;
  return null;
}

// ── 4 Card Config (ADN Design System colors) ────────────────────────────────

const CARDS = [
  {
    id: "ta" as CardId,
    title: "Phân tích kỹ thuật",
    sub: "Chart, RSI, MACD, hỗ trợ/kháng cự",
    icon: TrendingUp,
    // Light: #2E4D3D / rgba(46,77,61,0.10) | Dark: #9aab9e / rgba(23,54,39,0.40)
    lightIcon: "#2E4D3D",
    lightIconBg: "rgba(46,77,61,0.10)",
    darkIcon: "#9aab9e",
    darkIconBg: "rgba(23,54,39,0.40)",
  },
  {
    id: "fa" as CardId,
    title: "Phân tích cơ bản",
    sub: "P/E, P/B, ROE, tăng trưởng lợi nhuận",
    icon: BarChart3,
    // Light: #5B8C5A / rgba(91,140,90,0.10) | Dark: #7ab87a / rgba(91,140,90,0.20)
    lightIcon: "#5B8C5A",
    lightIconBg: "rgba(91,140,90,0.10)",
    darkIcon: "#7ab87a",
    darkIconBg: "rgba(91,140,90,0.20)",
  },
  {
    id: "tamly" as CardId,
    title: "Tâm lý & hành vi",
    sub: "Mua/bán chủ động, khối ngoại, dòng tiền",
    icon: Heart,
    // Light: #7D8471 / rgba(125,132,113,0.10) | Dark: #9aab9e / rgba(125,132,113,0.15)
    lightIcon: "#7D8471",
    lightIconBg: "rgba(125,132,113,0.10)",
    darkIcon: "#9aab9e",
    darkIconBg: "rgba(125,132,113,0.15)",
  },
  {
    id: "news" as CardId,
    title: "Tin tức & sự kiện",
    sub: "Tổng hợp tin, sự kiện doanh nghiệp",
    icon: Newspaper,
    // Light: #A0845C / rgba(160,132,92,0.10) | Dark: #EBE2CF / rgba(73,38,40,0.35)
    lightIcon: "#A0845C",
    lightIconBg: "rgba(160,132,92,0.10)",
    darkIcon: "#EBE2CF",
    darkIconBg: "rgba(73,38,40,0.35)",
  },
];

// ── Render response từ AI ───────────────────────────────────────────────────

interface AIResponse {
  analysis?: string;
  signal?: string;
  media_url?: string | null;
  session_summary?: string;
  vn_market?: string[];
  quarter?: string;
  cached?: boolean;
}

function renderResponseText(cardId: CardId, ticker: string, data: AIResponse): string {
  switch (cardId) {
    case "ta":
      return `**${ticker}** — ${data.signal ?? "N/A"}\n\n${data.analysis ?? ""}`;
    case "fa":
      return `**Phân tích cơ bản ${ticker}**\n\n${data.analysis ?? ""}`;
    case "tamly":
      return `**Tâm lý thị trường ${ticker}**\n\n${data.analysis ?? ""}`;
    case "news":
      if (data.session_summary) return data.session_summary;
      return (data.vn_market ?? []).join("\n");
    default:
      return "";
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div
        className="max-w-[72%] px-4 py-2.5 text-sm leading-relaxed"
        style={{
          borderRadius: "16px 16px 4px 16px",
          // Light: bg #2E4D3D, color #FFFFFF | Dark: bg #173627, color #EBE2CF
          background: "var(--user-bubble-bg, #2E4D3D)",
          color: "var(--user-bubble-text, #FFFFFF)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border"
      style={{
        background: "var(--bot-avatar-bg, rgba(46,77,61,0.10))",
        borderColor: "var(--bot-avatar-border, rgba(235,226,207,0.12))",
      }}
    >
      <Bot className="w-4 h-4" style={{ color: "var(--bot-avatar-icon, #2E4D3D)" }} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 animate-fade-in">
      <BotAvatar />
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "4px 16px 16px 16px",
          padding: "12px 16px",
        }}
      >
        <div className="flex gap-1 items-center h-5">
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
          <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}

interface TickerCardsProps {
  ticker: string;
  onCardClick: (cardId: CardId, ticker: string) => void;
  loading: CardId | null;
}

function TickerCards({ ticker, onCardClick, loading }: TickerCardsProps) {
  return (
    <div
      className="grid gap-2 mt-2 animate-slide-up"
      style={{ gridTemplateColumns: "1fr 1fr" }}
    >
      {CARDS.map((card) => {
        const Icon = card.icon;
        const isLoading = loading === card.id;
        return (
          <button
            key={card.id}
            onClick={() => onCardClick(card.id, ticker)}
            disabled={loading !== null}
            className="glow-card text-left p-3 flex flex-col gap-1.5 transition-all disabled:opacity-60"
            style={{
              borderRadius: "12px",
              cursor: "pointer",
              background: "var(--card-bg, #FFFFFF)",
              border: "1px solid var(--card-border, #E8E4DB)",
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{
                background: "var(--card-icon-bg, rgba(46,77,61,0.10))",
                borderRadius: "8px",
              }}
            >
              {isLoading ? (
                <div
                  className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
                  style={{ color: "var(--card-icon-color, #2E4D3D)" }}
                />
              ) : (
                <Icon className="w-4 h-4" style={{ color: "var(--card-icon-color, #2E4D3D)" }} />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: "var(--text-primary, #1C2B22)" }}>
                {card.title}
              </p>
              <p className="text-[11px] leading-tight mt-0.5" style={{ color: "var(--text-secondary, #7D8471)" }}>
                {card.sub}
              </p>
            </div>
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
}

function BotBubble({ message, onCardClick, cardLoading }: BotBubbleProps) {
  return (
    <div className="flex items-start gap-2.5 animate-fade-in">
      <BotAvatar />
      <div className="flex flex-col gap-2 max-w-[80%]">
        {message.text && (
          <div
            className="px-4 py-2.5 text-sm leading-relaxed"
            style={{
              borderRadius: "4px 16px 16px 16px",
              wordBreak: "break-word",
              color: "var(--text-primary, #1C2B22)",
              background: "var(--surface, #FFFFFF)",
              border: "1px solid var(--border, #E8E4DB)",
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}

        {/* Chart image (chỉ TA) */}
        {message.showDynamicChart && message.ticker && (
          <StockChart symbol={message.ticker} />
        )}

        {message.mediaUrl && (
          <img
            src={message.mediaUrl}
            alt={`Chart ${message.ticker ?? ""}`}
            className="w-full rounded-lg mt-3"
            style={{ border: "1px solid var(--border)" }}
          />
        )}

        {/* 4 card mode */}
        {message.isCards && message.ticker && onCardClick && (
          <TickerCards
            ticker={message.ticker}
            onCardClick={onCardClick}
            loading={cardLoading ?? null}
          />
        )}
      </div>
    </div>
  );
}

// ── Welcome screen ──────────────────────────────────────────────────────────

const WELCOME_HINTS = [
  { label: "HPG", desc: "Phân tích Hòa Phát" },
  { label: "VCB", desc: "Phân tích Vietcombank" },
  { label: "Thị trường hôm nay?", desc: "Nhận định chung" },
  { label: "Nên mua cổ nào?", desc: "Tư vấn chọn cổ" },
];

// ── Main Component ──────────────────────────────────────────────────────────

interface InvestmentChatProps {
  onSendFreeText?: (text: string) => void;
  freeTextLoading?: boolean;
  extraMessages?: Message[];
}

export function InvestmentChat({
  onSendFreeText,
  freeTextLoading = false,
  extraMessages = [],
}: InvestmentChatProps) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [cardLoading, setCardLoading] = useState<CardId | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Merge extra messages từ parent (free text response)
  const allMessages = [...messages, ...extraMessages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, cardLoading, botLoading, freeTextLoading]);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const newMsg: Message = { ...msg, id: crypto.randomUUID() };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  }, []);

  // ── Card click handler ──────────────────────────────────────────────────

  const handleCardClick = useCallback(
    async (cardId: CardId, ticker: string) => {
      setCardLoading(cardId);
      const hour = new Date().getHours();
      const newsType = hour >= 15 ? "eod" : "morning";

      const endpointMap: Record<CardId, string> = {
        ta: `/api/bridge/api/v1/ai/ta/${ticker}${userId ? `?user_id=${userId}` : ""}`,
        fa: `/api/bridge/api/v1/ai/fa/${ticker}`,
        tamly: `/api/bridge/api/v1/ai/tamly/${ticker}`,
        news: `/api/bridge/api/v1/news/${newsType}`,
      };

      try {
        const res = await fetch(endpointMap[cardId], { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: AIResponse = await res.json();

        const text =
          cardId === "ta"
            ? (data.analysis ?? "Không có dữ liệu phân tích.")
            : renderResponseText(cardId, ticker, data);
        addMessage({
          role: "bot",
          text,
          ticker,
          mediaUrl: cardId === "ta" ? (data.media_url ?? null) : null,
          showDynamicChart: cardId === "ta",
        });
      } catch {
        addMessage({
          role: "bot",
          text: "Không thể tải dữ liệu, vui lòng thử lại.",
        });
      } finally {
        setCardLoading(null);
      }
    },
    [addMessage, userId]
  );

  // ── Submit handler ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    const ticker = detectTicker(trimmed);

    addMessage({ role: "user", text: trimmed });

    if (ticker) {
      addMessage({
        role: "bot",
        text: `Đại ca muốn phân tích ${ticker}? Chọn loại phân tích:`,
        ticker,
        isCards: true,
      });
    } else {
      if (onSendFreeText) {
        setBotLoading(true);
        onSendFreeText(trimmed);
      }
    }
  }, [input, addMessage, onSendFreeText]);

  // Tắt loading khi extraMessages thay đổi
  useEffect(() => {
    if (extraMessages.length > 0) setBotLoading(false);
  }, [extraMessages]);

  const isLoading = cardLoading !== null || botLoading || freeTextLoading;

  return (
    <div
      className="flex flex-col gap-3"
      style={{
        borderRadius: "16px",
        padding: "16px",
        minHeight: "540px",
        background: "var(--bg-page)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Messages area */}
      <div
        className="flex-1 flex flex-col gap-3 overflow-y-auto"
        style={{ minHeight: 0, maxHeight: "calc(100vh - 200px)" }}
      >
        {allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: "var(--primary-light, rgba(46,77,61,0.08))",
                border: "1px solid var(--border, #E8E4DB)",
              }}
            >
              <Zap className="w-7 h-7" style={{ color: "var(--primary, #2E4D3D)" }} />
            </div>
            <h3
              className="text-base font-bold mb-1"
              style={{ color: "var(--text-primary, #1C2B22)" }}
            >
              Chào đại ca! 👋
            </h3>
            <p
              className="text-sm mb-5 max-w-xs"
              style={{ color: "var(--text-secondary, #7D8471)" }}
            >
              Nhập mã cổ phiếu (VD:{" "}
              <span className="font-mono" style={{ color: "var(--primary, #2E4D3D)" }}>
                HPG
              </span>
              ) để phân tích, hoặc đặt câu hỏi tự do.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {WELCOME_HINTS.map((h) => (
                <button
                  key={h.label}
                  onClick={() => { setInput(h.label); }}
                  className="text-left px-3 py-2.5 transition-all"
                  style={{
                    borderRadius: "10px",
                    background: "var(--surface, #FFFFFF)",
                    border: "1px solid var(--border, #E8E4DB)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong, #D6CDBB)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border, #E8E4DB)";
                  }}
                >
                  <p className="text-xs font-semibold font-mono" style={{ color: "var(--primary, #2E4D3D)" }}>
                    {h.label}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary, #7D8471)" }}>
                    {h.desc}
                  </p>
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
            />
          )
        )}

        {isLoading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSubmit()}
          disabled={isLoading}
          placeholder="Nhập mã CP (HPG) hoặc câu hỏi tự do..."
          className="flex-1 text-sm outline-none disabled:opacity-50"
          style={{
            height: "40px",
            borderRadius: "99px",
            padding: "0 14px",
            fontSize: "14px",
            color: "var(--text-primary)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="flex-shrink-0 flex items-center justify-center transition-all disabled:opacity-40"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "var(--send-btn-bg, #2E4D3D)",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--send-btn-hover, #243d30)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--send-btn-bg, #2E4D3D)";
          }}
        >
          <Send className="w-4 h-4" style={{ color: "#fff" }} />
        </button>
      </div>
    </div>
  );
}
