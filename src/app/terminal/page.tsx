"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trash2, Lock, Crown } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { InvestmentChat } from "@/components/chat/InvestmentChat";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/store/chatStore";

// Shape hiển thị extra message từ free-text response
interface ExtMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  createdAt: number;
}

export default function TerminalPage() {
  const { isAuthenticated, dbUser } = useCurrentDbUser();
  const { chatCount, limit, isLimitReached } = useChat();
  const { clearMessages, setChatCount } = useChatStore();

  const [extraMessages, setExtraMessages] = useState<ExtMessage[]>([]);
  const [freeTextPending, setFreeTextPending] = useState(false);
  const usage = dbUser?.usage;
  const remaining = usage?.remaining;
  const showLowQuotaWarning = !usage?.isUnlimited && typeof remaining === "number" && remaining > 0 && remaining <= 3;

  const limitPercent = limit === Infinity ? 0 : Math.min((chatCount / limit) * 100, 100);

  // Free-text handler (1 request duy nhất để tránh chậm và tránh đếm usage 2 lần)
  const handleFreeText = useCallback(
    async (text: string) => {
      setFreeTextPending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            guestUsage: isAuthenticated ? undefined : chatCount,
          }),
        });

        const data: {
          message?: string;
          error?: string;
          newUsage?: number;
          usage?: { used: number; isUnlimited: boolean };
          type?: "widget";
          ticker?: string;
          data?: {
            technical?: { aiInsight?: string };
            fundamental?: { aiInsight?: string };
          };
        } = await res.json();

        if (typeof data.usage?.used === "number") {
          setChatCount(data.usage.used);
        } else if (typeof data.newUsage === "number") {
          setChatCount(data.newUsage);
        } else if (!isAuthenticated) {
          setChatCount(chatCount + 1);
        }

        let reply = data.message ?? data.error ?? "Xin lỗi, có lỗi xảy ra. Thử lại nhé!";
        if (data.type === "widget" && data.ticker) {
          reply =
            data.data?.technical?.aiInsight ??
            data.data?.fundamental?.aiInsight ??
            "Em nhan dien ma **" + data.ticker + "** va da phan tich nhanh. Dai ca co the nhap truc tiep ma " + data.ticker + " de mo 4 the chi tiet.";
        }
        setExtraMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "bot", text: reply, createdAt: Date.now() },
        ]);
      } catch {
        setExtraMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "bot", text: "Mất kết nối server. Vui lòng thử lại.", createdAt: Date.now() },
        ]);
      } finally {
        setFreeTextPending(false);
      }
    },
    [chatCount, isAuthenticated, setChatCount]
  );

  return (
    <MainLayout disableSwipe>
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl border flex items-center justify-center" style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}>
                <span className="text-base">🤖</span>
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>ADN AI — Tư Vấn Đầu Tư</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                Phân tích TA · FA · Tâm lý · Tin tức • Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {limit !== Infinity && (
              <div className="flex items-center gap-2">
                <div className="w-16 sm:w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <motion.div
                    animate={{ width: `${limitPercent}%` }}
                    className="h-full rounded-full"
                    style={{ background: limitPercent >= 80 ? "var(--danger)" : "#16a34a" }}
                  />
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{chatCount}/{limit}</span>
              </div>
            )}
            {limit === Infinity && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--primary)" }}>
                <Crown className="w-3 h-3" />
                <span>VIP</span>
              </div>
            )}

            <button
              onClick={() => { if (confirm("Xóa toàn bộ lịch sử chat?")) { setExtraMessages([]); clearMessages(); } }}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(192,57,43,0.25)";
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(192,57,43,0.10)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <Trash2 className="w-3 h-3" />
              Xóa
            </button>
          </div>
        </div>

        {/* Investment Chat */}
        <div className="flex-1 min-h-0 overflow-hidden p-3 pb-24 md:p-6 md:pb-6">
          <InvestmentChat
            onSendFreeText={isLimitReached ? undefined : handleFreeText}
            freeTextLoading={freeTextPending}
            extraMessages={extraMessages}
            disableInput={isLimitReached}
            disableReason="Bạn đã hết lượt tư vấn. Nâng cấp VIP để tiếp tục ngay."
          />
        </div>

        {showLowQuotaWarning && (
          <div
            className="mx-3 sm:mx-6 mb-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
              Cảnh báo: chỉ còn {remaining} lượt miễn phí hôm nay
            </p>
          </div>
        )}

        {/* Limit reached banner */}
        {isLimitReached && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 sm:mx-6 mb-3 px-3 sm:px-4 py-3 rounded-xl flex items-center gap-2 sm:gap-3"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "#f59e0b" }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
                Hết lượt tư vấn trong ngày
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Nâng cấp VIP để mở khóa ngay và tiếp tục quét tín hiệu không gián đoạn.
              </p>
            </div>
            <a
              href="/pricing"
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(245,158,11,0.20)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.30)" }}
            >
              Nâng cấp →
            </a>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
}

