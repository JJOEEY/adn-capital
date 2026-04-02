"use client";

import { useChatStore } from "@/store/chatStore";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { generateId, USAGE_LIMITS } from "@/lib/utils";

export function useChat() {
  const { role, isAuthenticated } = useCurrentDbUser();
  const { messages, isLoading, chatCount, addMessage, setLoading, setChatCount } =
    useChatStore();

  const limit = USAGE_LIMITS[role] ?? 3;
  const isLimitReached = limit !== Infinity && chatCount >= limit;

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isLimitReached) return;

    const userMsg = {
      id: generateId(),
      content,
      role: "user" as const,
      createdAt: new Date().toISOString(),
    };

    addMessage(userMsg);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          guestUsage: isAuthenticated ? undefined : chatCount,
        }),
      });

      const data = await res.json() as {
        message?: string;
        error?: string;
        newUsage?: number;
        chartStock?: string;
        chartExchange?: string;
      };

      if (res.status === 429) {
        addMessage({
          id: generateId(),
          content: data.message ?? "Đại ca đã hết lượt chat rồi ạ!",
          role: "assistant",
          createdAt: new Date().toISOString(),
        });
        if (limit !== Infinity) setChatCount(limit);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Lỗi không xác định");
      }

      addMessage({
        id: generateId(),
        content: data.message ?? "Em không trả lời được lúc này ạ",
        role: "assistant",
        createdAt: new Date().toISOString(),
        chartStock: data.chartStock,
        chartExchange: data.chartExchange,
      });

      if (data.newUsage !== undefined) {
        setChatCount(data.newUsage);
      } else {
        setChatCount(chatCount + 1);
      }
    } catch (error) {
      addMessage({
        id: generateId(),
        content: `Lỗi kết nối đại ca ơi 😢 Thử lại sau nhé! (${
          error instanceof Error ? error.message : "Unknown error"
        })`,
        role: "assistant",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    chatCount,
    limit,
    isLimitReached,
    sendMessage,
  };
}
