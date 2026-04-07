"use client";

import { useState } from "react";
import useSWR from "swr";
import { Newspaper, Sun, Moon, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

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

  if (isLoading) return <NewsSkeleton title="MORNING INTELLIGENCE" icon={<Sun className="w-4 h-4 text-amber-400" />} />;
  if (error || !data) return null;

  return (
    <div className="bg-neutral-900/80 border border-amber-500/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" />
          <span className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">
            Morning Intelligence
          </span>
          <span className="text-[12px] text-neutral-500">{data.date}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Chỉ số tham chiếu */}
          {data.reference_indices && data.reference_indices.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Chỉ số tham chiếu
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.reference_indices.map((idx: { name: string; value: number; change_pct: number }) => (
                  <div
                    key={idx.name}
                    className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2 border border-neutral-800"
                  >
                    <span className="text-[11px] text-neutral-400">{idx.name}</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-neutral-200">
                        {typeof idx.value === "number" ? idx.value.toLocaleString("vi-VN") : idx.value}
                      </span>
                      <span
                        className={`text-[12px] ml-1.5 ${
                          idx.change_pct > 0 ? "text-emerald-400" : idx.change_pct < 0 ? "text-red-400" : "text-neutral-500"
                        }`}
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
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
            items={data.vn_market}
            color="emerald"
          />

          {/* Vĩ mô */}
          <BulletSection
            title="Vĩ mô trong nước & quốc tế"
            icon={<Newspaper className="w-3.5 h-3.5 text-blue-400" />}
            items={data.macro}
            color="blue"
          />

          {/* Rủi ro / Cơ hội */}
          <BulletSection
            title="Rủi ro / Cơ hội"
            icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
            items={data.risk_opportunity}
            color="amber"
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

  if (isLoading) return <NewsSkeleton title="EOD FLASH NOTE" icon={<Moon className="w-4 h-4 text-indigo-400" />} />;
  if (error || !data) return null;

  const pctColor = (data.change_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="bg-neutral-900/80 border border-indigo-500/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-400" />
          <span className="text-[12px] font-bold text-indigo-400 uppercase tracking-wider">
            EOD Flash Note
          </span>
          <span className="text-[12px] text-neutral-500">{data.date}</span>
          {data.vnindex && (
            <span className={`text-[12px] font-bold ${pctColor}`}>
              VNI {data.vnindex.toFixed(1)} ({data.change_pct > 0 ? "+" : ""}{data.change_pct}%)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Quick stats */}
          {data.breadth && (
            <div className="grid grid-cols-3 gap-2">
              <StatChip label="Tăng" value={data.breadth.up} color="text-emerald-400" bg="bg-emerald-500/10" />
              <StatChip label="Giảm" value={data.breadth.down} color="text-red-400" bg="bg-red-500/10" />
              <StatChip label="TK (Tỷ)" value={data.liquidity ?? "N/A"} color="text-blue-400" bg="bg-blue-500/10" />
            </div>
          )}

          {/* Tổng kết phiên */}
          {data.session_summary && (
            <TextBlock title="Tổng kết phiên" text={data.session_summary} color="indigo" />
          )}

          {/* Thanh khoản chi tiết */}
          {data.liquidity_detail && (
            <TextBlock title="Thanh khoản" text={data.liquidity_detail} color="blue" />
          )}

          {/* Ngoại flow */}
          {data.foreign_flow && (
            <TextBlock title="Nhà đầu tư nước ngoài" text={data.foreign_flow} color="amber" />
          )}

          {/* Giao dịch nổi bật */}
          {data.notable_trades && (
            <TextBlock title="Giao dịch nổi bật" text={data.notable_trades} color="purple" />
          )}

          {/* Nhận định */}
          {data.outlook && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[12px] font-bold text-indigo-400 uppercase tracking-wider">
                  Nhận định phiên tới
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed italic">
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
  color,
}: {
  title: string;
  icon: React.ReactNode;
  items?: string[];
  color: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className={`text-[12px] font-bold text-${color}-400 uppercase tracking-wider`}>
          {title}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-400 leading-relaxed">
            <span className={`text-${color}-500 mt-0.5`}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatChip({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className={`${bg} border border-neutral-800 rounded-lg px-3 py-2 text-center`}>
      <p className={`text-lg font-black ${color}`}>{value}</p>
      <p className="text-[12px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

function TextBlock({ title, text, color }: { title: string; text: string; color: string }) {
  return (
    <div>
      <p className={`text-[12px] font-bold text-${color}-400 uppercase tracking-wider mb-1`}>
        {title}
      </p>
      <p className="text-[11px] text-neutral-400 leading-relaxed">{text}</p>
    </div>
  );
}

function NewsSkeleton({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-3/4 bg-neutral-800 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-neutral-800 rounded animate-pulse" />
      </div>
    </div>
  );
}
