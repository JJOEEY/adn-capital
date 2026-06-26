"use client";

import { FormEvent, KeyboardEvent, memo, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Plus, Send, Square } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useChat } from "@/hooks/useChat";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useChatStore } from "@/store/chatStore";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  streaming?: boolean;
  error?: boolean;
};

type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type SseEvent = {
  event: string;
  data: unknown;
};

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!event || !data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

function BotAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
      <Bot className="h-4 w-4 text-[var(--primary)]" />
    </div>
  );
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-4 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="pl-1">{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
  ),
};

// Memo: chỉ message nào ĐỔI mới re-render. Diệt lag khi (a) gõ input — các bubble cũ giữ nguyên props nên skip;
// (b) stream — chỉ bubble đang nhả chữ re-render, không phải toàn bộ lịch sử.
const AssistantMessage = memo(function AssistantMessage({ message }: { message: ChatMessage }) {
  const streaming = Boolean(message.streaming);
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div className="min-w-0 max-w-[820px] flex-1">
        <div
          className={`prose prose-sm max-w-none rounded-2xl rounded-tl-sm border px-4 py-3 leading-relaxed ${
            message.error
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
          }`}
        >
          {message.text ? (
            // Lúc đang nhả chữ: render PLAIN TEXT (rẻ, mượt char-by-char) + con trỏ. Xong stream mới render Markdown.
            streaming ? (
              <p className="m-0 whitespace-pre-wrap break-words">
                {message.text}
                <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-[2px] animate-pulse rounded-sm bg-current align-text-bottom" />
              </p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {message.text}
              </ReactMarkdown>
            )
          ) : streaming ? (
            <div className="flex gap-1.5 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-muted)]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-muted)] [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-muted)] [animation-delay:240ms]" />
            </div>
          ) : (
            <p className="m-0">AIDEN chưa hoàn tất câu trả lời. Vui lòng thử lại.</p>
          )}
        </div>
      </div>
    </div>
  );
});

const UserMessage = memo(function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[780px] rounded-2xl rounded-tr-sm bg-[var(--primary)] px-4 py-3 text-sm leading-relaxed text-[var(--on-primary)]">
        {text}
      </div>
    </div>
  );
});

type RevealState = {
  id: string;
  full: string; // toàn bộ text đã nhận từ stream
  shown: number; // số ký tự đã nhả ra
  netDone: boolean; // stream mạng đã kết thúc
  error?: boolean;
  finalText?: string; // text chốt (data.message) khi done
  raf: number | null;
};

