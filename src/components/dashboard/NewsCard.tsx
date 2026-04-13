"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Newspaper } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { NewsItem } from "@/types";

interface NewsCardProps {
  news: NewsItem[];
}

const SentimentIcon = ({ sentiment }: { sentiment: NewsItem["sentiment"] }) => {
  if (sentiment === "positive") return <TrendingUp className="w-3 h-3" style={{ color: "#16a34a" }} />;
  if (sentiment === "negative") return <TrendingDown className="w-3 h-3" style={{ color: "var(--danger)" }} />;
  return <Minus className="w-3 h-3" style={{ color: "var(--text-muted)" }} />;
};

function sentimentBorderStyle(sentiment: NewsItem["sentiment"]) {
  if (sentiment === "positive") return "rgba(22,163,74,0.50)";
  if (sentiment === "negative") return "rgba(192,57,43,0.50)";
  return "var(--border)";
}

function sentimentIconBg(sentiment: NewsItem["sentiment"]) {
  if (sentiment === "positive") return "rgba(22,163,74,0.10)";
  if (sentiment === "negative") return "rgba(192,57,43,0.10)";
  return "var(--surface-2)";
}

export function NewsGrid({ news }: NewsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {news.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <div style={{ borderLeft: `2px solid ${sentimentBorderStyle(item.sentiment)}` }}>
          <Card className="p-4 transition-all cursor-pointer">
            <div className="flex items-start gap-2 mb-2">
              <div
                className="mt-0.5 p-1 rounded-md flex-shrink-0"
                style={{ background: sentimentIconBg(item.sentiment) }}
              >
                <SentimentIcon sentiment={item.sentiment} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
                  {item.title}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed line-clamp-2 pl-7" style={{ color: "var(--text-muted)" }}>
              {item.summary}
            </p>
            <div className="flex items-center gap-2 mt-2.5 pl-7">
              <span className="text-[12px] px-2 py-0.5 rounded-md" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                {item.category}
              </span>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{item.time}</span>
            </div>
          </Card>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function NewsCardEmpty() {
  return (
    <Card className="p-8 text-center">
      <Newspaper className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--border)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chưa có tin tức</p>
    </Card>
  );
}
