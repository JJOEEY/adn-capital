"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle, XCircle, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AnalysisResult {
  overallRating: string;
  strengths: string[];
  weaknesses: string[];
  recurringMistakes: string[];
  recommendations: string[];
}

interface Stats {
  totalTrades: number;
  buyCount: number;
  sellCount: number;
}

export function PsychologyAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: AnalysisResult; stats: Stats } | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/journal/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi phân tích");
      setResult(data);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant="purple"
        size="lg"
        loading={loading}
        onClick={handleAnalyze}
        className="w-full"
      >
        <Brain className="w-4 h-4" />
        {loading ? "AI đang phân tích tâm lý giao dịch..." : "Phân Tích Tâm Lý Giao Dịch"}
      </Button>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3"
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Stats overview */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Tổng lệnh", value: result.stats.totalTrades, color: "text-neutral-200", suffix: "" },
                { label: "Lệnh Mua", value: result.stats.buyCount, color: "text-emerald-400", suffix: "" },
                { label: "Lệnh Bán", value: result.stats.sellCount, color: "text-red-400", suffix: "" },
              ].map((stat) => (
                <Card key={stat.label} className="p-3 text-center">
                  <p className={`text-lg font-black font-mono ${stat.color}`}>
                    {stat.value}{stat.suffix}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">{stat.label}</p>
                </Card>
              ))}
            </div>

            {/* Overall Rating */}
            <Card glow="purple" className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Đánh Giá Tổng Thể</h3>
                </div>
                <button onClick={() => setExpanded(!expanded)} className="text-neutral-600 hover:text-neutral-300 transition-colors">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {result.analysis.overallRating}
              </p>
            </Card>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <Card glow="emerald" className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-bold text-emerald-400">Điểm Mạnh</h4>
                      </div>
                      <ul className="space-y-2">
                        {result.analysis.strengths.map((s, i) => (
                          <li key={i} className="flex gap-2 text-xs text-neutral-300 leading-relaxed">
                            <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </Card>

                    {/* Weaknesses */}
                    <Card glow="red" className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <h4 className="text-sm font-bold text-red-400">Điểm Yếu</h4>
                      </div>
                      <ul className="space-y-2">
                        {result.analysis.weaknesses.map((w, i) => (
                          <li key={i} className="flex gap-2 text-xs text-neutral-300 leading-relaxed">
                            <span className="text-red-500 mt-0.5 flex-shrink-0">✗</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>

                  {/* Recurring mistakes */}
                  <Card glow="yellow" className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <h4 className="text-sm font-bold text-yellow-400">Sai Lầm Lặp Lại</h4>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {result.analysis.recurringMistakes.map((m, i) => (
                        <li key={i} className="flex gap-2 text-xs text-neutral-300 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2 leading-relaxed">
                          <span className="text-yellow-500 flex-shrink-0">⚠</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </Card>

                  {/* Recommendations */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-blue-400" />
                      <h4 className="text-sm font-bold text-blue-400">Khuyến Nghị Cải Thiện</h4>
                    </div>
                    <ol className="space-y-2">
                      {result.analysis.recommendations.map((r, i) => (
                        <li key={i} className="flex gap-3 text-xs text-neutral-300 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {r}
                        </li>
                      ))}
                    </ol>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