export function AidenWebChat() {
  const { isAuthenticated } = useCurrentDbUser();
  const { chatCount, limit, isLimitReached } = useChat();
  const { setChatCount } = useChatStore();
  const canShowClientLimit = false;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const revealRef = useRef<RevealState | null>(null);
  const chatCountRef = useRef(chatCount);

  useEffect(() => {
    chatCountRef.current = chatCount;
  }, [chatCount]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const response = await fetch("/api/chat/history?limit=80&surface=aiden", { cache: "no-store" });
        const payload = (await response.json()) as { messages?: HistoryMessage[] };
        if (!active || !Array.isArray(payload.messages)) return;
        setMessages(
          payload.messages.map((item) => ({
            id: item.id,
            role: item.role,
            text: item.text,
            createdAt: new Date(item.createdAt).getTime(),
          })),
        );
      } catch {
        // History is optional for the chat surface.
      }
    }
    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

  // Cuộn xuống tin MỚI NHẤT bằng scrollIntoView trên sentinel ở cuối — chạy ĐÚNG dù phần cuộn là container
  // (mobile, h bị bound) HAY cả trang (desktop lg:h-full → container nở hết, trang tự cuộn). Instant, không smooth
  // → khỏi giật theo từng token khi nhả chữ. (container.scrollTop KHÔNG dùng được vì desktop container không cuộn.)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Cleanup khi unmount: huỷ rAF + abort stream.
  useEffect(
    () => () => {
      if (revealRef.current?.raf != null) cancelAnimationFrame(revealRef.current.raf);
      abortRef.current?.abort();
    },
    [],
  );

  const updateAssistant = useCallback((id: string, updater: (message: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? updater(message) : message)));
  }, []);

  // Vòng nhả chữ: mỗi frame nhả thêm vài ký tự (bắt kịp nếu LLM chạy nhanh), CHỈ bubble đang stream re-render.
  const pumpReveal = useCallback(() => {
    const r = revealRef.current;
    if (!r) return;
    r.raf = null;
    if (r.shown < r.full.length) {
      const remaining = r.full.length - r.shown;
      // Cap ~10 ký tự/frame (~600/giây @60fps): typewriter NHÌN THẤY được, vẫn bắt kịp khi LLM bắn cục lớn;
      // chậm dần về ~1 ký tự lúc gần hết cho cảm giác gõ thật.
      const step = Math.min(10, Math.max(1, Math.ceil(remaining / 45)));
      r.shown = Math.min(r.full.length, r.shown + step);
      const slice = r.full.slice(0, r.shown);
      updateAssistant(r.id, (m) => ({ ...m, text: slice }));
    }
    const caughtUp = r.shown >= r.full.length;
    if (caughtUp && r.netDone) {
      const finalText = r.finalText ?? r.full;
      updateAssistant(r.id, (m) => ({
        ...m,
        text: finalText,
        streaming: false,
        error: Boolean(r.error) || finalText.length === 0,
      }));
      revealRef.current = null;
      setIsStreaming(false);
      return;
    }
    // Còn chữ để nhả → chạy tiếp. Bắt kịp nhưng chưa done → dừng (delta/finalize mới sẽ khởi động lại) để khỏi spin CPU.
    if (!caughtUp) r.raf = requestAnimationFrame(pumpReveal);
  }, [updateAssistant]);

  const ensurePump = useCallback(() => {
    const r = revealRef.current;
    if (r && r.raf == null) r.raf = requestAnimationFrame(pumpReveal);
  }, [pumpReveal]);

  // Chốt reveal NGAY (đồng bộ) khi đã netDone — không phụ thuộc rAF (rAF bị pause ở tab nền sẽ treo input).
  const flushRevealFinal = useCallback(() => {
    const r = revealRef.current;
    if (!r || !r.netDone) return;
    if (r.raf != null) cancelAnimationFrame(r.raf);
    const final = r.finalText ?? r.full;
    updateAssistant(r.id, (m) => ({ ...m, text: final, streaming: false, error: Boolean(r.error) || final.length === 0 }));
    revealRef.current = null;
    setIsStreaming(false);
  }, [updateAssistant]);

  // Tab chuyển sang ẩn khi đang chờ chốt (netDone nhưng rAF chưa kịp finalize) → flush đồng bộ, tránh treo input.
  useEffect(() => {
    const onVis = () => {
      if (typeof document !== "undefined" && document.hidden) flushRevealFinal();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [flushRevealFinal]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (revealRef.current?.raf != null) cancelAnimationFrame(revealRef.current.raf);
    revealRef.current = null;
    setIsStreaming(false);
    setMessages((prev) => prev.map((message) => (message.streaming ? { ...message, streaming: false } : message)));
  }, []);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    if (revealRef.current?.raf != null) cancelAnimationFrame(revealRef.current.raf);
    revealRef.current = null;
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;
      if (canShowClientLimit && isLimitReached) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Bạn đã dùng hết lượt tư vấn hôm nay. Nâng cấp VIP để tiếp tục.",
            createdAt: Date.now(),
            error: true,
          },
        ]);
        return;
      }

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text, createdAt: Date.now() },
        { id: assistantId, role: "assistant", text: "", createdAt: Date.now() + 1, streaming: true },
      ]);
      setInput("");
      setIsStreaming(true);

      // Chốt stream: đặt text cuối + cho vòng nhả chữ chạy nốt rồi mới tắt cursor (hoặc finalize ngay nếu chưa có chữ nào).
      const finalizeStream = (finalText: string, isError: boolean) => {
        const r = revealRef.current;
        if (r && r.id === assistantId) {
          if (finalText) r.full = finalText;
          r.finalText = finalText || r.full;
          r.error = isError;
          r.netDone = true;
          // Đã nhả hết chữ HOẶC tab đang ẩn (rAF pause) → chốt đồng bộ; còn chữ + tab hiện → để rAF nhả nốt.
          if (r.shown >= r.full.length || (typeof document !== "undefined" && document.hidden)) {
            flushRevealFinal();
          } else {
            ensurePump();
          }
        } else {
          updateAssistant(assistantId, (m) => ({
            ...m,
            text: finalText || m.text,
            streaming: false,
            error: isError || (finalText || m.text).length === 0,
          }));
          setIsStreaming(false);
        }
      };

      const controller = new AbortController();
      abortRef.current = controller;
      let finished = false;

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            surface: "aiden",
            guestUsage: isAuthenticated ? undefined : 0,
          }),
          signal: controller.signal,
        });

        if (!response.body) throw new Error("Không nhận được luồng trả lời.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const parsed = parseSseBlock(block);
            if (!parsed) continue;
            const data = parsed.data as {
              text?: string;
              message?: string;
              usage?: { used?: number; isUnlimited?: boolean };
            };

            if (parsed.event === "delta" && data.text) {
              if (!revealRef.current || revealRef.current.id !== assistantId) {
                revealRef.current = { id: assistantId, full: "", shown: 0, netDone: false, raf: null };
              }
              revealRef.current.full += data.text;
              ensurePump();
            }

            if (parsed.event === "done") {
              finished = true;
              if (typeof data.usage?.used === "number") {
                setChatCount(data.usage.used);
              } else if (!isAuthenticated) {
                setChatCount(chatCountRef.current + 1);
              }
              finalizeStream(data.message ?? revealRef.current?.full ?? "", false);
            }

            if (parsed.event === "error") {
              finished = true;
              finalizeStream(data.message ?? "AIDEN đang gặp lỗi. Vui lòng thử lại sau.", true);
            }
          }
        }

        if (!finished && !controller.signal.aborted) {
          const current = revealRef.current?.full ?? "";
          finalizeStream(current || "AIDEN chưa hoàn tất câu trả lời. Vui lòng thử lại.", current.length === 0);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          finalizeStream(error instanceof Error ? error.message : "Mất kết nối. Vui lòng thử lại.", true);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [canShowClientLimit, ensurePump, flushRevealFinal, input, isAuthenticated, isLimitReached, isStreaming, setChatCount, updateAssistant],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const remainingText =
    limit === Infinity ? "VIP" : `${Math.max(0, (limit as number) - chatCount)}/${limit} lượt`;

  return (
    <MainLayout disableSwipe>
      <div className="flex h-[calc(100dvh-96px)] min-h-0 flex-col lg:h-full">
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <BotAvatar />
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)]">AIDEN</h1>
              <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Đang hoạt động
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)] sm:inline-flex">
              {remainingText}
            </span>
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)]"
              title="Tạo cuộc trò chuyện mới"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
            {messages.length === 0 ? (
              <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                  <Bot className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Hỏi AIDEN</h2>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["AIDEN giúp tôi được gì?", "Thị trường hôm nay thế nào?", "Phân tích FPT", "So sánh HPG HSG"].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--text-primary)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage key={message.id} text={message.text} />
                ) : (
                  <AssistantMessage key={message.id} message={message} />
                ),
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:px-6">
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
              placeholder="Hỏi AIDEN về thị trường hoặc cổ phiếu..."
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[16px] leading-5 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] disabled:opacity-60"
            />
            <button
              type={isStreaming ? "button" : "submit"}
              onClick={isStreaming ? handleStop : undefined}
              disabled={!isStreaming && !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              title={isStreaming ? "Dừng trả lời" : "Gửi"}
            >
              {isStreaming ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
