"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RotateCcw, Lightbulb } from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

interface Analysis {
  overallRating: string;
  strengths: string[];
  weaknesses: string[];
  recurringMistakes: string[];
  recommendations: string[];
}
interface Cached {
  analysis: Analysis;
  tradeCount: number;
  at: string;
}

const SECTIONS: { key: keyof Analysis; label: string; icon: typeof CheckCircle2; color: string }[] = [
  { key: "strengths", label: "Điểm mạnh", icon: CheckCircle2, color: "#16a34a" },
  { key: "weaknesses", label: "Điểm yếu", icon: AlertTriangle, color: "#f59e0b" },
  { key: "recurringMistakes", label: "Sai lầm lặp lại", icon: RotateCcw, color: "var(--danger)" },
  { key: "recommendations", label: "Khuyến nghị", icon: Lightbulb, color: "#3b82f6" },
];

export function ProactiveInsight({ tradeCount }: { tradeCount: number }) {
  const { dbUser } = useCurrentDbUser();
  const storeKey = dbUser?.id ? `adn-journal-insight:${dbUser.id}` : null;
  const [cached, setCached] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const loadedKey = useRef<string | null>(null);

  // Đọc cache (localStorage, theo user) — tránh gọi lại Gemini mỗi lần mở trang
  useEffect(() => {
    if (!storeKey || loadedKey.current === storeKey) return;
    loadedKey.current = storeKey;
    try {
      const raw = localStorage.getItem(storeKey);
      setCached(raw ? (JSON.parse(raw) as Cached) : null);
    } catch {
      setCached(null);
    }
  }, [storeKey]);

  const analyze = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/journal/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi phân tích");
      const next: Cached = {
        analysis: data.analysis,
        tradeCount: data.stats?.totalTrades ?? tradeCount,
        at: new Date().toISOString(),
      };
      setCached(next);
      setExpanded(true);
      if (storeKey) {
        try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* quota */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  // Chưa có insight + chưa đủ lệnh → nhắc nhẹ
  if (!cached && tradeCount < 3) {
    return (
      <div className="rounded-2xl border p-3.5 flex items-center gap-2.5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          Ghi đủ <b>3 lệnh</b> để AIDEN đọc hành vi & tâm lý giao dịch của anh/chị.
        </p>
      </div>
    );
  }

  // Chưa có insight nhưng đủ lệnh → CTA chủ động (1 chạm)
  if (!cached) {
    return (
      <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: "rgba(16,185,129,0.12)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "#10b981" }} />
            </div>
            <div>
              <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>AIDEN đọc hành vi giao dịch</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Điểm mạnh, điểm yếu, sai lầm lặp lại & khuyến nghị riêng cho anh/chị.</p>
            </div>
          </div>
          <button
            onClick={analyze}
            disabled={loading}
            className="text-sm font-bold px-4 py-2 rounded-xl transition-transform active:scale-95 disabled:opacity-60"
            style={{ background: "var(--primary)", color: "#EBE2CF" }}
          >
            {loading ? "Đang đọc…" : "Phân tích ngay"}
          </button>
        </div>
        {error && <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    );
  }

  // Có insight → hiển thị chủ động trong luồng
  const a = cached.analysis;
  const stale = tradeCount > cached.tradeCount;
  const newCount = tradeCount - cached.tradeCount;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "#10b981" }} />
            <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>AIDEN nhận định tâm lý</h3>
          </div>
          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-60"
            style={{ color: stale ? "#10b981" : "var(--text-muted)", background: stale ? "rgba(16,185,129,0.1)" : "transparent" }}
            title="Đọc lại với dữ liệu mới nhất"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Đang đọc…" : stale ? `Cập nhật (${newCount} lệnh mới)` : "Làm mới"}
          </button>
        </div>

        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a.overallRating}</p>
        {error && <p className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>{error}</p>}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[12px] font-semibold mt-2.5 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          {expanded ? "Thu gọn" : "Xem chi tiết"}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3">
              {SECTIONS.map((s) => {
                const items = a[s.key] as string[];
                if (!Array.isArray(items) || items.length === 0) return null;
                const Icon = s.icon;
                return (
                  <div key={s.key} className="rounded-xl border p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-1.5 mb-1.5" style={{ color: s.color }}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-bold">{s.label}</span>
                    </div>
                    <ul className="space-y-1">
                      {items.map((it, i) => (
                        <li key={i} className="text-xs leading-relaxed flex gap-1.5" style={{ color: "var(--text-secondary)" }}>
                          <span style={{ color: s.color }}>•</span>
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
