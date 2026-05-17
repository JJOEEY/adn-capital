"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AidenMessageRendererProps = {
  text: string;
  className?: string;
  streaming?: boolean;
  onTypingComplete?: () => void;
};

const NUMBERED_SECTION_PATTERN = /([^\n])\s+(?=(?:\*\*)?(?:[1-9]|10)\.\s+[A-ZÀ-ỸĐ])/g;
const INLINE_MARKDOWN_HEADING_PATTERN = /([^\n])\s+(?=#{1,4}\s+)/g;
const BROKEN_BOLD_NUMBERED_HEADING_PATTERN = /\*\*((?:[1-9]|10)\.)\s*\n+\s*([^*\n]+?)\*\*/g;
const BROKEN_NUMBER_ONLY_HEADING_PATTERN = /^\*\*\s*((?:[1-9]|10)\.)\s*$/;
const BROKEN_HEADING_TITLE_PATTERN = /^(.+?)\s*\*\*\s*$/;
const HEADING_SPLIT_PATTERNS: Array<[RegExp, string]> = [
  [/^\*\*((?:[1-9]|10)\.\s+Giá và cấu trúc kỹ thuật)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*((?:[1-9]|10)\.\s+Vùng giá cần theo dõi)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*((?:[1-9]|10)\.\s+Định giá và chất lượng doanh nghiệp)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*((?:[1-9]|10)\.\s+Hành động phù hợp)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^((?:[1-9]|10)\.\s+Giá và cấu trúc kỹ thuật)\s+(Giá hiện tại:.*)$/, "### $1\n$2"],
  [/^((?:[1-9]|10)\.\s+Vùng giá cần theo dõi)\s+(Hỗ trợ:.*)$/, "### $1\n$2"],
  [/^((?:[1-9]|10)\.\s+Định giá và chất lượng doanh nghiệp)\s+(Chỉ số định giá.*)$/, "### $1\n$2"],
  [/^((?:[1-9]|10)\.\s+Hành động phù hợp)\s+(Nếu .*)$/, "### $1\n$2"],
  [/^\*\*(Điểm đáng chú ý)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*(Rủi ro)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*(Hành động phù hợp)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*(Định giá và Phân tích cơ bản)\*\*\s*(.*)$/, "### $1\n$2"],
  [/^\*\*(ADNCore và ADN ART)\*\*\s*(.*)$/, "### $1\n$2"],
];

function normalizeAidenMarkdown(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(BROKEN_BOLD_NUMBERED_HEADING_PATTERN, "**$1 $2**")
    .replace(INLINE_MARKDOWN_HEADING_PATTERN, "$1\n\n")
    .replace(NUMBERED_SECTION_PATTERN, "$1\n\n")
    .replace(/([.!?])\s+(?=(?:\*\*)?(?:Điểm đáng chú ý|Rủi ro|Hành động phù hợp|Định giá và Phân tích cơ bản|ADNCore và ADN ART))/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return repairSplitNumberedHeadings(normalized);
}

function repairSplitNumberedHeadings(text: string): string {
  const lines = text.split("\n");
  const repaired: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const numberOnlyMatch = line.trim().match(BROKEN_NUMBER_ONLY_HEADING_PATTERN);

    if (!numberOnlyMatch) {
      repaired.push(line);
      continue;
    }

    let titleIndex = index + 1;
    while (titleIndex < lines.length && lines[titleIndex].trim() === "") {
      titleIndex += 1;
    }

    const titleMatch = lines[titleIndex]?.trim().match(BROKEN_HEADING_TITLE_PATTERN);
    if (titleMatch) {
      repaired.push(`### ${numberOnlyMatch[1]} ${titleMatch[1].trim()}`);
      index = titleIndex;
      continue;
    }

    repaired.push(`### ${numberOnlyMatch[1]}`);
  }

  return repaired.join("\n");
}

function promoteNumberedSections(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      for (const [pattern, replacement] of HEADING_SPLIT_PATTERNS) {
        if (pattern.test(trimmed)) {
          return trimmed.replace(pattern, replacement).replace(/\n\s*$/g, "");
        }
      }
      const boldNumberedMatch = trimmed.match(/^\*\*([1-9]\.\s+\S.*?)\*\*$/);
      if (boldNumberedMatch) {
        return `### ${boldNumberedMatch[1]}`;
      }
      const unclosedBoldNumberedMatch = trimmed.match(/^\*\*((?:[1-9]|10)\.\s+\S.*)$/);
      if (unclosedBoldNumberedMatch) {
        return `### ${unclosedBoldNumberedMatch[1].replace(/\*\*$/g, "")}`;
      }
      if (/^[1-9]\.\s+\S/.test(trimmed)) {
        return `### ${trimmed.replace(/^\*\*|\*\*$/g, "")}`;
      }
      return line;
    })
    .join("\n");
}

export function formatAidenResponseText(text: string): string {
  const normalized = normalizeAidenMarkdown(text || "");
  return promoteNumberedSections(normalized);
}

export function AidenMessageRenderer({ text, className = "", streaming = false, onTypingComplete }: AidenMessageRendererProps) {
  const formattedText = useMemo(() => formatAidenResponseText(text), [text]);
  const [visibleText, setVisibleText] = useState(formattedText);
  const onTypingCompleteRef = useRef(onTypingComplete);

  useEffect(() => {
    onTypingCompleteRef.current = onTypingComplete;
  }, [onTypingComplete]);

  useEffect(() => {
    if (!streaming) {
      setVisibleText(formattedText);
      return;
    }

    let timer: number | undefined;

    setVisibleText((previous) => (formattedText.startsWith(previous) ? previous : ""));

    const tick = () => {
      let shouldContinue = true;
      setVisibleText((previous) => {
        const base = formattedText.startsWith(previous) ? previous : "";
        if (base.length >= formattedText.length) {
          shouldContinue = false;
          onTypingCompleteRef.current?.();
          return formattedText;
        }

        const nextLength = Math.min(formattedText.length, base.length + 4);
        const next = formattedText.slice(0, nextLength);
        if (nextLength >= formattedText.length) {
          shouldContinue = false;
          window.setTimeout(() => onTypingCompleteRef.current?.(), 0);
        }
        return next;
      });
      if (shouldContinue) {
        timer = window.setTimeout(tick, 14);
      }
    };

    timer = window.setTimeout(tick, 14);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [formattedText, streaming]);

  return (
    <div className={`aiden-message-renderer break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-base font-black leading-snug first:mt-0" style={{ color: "var(--text-primary)" }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-base font-black leading-snug first:mt-0" style={{ color: "var(--text-primary)" }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-[15px] font-black leading-snug first:mt-0" style={{ color: "var(--text-primary)" }}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1 mt-2.5 text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed" style={{ color: "inherit" }}>
              {children}
            </p>
          ),
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-black" style={{ color: "var(--text-primary)" }}>
              {children}
            </strong>
          ),
        }}
      >
        {streaming ? visibleText : formattedText}
      </ReactMarkdown>
    </div>
  );
}
