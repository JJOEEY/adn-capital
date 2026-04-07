"use client";

import useSWR from "swr";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Globe,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { MorningNewsSkeleton } from "./NewsSkeleton";

/* ═══════════════════════════════════════════════════════════════════════════
 *  MorningNews — Bản tin sáng FiinQuant  ·  08:00
 *  Design: 3D Card nổi, viền phát sáng amber, dark mode premium
 * ═══════════════════════════════════════════════════════════════════════════ */

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch failed");
    return r.json();
  });

/** Kiểu dữ liệu Gemini trả về cho morning */
interface MorningData {
  date: string;
  reference_indices: Array<{
    name: string;
    value: number;
    change_pct: number;
  }>;
  vn_market: string[];
  macro: string[];
  risk_opportunity: string[];
}

/** 5 chỉ số cố định thứ tự hiển thị */
const INDEX_ORDER = ["VN-INDEX", "DOW JONES", "DXY", "VÀNG", "DẦU WTI"];
const INDEX_ICONS: Record<string, string> = {
  "VN-INDEX": "📈",
  "DOW JONES": "🇺🇸",
  DXY: "💵",
  VÀNG: "🥇",
  "DẦU WTI": "🛢️",
};

export function MorningNews() {
  const { data, isLoading } = useSWR<MorningData>(
    "/api/market-news?type=morning",
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 300_000,
      fallbackData: undefined,
    },
  );

  if (isLoading || !data) return <MorningNewsSkeleton />;

  /* Sắp xếp reference_indices theo INDEX_ORDER */
  const indices = INDEX_ORDER.map((name) => {
    const found = data.reference_indices?.find(
      (i) =>
        i.name.toUpperCase().includes(name) ||
        name.includes(i.name.toUpperCase()),
    );
    return found ?? { name, value: 0, change_pct: 0 };
  });

  return (
    <div className="relative rounded-2xl border border-amber-500/15 bg-gray-900/90 shadow-[0_4px_40px_-12px_rgba(245,158,11,0.12)] overflow-hidden transform-gpu">
      {/* ─── Ambient glow ─── */}
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* ─── Header ─── */}
      <div className="relative z-10 border-b border-gray-800/60 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
              Bản Tin Sáng ADN Capital
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              MORNING BRIEF
            </p>
          </div>
        </div>
        <span className="text-[12px] text-gray-600 font-mono">{data.date}</span>
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* ═══ PHẦN TOP: 5 Chỉ số Tham chiếu ═══ */}
        <div>
          <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Chỉ số Tham chiếu (so phiên trước)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {indices.map((idx) => {
              const up = idx.change_pct > 0;
              const down = idx.change_pct < 0;
              return (
                <div
                  key={idx.name}
                  className="relative bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-3 hover:border-gray-600/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-400 font-medium truncate">
                      {idx.name}
                    </span>
                    <span className="text-sm">
                      {INDEX_ICONS[idx.name] ?? "📊"}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-white leading-tight">
                    {typeof idx.value === "number"
                      ? idx.value.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      : idx.value}
                  </p>
                  <p
                    className={`text-xs font-semibold mt-0.5 ${
                      up
                        ? "text-emerald-500"
                        : down
                          ? "text-red-500"
                          : "text-gray-500"
                    }`}
                  >
                    {up && "+"}
                    {typeof idx.change_pct === "number"
                      ? idx.change_pct.toFixed(2)
                      : idx.change_pct}
                    %
                    {up && <TrendingUp className="w-3 h-3 inline ml-1" />}
                    {down && <TrendingDown className="w-3 h-3 inline ml-1" />}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ PHẦN BODY: 3 Content Boxes ═══ */}

        {/* Box 1: Thị trường Việt Nam */}
        <ContentBox
          icon={<BarChart3 className="w-4 h-4 text-amber-400" />}
          title="Thị trường Việt Nam"
          titleColor="text-amber-400"
          borderColor="border-amber-500/20"
          glowColor="bg-amber-500/5"
          items={data.vn_market}
          bulletColor="text-amber-500"
        />

        {/* Box 2: Vĩ mô Trong nước & Quốc tế */}
        <ContentBox
          icon={<Globe className="w-4 h-4 text-blue-400" />}
          title="Vĩ mô Trong Nước & Quốc Tế"
          titleColor="text-blue-400"
          borderColor="border-blue-500/20"
          glowColor="bg-blue-500/5"
          items={data.macro}
          bulletColor="text-blue-500"
        />

        {/* Box 3: Rủi ro / Cơ hội */}
        <ContentBox
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
          title="Rủi Ro / Cơ Hội"
          titleColor="text-rose-400"
          borderColor="border-rose-500/20"
          glowColor="bg-rose-500/5"
          items={data.risk_opportunity}
          bulletColor="text-rose-500"
        />

        {/* ─── Footer ─── */}
        <div className="flex flex-col items-center gap-0.5 pt-2">
          <p className="text-[11px] text-gray-500 font-medium">
            Powered by ADN Capital
          </p>
          <p className="text-[11px] text-amber-500/60 font-bold tracking-wider">
            ADNCAPITAL.COM.VN
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared ContentBox ─── */
function ContentBox({
  icon,
  title,
  titleColor,
  borderColor,
  glowColor,
  items,
  bulletColor,
}: {
  icon: React.ReactNode;
  title: string;
  titleColor: string;
  borderColor: string;
  glowColor: string;
  items?: string[];
  bulletColor: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div
      className={`relative ${glowColor} border ${borderColor} rounded-xl p-4 overflow-hidden`}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4
          className={`text-[11px] font-extrabold uppercase tracking-wider ${titleColor}`}
        >
          {title}
        </h4>
      </div>
      {/* Bullet list */}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[12px] text-gray-300 leading-relaxed"
          >
            <span className={`${bulletColor} mt-1 text-sm leading-none`}>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
