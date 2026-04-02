import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  chatCount: number;
  addMessage: (message: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  setChatCount: (count: number) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,
      chatCount: 0,
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message].slice(-100),
        })),
      setLoading: (loading) => set({ isLoading: loading }),
      setChatCount: (count) => set({ chatCount: count }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "adn-chat-v1",
      partialize: (state) => ({
        messages: state.messages.slice(-50),
        chatCount: state.chatCount,
      }),
    }
  )
);
