"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { StockChart } from "@/components/chat/StockChart";
import { Send, Bot, ChartCandlestick } from "lucide-react";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = useMemo(() => (params?.ticker ?? "VNINDEX").toUpperCase(), [params?.ticker]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: `Hệ thống đang theo dõi mã ${ticker}. Nhà đầu tư muốn phân tích tín hiệu GIỮ/MUA/BÁN?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const prompt = `${text}\n\nMã cổ phiếu đang xem: ${ticker}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", text: data.message || data.error || "Hệ thống chưa có phản hồi." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Lỗi kết nối AI. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <ChartCandlestick className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
            Phân tích chi tiết: {ticker}
          </h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section className="xl:col-span-2 rounded-2xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <StockChart symbol={ticker} />
          </section>

          <section className="rounded-2xl border flex flex-col min-h-[500px]" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <Bot className="w-4 h-4" style={{ color: "#16a34a" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>AI Talk</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[92%] text-sm px-3 py-2 rounded-xl whitespace-pre-wrap"
                    style={message.role === "user"
                      ? { background: "var(--primary)", color: "#EBE2CF" }
                      : { background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSend();
                  }}
                  placeholder={`Hỏi AI về ${ticker}...`}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="px-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#EBE2CF" }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
