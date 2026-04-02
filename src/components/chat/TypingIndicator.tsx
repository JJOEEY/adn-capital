import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mt-1">
        <Bot className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="bg-neutral-900 border border-emerald-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="text-xs text-neutral-500 ml-1">Đang phân tích...</span>
        </div>
      </div>
    </div>
  );
}
