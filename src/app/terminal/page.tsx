"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2, Lock, Crown, Zap } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/store/chatStore";

const WELCOME_HINTS = [
  { cmd: "PTKT HPG", desc: "Phân tích kỹ thuật Hòa Phát" },
  { cmd: "PTCB FPT", desc: "Phân tích cơ bản FPT" },
  { cmd: "Thị trường hôm nay?", desc: "Nhận định thị trường" },
  { cmd: "Nên múc cổ nào?", desc: "Tư vấn cổ phiếu phù hợp" },
];

export default function TerminalPage() {
  const router = useRouter();
  const { isAuthenticated } = useCurrentDbUser();
  const { messages, isLoading, chatCount, limit, isLimitReached, sendMessage } = useChat();
  const { clearMessages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const limitPercent = limit === Infinity ? 0 : Math.min((chatCount / limit) * 100, 100);

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-neutral-800/60 bg-neutral-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">ADN AI Terminal</p>
              <p className="text-[12px] text-neutral-500">
                Chuyên gia chứng khoán VN • Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Usage indicator */}
            {limit !== Infinity && (
              <div className="flex items-center gap-2">
                <div className="w-16 sm:w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${limitPercent}%` }}
                    className={`h-full rounded-full ${limitPercent >= 80 ? "bg-red-500" : "bg-emerald-500"}`}
                  />
                </div>
                <span className="text-xs text-neutral-500">{chatCount}/{limit}</span>
              </div>
            )}
            {limit === Infinity && (
              <div className="flex items-center gap-1.5 text-xs text-purple-400">
                <Crown className="w-3 h-3" />
                <span>VIP</span>
              </div>
            )}

            {messages.length > 0 && (
              <button
                onClick={() => { if (confirm("Xóa toàn bộ lịch sử chat?")) clearMessages(); }}
                className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 border border-neutral-800 hover:border-red-500/25 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center py-12"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Chào đại ca! 👋</h2>
              <p className="text-sm text-neutral-500 mb-6 max-w-sm">
                Em là ADN AI – chuyên gia chứng khoán VN. Đại ca muốn phân tích gì?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {WELCOME_HINTS.map((hint) => (
                  <button
                    key={hint.cmd}
                    onClick={() => sendMessage(hint.cmd)}
                    disabled={isLimitReached}
                    className="text-left px-4 py-3 rounded-xl border border-neutral-800 hover:border-emerald-500/40 bg-neutral-900 hover:bg-emerald-500/5 transition-all group disabled:opacity-40"
                  >
                    <p className="text-sm font-mono font-semibold text-emerald-400 group-hover:text-emerald-300">
                      {hint.cmd}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{hint.desc}</p>
                  </button>
                ))}
              </div>

              {!isAuthenticated && (
                <div className="mt-6 text-center">
                  <p className="text-xs text-neutral-600 mb-2">
                    Khách được {limit} lượt chat miễn phí
                  </p>
                  <button
                    onClick={() => router.push("/auth")}
                    className="text-sm text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl bg-emerald-500/8 hover:bg-emerald-500/15 transition-all"
                  >
                    Đăng nhập →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TypingIndicator />
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Limit reached overlay */}
        {isLimitReached && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 sm:mx-6 mb-3 px-3 sm:px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center gap-2 sm:gap-3"
          >
            <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-400">
                Đại ca đã dùng hết {limit} lượt chat
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Nâng cấp VIP để chat không giới hạn với ADN AI
              </p>
            </div>
            <a
              href="/pricing"
              className="flex-shrink-0 text-xs font-semibold bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 px-3 py-1.5 rounded-lg transition-all"
            >
              Nâng cấp →
            </a>
          </motion.div>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading || isLimitReached}
          placeholder={
            isLimitReached
              ? "Hết lượt chat — nâng cấp VIP để tiếp tục..."
              : "Hỏi em về chứng khoán... (VD: PTKT HPG)"
          }
        />
      </div>
    </MainLayout>
  );
}
