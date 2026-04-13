"use client";

import { useState } from "react";
import useSWR from "swr";
import { Newspaper, Sun, Moon, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

type Tone = "emerald" | "red" | "blue" | "amber" | "indigo" | "purple";

const TONE = {
  emerald: { text: "#16a34a", bg: "rgba(22,163,74,0.10)" },
  red: { text: "var(--danger)", bg: "rgba(192,57,43,0.10)" },
  blue: { text: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
  amber: { text: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  indigo: { text: "#6366f1", bg: "rgba(99,102,241,0.10)" },
  purple: { text: "#a855f7", bg: "rgba(168,85,247,0.10)" },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 *  Morning Intelligence — Tin tức buổi sáng lúc 8h
 * ═══════════════════════════════════════════════════════════════════════════ */
export function MorningNews() {
  const { data, isLoading, error } = useSWR("/api/news?type=morning", fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 300_000,
  });
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <NewsSkeleton title="MORNING INTELLIGENCE" icon={<Sun className="w-4 h-4" style={{ color: TONE.amber.text }} />} />;
  if (error || !data) return null;

  return (
    <div className="bg-[var(--surface)] border rounded-2xl overflow-hidden" style={{ borderColor: "rgba(245,158,11,0.20)" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 transition-colors"
        style={{ background: expanded ? "var(--surface-2)" : "transparent" }}
      >
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4" style={{ color: TONE.amber.text }} />
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: TONE.amber.text }}>
            Morning Intelligence
          </span>
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{data.date}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Chỉ số tham chiếu */}
          {data.reference_indices && data.reference_indices.length > 0 && (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Chỉ số tham chiếu
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.reference_indices.map((idx: { name: string; value: number; change_pct: number }) => (
                  <div
                    key={idx.name}
                    className="flex items-center justify-between rounded-lg px-3 py-2 border"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{idx.name}</span>
                    <div className="text-right">
                      <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                        {typeof idx.value === "number" ? idx.value.toLocaleString("vi-VN") : idx.value}
                      </span>
                      <span
                        className="text-[12px] ml-1.5"
                        style={{
                          color: idx.change_pct > 0 ? TONE.emerald.text : idx.change_pct < 0 ? TONE.red.text : "var(--text-muted)",
                        }}
                      >
                        {idx.change_pct > 0 ? "+" : ""}
                        {typeof idx.change_pct === "number" ? idx.change_pct.toFixed(2) : idx.change_pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thị trường Việt Nam */}
          <BulletSection
            title="Thị trường Việt Nam"
            icon={<TrendingUp className="w-3.5 h-3.5" style={{ color: TONE.emerald.text }} />}
            items={data.vn_market}
            tone="emerald"
          />

          {/* Vĩ mô */}
          <BulletSection
            title="Vĩ mô trong nước & quốc tế"
            icon={<Newspaper className="w-3.5 h-3.5" style={{ color: TONE.blue.text }} />}
            items={data.macro}
            tone="blue"
          />

          {/* Rủi ro / Cơ hội */}
          <BulletSection
            title="Rủi ro / Cơ hội"
            icon={<AlertTriangle className="w-3.5 h-3.5" style={{ color: TONE.amber.text }} />}
            items={data.risk_opportunity}
            tone="amber"
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  EOD Flash Note — Tổng hợp cuối ngày lúc 19h
 * ═══════════════════════════════════════════════════════════════════════════ */
export function EODSummary() {
  const { data, isLoading, error } = useSWR("/api/news?type=eod", fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 300_000,
  });
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <NewsSkeleton title="EOD FLASH NOTE" icon={<Moon className="w-4 h-4" style={{ color: TONE.indigo.text }} />} />;
  if (error || !data) return null;

  const pctColor = (data.change_pct ?? 0) >= 0 ? TONE.emerald.text : TONE.red.text;

  return (
    <div className="bg-[var(--surface)] border rounded-2xl overflow-hidden" style={{ borderColor: "rgba(99,102,241,0.20)" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 transition-colors"
        style={{ background: expanded ? "var(--surface-2)" : "transparent" }}
      >
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4" style={{ color: TONE.indigo.text }} />
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: TONE.indigo.text }}>
            EOD Flash Note
          </span>
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{data.date}</span>
          {data.vnindex && (
            <span className="text-[12px] font-bold" style={{ color: pctColor }}>
              VNI {data.vnindex.toFixed(1)} ({data.change_pct > 0 ? "+" : ""}{data.change_pct}%)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Quick stats */}
          {data.breadth && (
            <div className="grid grid-cols-3 gap-2">
              <StatChip label="Tăng" value={data.breadth.up} tone="emerald" />
              <StatChip label="Giảm" value={data.breadth.down} tone="red" />
              <StatChip label="TK (Tỷ)" value={data.liquidity ?? "N/A"} tone="blue" />
            </div>
          )}

          {/* Tổng kết phiên */}
          {data.session_summary && (
            <TextBlock title="Tổng kết phiên" text={data.session_summary} tone="indigo" />
          )}

          {/* Thanh khoản chi tiết */}
          {data.liquidity_detail && (
            <TextBlock title="Thanh khoản" text={data.liquidity_detail} tone="blue" />
          )}

          {/* Ngoại flow */}
          {data.foreign_flow && (
            <TextBlock title="Nhà đầu tư nước ngoài" text={data.foreign_flow} tone="amber" />
          )}

          {/* Giao dịch nổi bật */}
          {data.notable_trades && (
            <TextBlock title="Giao dịch nổi bật" text={data.notable_trades} tone="purple" />
          )}

          {/* Nhận định */}
          {data.outlook && (
            <div className="rounded-xl p-3 border" style={{ background: TONE.indigo.bg, borderColor: "rgba(99,102,241,0.20)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3.5 h-3.5" style={{ color: TONE.indigo.text }} />
                <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: TONE.indigo.text }}>
                  Nhận định phiên tới
                </span>
              </div>
              <p className="text-xs leading-relaxed italic" style={{ color: "var(--text-secondary)" }}>
                &ldquo;{data.outlook}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  Shared sub-components
 * ═══════════════════════════════════════════════════════════════════════════ */

function BulletSection({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items?: string[];
  tone: Tone;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: TONE[tone].text }}>
          {title}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <span className="mt-0.5" style={{ color: TONE[tone].text }}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: string | number; tone: Tone }) {
  return (
    <div className="border rounded-lg px-3 py-2 text-center" style={{ background: TONE[tone].bg, borderColor: "var(--border)" }}>
      <p className="text-lg font-black" style={{ color: TONE[tone].text }}>{value}</p>
      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function TextBlock({ title, text, tone }: { title: string; text: string; tone: Tone }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: TONE[tone].text }}>
        {title}
      </p>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}

function NewsSkeleton({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
        <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
      </div>
    </div>
  );
}
