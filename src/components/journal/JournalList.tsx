"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Clock, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { JournalEntry } from "@/types";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface JournalListProps {
  entries: JournalEntry[];
  onDeleted: (id: string) => void;
}

type Filter = "all" | "BUY" | "SELL";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Tất cả",
  BUY: "Mua",
  SELL: "Bán",
};

export function JournalList({ entries, onDeleted }: JournalListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa nhật ký này?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
      onDeleted(id);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = entries.filter((e) => {
    if (filter === "all") return true;
    return e.action === filter;
  });

  if (entries.length === 0) {
    return (
      <Card className="p-12 text-center">
        <BookOpen className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
        <p className="text-sm font-medium text-neutral-500">Chưa có nhật ký nào</p>
        <p className="text-xs text-neutral-600 mt-1">
          Ghi lại giao dịch đầu tiên để AI học hành vi của đại ca nhé!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => {
          const count =
            f === "all" ? entries.length : entries.filter((e) => e.action === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                filter === f
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-neutral-800/80 text-neutral-500 border-neutral-700 hover:border-neutral-600 hover:text-neutral-300"
              }`}
            >
              {FILTER_LABELS[f]}
              <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.map((entry, i) => {
          const psychColor =
            entry.psychology === "FOMO" || entry.psychology === "Cảm tính"
              ? "text-yellow-400"
              : entry.psychology === "Có kế hoạch"
              ? "text-emerald-400"
              : entry.psychology === "Hoảng loạn"
              ? "text-red-400"
              : "text-neutral-300";

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className={`overflow-hidden border-l-2 transition-all ${
                  entry.action === "BUY" ? "border-l-emerald-500" : "border-l-red-500"
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
                      entry.action === "BUY"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {entry.action === "BUY" ? "M" : "B"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-base font-black text-white font-mono">
                        {entry.ticker}
                      </span>
                      <Badge variant={entry.action === "BUY" ? "emerald" : "red"}>
                        {entry.action === "BUY" ? "Mua" : "Bán"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 mb-2">
                      <div>
                        <p className="text-[10px] text-neutral-600">Giá</p>
                        <p className="text-xs font-mono font-semibold text-neutral-200">
                          {entry.price.toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-600">KL</p>
                        <p className="text-xs font-mono font-semibold text-neutral-200">
                          {entry.quantity.toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-600">Tâm lý</p>
                        <p className={`text-xs truncate font-medium ${psychColor}`}>
                          {entry.psychology}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-2.5 h-2.5 text-neutral-700" />
                      <span className="text-[10px] text-neutral-600">
                        {format(new Date(entry.createdAt), "dd/MM/yy HH:mm", {
                          locale: vi,
                        })}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting === entry.id}
                    onClick={() => handleDelete(entry.id)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-neutral-600">
          Không có lệnh nào phù hợp với bộ lọc này
        </div>
      )}
    </div>
  );
}
