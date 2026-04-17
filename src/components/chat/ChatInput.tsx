"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const QUICK_COMMANDS = [
  { label: "/ta HPG", value: "/ta HPG" },
  { label: "/fa FPT", value: "/fa FPT" },
  { label: "/news VNM", value: "/news VNM" },
  { label: "/tamly TCB", value: "/tamly TCB" },
  { label: "Thị trường hôm nay?", value: "Thị trường hôm nay như thế nào?" },
];

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="border-t p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Quick commands */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => {
              setValue(cmd.value);
              textareaRef.current?.focus();
            }}
            disabled={disabled}
            className="flex-shrink-0 text-[12px] font-medium border border-[var(--border)] hover:border-emerald-500/40 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-emerald-500/5 transition-all disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={disabled}
            placeholder={placeholder ?? "Hỏi Hệ thống về chứng khoán... (VD: PTKT HPG)"}
            rows={1}
            className="w-full resize-none bg-[var(--surface)] border border-[var(--border)] focus:border-emerald-500/50 text-sm px-4 py-3 rounded-xl outline-none transition-all placeholder:text-[var(--text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "var(--text-primary)" }}
          />
          {value.length > 0 && (
            <span className="absolute right-3 bottom-2.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {value.length}/2000
            </span>
          )}
        </div>

        <motion.button
          whileHover={{ scale: disabled || !value.trim() ? 1 : 1.05 }}
          whileTap={{ scale: disabled || !value.trim() ? 1 : 0.95 }}
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            disabled || !value.trim()
              ? "cursor-not-allowed"
              : "bg-emerald-500 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 animate-pulse-glow"
          }`}
          style={
            disabled || !value.trim()
              ? { background: "var(--surface-2)", color: "var(--text-muted)" }
              : { color: "var(--on-primary)" }
          }
        >
          {disabled ? (
            <Sparkles className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      <p className="text-[12px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
        Enter để gửi · Shift+Enter xuống dòng
      </p>
    </div>
  );
}
