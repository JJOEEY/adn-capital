"use client";

import {
  Zap,
  TrendingUp,
  TrendingDown,
  Globe,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { MorningNewsSkeleton } from "./NewsSkeleton";
import { useTopic } from "@/hooks/useTopic";

/* ═══════════════════════════════════════════════════════════════════════════
 *  MorningNews — Bản tin sáng FiinQuant  ·  08:00
 *  Design: 3D Card nổi, viền phát sáng amber, dark mode premium
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Kiểu dữ liệu Gemini trả về cho morning */
interface MorningData {
  date: string;
  reference_indices: Array<{
    name: string;
    value: number | null;
    change_pct: number | null;
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

const DISPLAY_INDEX_ORDER = ["VN-INDEX", "HNX-INDEX", "UPCOM-INDEX", "VN30", "DOW JONES"];
const DISPLAY_INDEX_ICONS: Record<string, string> = {
  "VN-INDEX": "VN",
  "HNX-INDEX": "HNX",
  "UPCOM-INDEX": "UP",
  VN30: "30",
  "DOW JONES": "US",
};
const DISPLAY_INDEX_ALIASES: Record<string, string[]> = {
  "VN-INDEX": ["VNINDEX", "VN-INDEX"],
  "HNX-INDEX": ["HNX", "HNXINDEX", "HNX-INDEX"],
  "UPCOM-INDEX": ["UPCOM", "UPCOMINDEX", "UPCOM-INDEX"],
  VN30: ["VN30"],
  "DOW JONES": ["DOW", "DOWJONES", "DOW JONES"],
};

function normalizeDisplayIndexKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isSameDisplayIndexName(source: string, target: string): boolean {
  const sourceKey = normalizeDisplayIndexKey(source);
  const targetKeys = [target, ...(DISPLAY_INDEX_ALIASES[target] ?? [])].map(normalizeDisplayIndexKey);
  return targetKeys.includes(sourceKey);
}

function cleanDisplayLine(line: string): string {
  return line
    .replace(/[*_`]/g, "")
    .replace(/^\s*[-•\d.)]+\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUiHeadingLike(line: string): boolean {
  const n = cleanDisplayLine(line).toLowerCase();
  return (
    !n ||
    n.includes("bản tin sáng adn capital") ||
    n.includes("chỉ số tham chiếu") ||
    n.includes("thị trường việt nam") ||
    n.includes("vĩ mô trong nước") ||
    n.includes("rủi ro / cơ hội") ||
    n.includes("powered by adn capital")
  );
}

function normalizeListForDisplay(items?: string[]): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const cleaned = cleanDisplayLine(raw);
    if (cleaned.length < 16 || isUiHeadingLike(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= 5) break;
  }
  return out;
}

function MorningBriefEmptyState() {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg border p-2" style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}>
          <AlertTriangle className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Bản tin sáng đang chờ cập nhật</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Bản tin mới nhất sẽ hiển thị tại đây ngay sau lần tổng hợp kế tiếp.
          </p>
        </div>
      </div>
    </div>
  );
}

export function MorningNews() {
  const morningTopic = useTopic<MorningData>("brief:morning:latest", {
    timeoutMs: 8_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    staleWhileRevalidate: true,
  });
  const data = morningTopic.data;

  if (morningTopic.isLoading && !data) return <MorningNewsSkeleton />;
  if (!data) return <MorningBriefEmptyState />;

  const vnItems = normalizeListForDisplay(data.vn_market);
  const macroItems = normalizeListForDisplay(data.macro);
  const riskItems = normalizeListForDisplay(data.risk_opportunity);

  /* Sắp xếp reference_indices theo INDEX_ORDER */
  const indices = DISPLAY_INDEX_ORDER.map((name) => {
    const found = data.reference_indices?.find(
      (i) => isSameDisplayIndexName(i.name, name),
    );
    return found ? { ...found, name } : { name, value: null, change_pct: null };
  });

  return (
    <div className="relative w-full min-w-0 rounded-2xl border shadow-[0_4px_24px_-12px_rgba(46,77,61,0.12)] overflow-hidden transform-gpu" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* ─── Ambient glow (no blur/backdrop-filter) ─── */}
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none" style={{ background: "rgba(160,132,92,0.06)" }} />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none" style={{ background: "rgba(160,132,92,0.04)" }} />

      {/* ─── Header ─── */}
      <div className="relative z-10 border-b px-5 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg border" style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}>
            <Zap className="w-4 h-4" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--primary)" }}>
              BẢN TIN SÁNG ADN CAPITAL
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              AI SUMMARY HIGHLIGHTS
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[12px] font-mono block" style={{ color: "var(--text-muted)" }}>
            {data.date}
          </span>
          <FreshnessBadge freshness={morningTopic.freshness} />
        </div>
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* ═══ PHẦN TOP: 5 Chỉ số Tham chiếu ═══ */}
        <div>
          <p
            className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Chỉ số Tham chiếu (so phiên trước)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {indices.map((idx) => {
              const up = typeof idx.change_pct === "number" && idx.change_pct > 0;
              const down = typeof idx.change_pct === "number" && idx.change_pct < 0;
              return (
                <div
                  key={idx.name}
                  className="relative border rounded-xl px-3 py-3 transition-colors"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                      {idx.name}
                    </span>
                    <span className="text-sm">
                      {DISPLAY_INDEX_ICONS[idx.name] ?? "IDX"}
                    </span>
                  </div>
                  <p className="text-lg font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                    {typeof idx.value === "number"
                      ? idx.value.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      : "--"}
                  </p>
                  <p
                    className="text-xs font-semibold mt-0.5"
                    style={{
                      color: up ? "#16a34a" : down ? "var(--danger)" : "var(--text-muted)",
                    }}
                  >
                    {typeof idx.change_pct === "number" ? (
                      <>
                        {up && "+"}
                        {idx.change_pct.toFixed(2)}%
                        {up && <TrendingUp className="w-3 h-3 inline ml-1" />}
                        {down && <TrendingDown className="w-3 h-3 inline ml-1" />}
                      </>
                    ) : (
                      "--"
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ PHẦN BODY: 3 Content Boxes ═══ */}

        {/* Box 1: Thị trường Việt Nam */}
        <ContentBox
          icon={<BarChart3 className="w-4 h-4" style={{ color: "var(--accent-news)" }} />}
          title="Điểm tin Việt Nam nổi bật"
          items={vnItems}
          bulletColor="var(--accent-news)"
        />

        {/* Box 2: Vĩ mô Trong nước & Quốc tế */}
        <ContentBox
          icon={<Globe className="w-4 h-4" style={{ color: "var(--accent-fa)" }} />}
          title="Vĩ mô trong nước & quốc tế"
          items={macroItems}
          bulletColor="var(--accent-fa)"
        />

        {/* Box 3: Rủi ro / Cơ hội */}
        <ContentBox
          icon={<AlertTriangle className="w-4 h-4" style={{ color: "var(--danger)" }} />}
          title="Rủi ro / Cơ hội"
          items={riskItems}
          bulletColor="var(--danger)"
        />

        {/* ─── Footer ─── */}
        <div className="flex flex-col items-center gap-0.5 pt-2">
          <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            Powered by ADN Capital
          </p>
          <p className="text-[11px] font-bold tracking-wider" style={{ color: "var(--primary)" }}>
            ADNCAPITAL.COM.VN
          </p>
        </div>
      </div>
    </div>
  );
}

function FreshnessBadge({ freshness }: { freshness: string | null }) {
  if (!freshness) return null;
  const normalized = freshness.toLowerCase();
  const isFresh = normalized === "fresh";
  const isStale = normalized === "stale";
  const label = isFresh ? "Fresh" : isStale ? "Stale" : normalized.toUpperCase();
  const style = isFresh
    ? { color: "#16a34a", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.10)" }
    : isStale
      ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)" }
      : { color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.10)" };

  return (
    <span className="mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={style}>
      {label}
    </span>
  );
}

/* ─── Shared ContentBox ─── */
function ContentBox({
  icon,
  title,
  items,
  bulletColor,
}: {
  icon: React.ReactNode;
  title: string;
  items?: string[];
  bulletColor: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div
      className="relative rounded-xl p-4 overflow-hidden"
      style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4
          className="text-[11px] font-extrabold uppercase tracking-wider"
          style={{ color: bulletColor }}
        >
          {title}
        </h4>
      </div>
      {/* Bullet list */}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[12px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="mt-1 text-sm leading-none" style={{ color: bulletColor }}>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
