"use client";

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/types";
import { StockChart } from "./StockChart";
import { TickerWidget } from "./TickerWidget";

interface ChatBubbleProps {
  message: ChatMessage;
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="text-emerald-400 font-bold text-sm mt-2 mb-0.5">
              {line.slice(3)}
            </p>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <p key={i} className="text-neutral-200 font-semibold text-sm mt-1.5">
              {line.slice(4)}
            </p>
          );
        }
        if (line.startsWith("#### ")) {
          return (
            <p key={i} className="text-neutral-300 font-medium text-xs mt-1">
              {line.slice(5)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          const content = line.slice(2);
          return (
            <p key={i} className="text-sm text-neutral-200 pl-3 leading-relaxed flex gap-2">
              <span className="text-emerald-500 mt-1 flex-shrink-0">▸</span>
              <span>{renderInlineBold(content)}</span>
            </p>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <p key={i} className="text-sm text-neutral-200 pl-3 leading-relaxed flex gap-2">
                <span className="text-emerald-400 font-mono text-xs mt-0.5 flex-shrink-0 font-bold">
                  {match[1]}.
                </span>
                <span>{renderInlineBold(match[2])}</span>
              </p>
            );
          }
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1.5" />;
        }
        return (
          <p key={i} className="text-sm text-neutral-200 leading-relaxed">
            {renderInlineBold(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} ${!isUser && (message.chartStock || message.widgetData) ? "flex-wrap" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1 ${
          isUser
            ? "bg-neutral-700 border border-neutral-600"
            : "bg-emerald-500/15 border border-emerald-500/30"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-neutral-300" />
        ) : (
          <Bot className="w-4 h-4 text-emerald-400" />
        )}
      </div>

      {/* Bubble or Widget */}
      {!isUser && message.widgetData ? (
        <div className="flex-1 min-w-0 ml-0">
          <TickerWidget ticker={message.widgetData.ticker} data={message.widgetData.data} />
        </div>
      ) : (
        <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
          <div
            className="px-4 py-3 rounded-2xl"
            style={isUser
              ? { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "16px 4px 16px 16px" }
              : { background: "var(--surface)", border: "1px solid rgba(16,185,129,0.20)", borderRadius: "4px 16px 16px 16px" }
            }
          >
            {isUser ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{message.content}</p>
            ) : (
              <SimpleMarkdown text={message.content} />
            )}
          </div>

          <span className="text-[12px] px-1" style={{ color: "var(--text-muted)" }}>
            {new Date(message.createdAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Chart – full width */}
      {!isUser && message.chartStock && (
        <div className="w-full -mt-1 ml-11">
          <StockChart
            symbol={message.chartStock}
            exchange={message.chartExchange}
          />
        </div>
      )}
    </motion.div>
  );
}
