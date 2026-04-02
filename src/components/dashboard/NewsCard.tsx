"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Newspaper } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { NewsItem } from "@/types";

interface NewsCardProps {
  news: NewsItem[];
}

const SentimentIcon = ({ sentiment }: { sentiment: NewsItem["sentiment"] }) => {
  if (sentiment === "positive") return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (sentiment === "negative") return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-neutral-400" />;
};

const sentimentBg: Record<NewsItem["sentiment"], string> = {
  positive: "border-l-emerald-500/50",
  negative: "border-l-red-500/50",
  neutral: "border-l-neutral-600",
};

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
          <Card
            className={`p-4 hover:border-neutral-700 transition-all cursor-pointer border-l-2 ${sentimentBg[item.sentiment]}`}
          >
            <div className="flex items-start gap-2 mb-2">
              <div
                className={`mt-0.5 p-1 rounded-md flex-shrink-0 ${
                  item.sentiment === "positive"
                    ? "bg-emerald-500/10"
                    : item.sentiment === "negative"
                    ? "bg-red-500/10"
                    : "bg-neutral-800"
                }`}
              >
                <SentimentIcon sentiment={item.sentiment} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-100 leading-snug line-clamp-2">
                  {item.title}
                </p>
              </div>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2 pl-7">
              {item.summary}
            </p>
            <div className="flex items-center gap-2 mt-2.5 pl-7">
              <span className="text-[10px] text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-md">
                {item.category}
              </span>
              <span className="text-[10px] text-neutral-600">{item.time}</span>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export function NewsCardEmpty() {
  return (
    <Card className="p-8 text-center">
      <Newspaper className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
      <p className="text-sm text-neutral-500">Chưa có tin tức</p>
    </Card>
  );
}
