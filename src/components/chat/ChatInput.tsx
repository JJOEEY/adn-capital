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
  { label: "Thị trường hôm nay?", value: "Thị trường hôm nay như thế nào đại ca ơi?" },
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
    <div className="border-t border-neutral-800/60 bg-neutral-950/95 backdrop-blur-sm p-4">
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
            className="flex-shrink-0 text-[10px] font-medium text-neutral-400 border border-neutral-800 hover:border-emerald-500/40 hover:text-emerald-400 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-emerald-500/5 transition-all disabled:opacity-40"
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
            placeholder={placeholder ?? "Hỏi em về chứng khoán... (VD: PTKT HPG)"}
            rows={1}
            className="w-full resize-none bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 text-neutral-100 placeholder-neutral-600 text-sm px-4 py-3 rounded-xl outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {value.length > 0 && (
            <span className="absolute right-3 bottom-2.5 text-[10px] text-neutral-600">
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
              ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
              : "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 animate-pulse-glow"
          }`}
        >
          {disabled ? (
            <Sparkles className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      <p className="text-[10px] text-neutral-700 mt-2 text-center">
        Enter để gửi · Shift+Enter xuống dòng
      </p>
    </div>
  );
}
