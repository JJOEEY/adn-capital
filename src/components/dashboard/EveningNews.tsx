"use client";

import {
  Moon,
  Lightbulb,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Banknote,
  Users,
  BarChart3,
  Zap,
  ArrowUpCircle,
  ArrowDownCircle,
  Rocket,
} from "lucide-react";
import { EveningNewsSkeleton } from "./NewsSkeleton";
import { useTopic } from "@/hooks/useTopic";

/* ═══════════════════════════════════════════════════════════════════════════
 *  EveningNews — Tổng hợp Thị trường  ·  19:00
 *  Kết hợp: Flashnote (text) + Bảng Dòng Tiền (CSS Grid dark mode)
 * ═══════════════════════════════════════════════════════════════════════════ */

interface EodData {
  date: string;
  vnindex: number;
  change_pct: number;
  liquidity: number;
  liquidity_by_exchange?: {
    HOSE?: number | null;
    HNX?: number | null;
    UPCOM?: number | null;
  };
  breadth: { up: number; down: number; unchanged: number; total: number };
  session_summary: string;
  liquidity_detail: string;
  foreign_flow: string;
  notable_trades: string;
  outlook: string;
  /* Bảng dòng tiền chi tiết */
  sub_indices?: Array<{ name: string; change_pts: number; change_pct: number }>;
  foreign_top_buy?: string[];
  foreign_top_sell?: string[];
  prop_trading_top_buy?: string[];
  prop_trading_top_sell?: string[];
  sector_gainers?: string[];
  sector_losers?: string[];
  buy_signals?: string[];
  sell_signals?: string[];
  top_breakout?: string[];
}

type Tone = "emerald" | "red" | "blue" | "amber" | "purple" | "indigo";

const TONE = {
  emerald: { text: "#16a34a", border: "rgba(22,163,74,0.30)", bg: "rgba(22,163,74,0.08)" },
  red: { text: "var(--danger)", border: "rgba(192,57,43,0.30)", bg: "rgba(192,57,43,0.08)" },
  blue: { text: "#3b82f6", border: "rgba(59,130,246,0.30)", bg: "rgba(59,130,246,0.08)" },
  amber: { text: "#f59e0b", border: "rgba(245,158,11,0.30)", bg: "rgba(245,158,11,0.08)" },
  purple: { text: "#a855f7", border: "rgba(168,85,247,0.30)", bg: "rgba(168,85,247,0.08)" },
  indigo: { text: "#6366f1", border: "rgba(99,102,241,0.30)", bg: "rgba(99,102,241,0.08)" },
} as const;

function normalizeSubIndices(
  rows: EodData["sub_indices"] | undefined,
): Array<{ name: string; change_pts: number; change_pct: number }> {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    if (!row || typeof row.name !== "string") return false;
    const name = row.name.trim();
    if (!name) return false;
    if (/^0+$/.test(name)) return false;
    return Number.isFinite(row.change_pts) || Number.isFinite(row.change_pct);
  });
}

export function EveningNews() {
  const eodTopic = useTopic<EodData>("brief:eod:latest", {
    pollMs: 300_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    staleWhileRevalidate: true,
  });
  const data = eodTopic.data;

  if ((eodTopic.isLoading && !data) || !data) return <EveningNewsSkeleton />;

  const up = data.change_pct >= 0;
  const normalizedSubIndices = normalizeSubIndices(data.sub_indices);
  const exchangeLiquidityLine =
    data.liquidity_by_exchange &&
    ((data.liquidity_by_exchange.HOSE ?? 0) > 0 ||
      (data.liquidity_by_exchange.HNX ?? 0) > 0 ||
      (data.liquidity_by_exchange.UPCOM ?? 0) > 0)
      ? `Thanh khoản theo sàn: HoSE ${(data.liquidity_by_exchange.HOSE ?? 0).toLocaleString("vi-VN")} | HNX ${(data.liquidity_by_exchange.HNX ?? 0).toLocaleString("vi-VN")} | UPCoM ${(data.liquidity_by_exchange.UPCOM ?? 0).toLocaleString("vi-VN")} tỷ đồng.`
      : null;

  return (
    <div className="relative w-full min-w-0 rounded-2xl border shadow-[0_4px_24px_-12px_rgba(46,77,61,0.12)] overflow-hidden transform-gpu" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* ─── Ambient glow ─── */}
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none" style={{ background: "rgba(100,112,96,0.05)" }} />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none" style={{ background: "rgba(100,112,96,0.04)" }} />

      {/* ─── Header ─── */}
      <div className="relative z-10 border-b px-5 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg border" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <Moon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
              Bản Tin Tổng Hợp ({data.date})
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              END-OF-DAY BRIEF
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[12px] font-mono block" style={{ color: "var(--text-muted)" }}>
            {data.date}
          </span>
          <FreshnessBadge freshness={eodTopic.freshness} />
          {data.vnindex > 0 && (
            <span className="text-xs font-bold" style={{ color: up ? "#16a34a" : "var(--danger)" }}>
              VNI {data.vnindex.toLocaleString("en-US", { maximumFractionDigits: 1 })} (
              {up && "+"}
              {data.change_pct}%)
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* ═══ KHU VỰC 1: ADN Capital Flashnote (Text Summary) ═══ */}
        <div className="border rounded-xl p-4 space-y-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: TONE.indigo.text }}>
            <Sparkles className="w-3.5 h-3.5" />
            ADN Capital Flashnote
          </h4>

          <ul className="space-y-3">
            {/* Thanh khoản */}
            {data.liquidity_detail && (
              <FlashBullet
                icon={<Banknote className="w-3.5 h-3.5" style={{ color: TONE.blue.text }} />}
                tone="blue"
              >
                <BoldKeywords text={data.liquidity_detail} />
              </FlashBullet>
            )}
            {exchangeLiquidityLine && (
              <FlashBullet
                icon={<Banknote className="w-3.5 h-3.5" style={{ color: TONE.blue.text }} />}
                tone="blue"
              >
                <BoldKeywords text={exchangeLiquidityLine} />
              </FlashBullet>
            )}

            {/* Khối ngoại */}
            {data.foreign_flow && (
              <FlashBullet
                icon={<Users className="w-3.5 h-3.5" style={{ color: TONE.amber.text }} />}
                tone="amber"
              >
                <BoldKeywords text={data.foreign_flow} />
              </FlashBullet>
            )}

            {/* Tổ chức / Tự doanh */}
            {data.notable_trades && (
              <FlashBullet
                icon={<BarChart3 className="w-3.5 h-3.5" style={{ color: TONE.purple.text }} />}
                tone="purple"
              >
                <BoldKeywords text={data.notable_trades} />
              </FlashBullet>
            )}
          </ul>
        </div>

        {/* ═══ KHU VỰC 2: Bảng Dòng Tiền (CSS Grid dark mode) ═══ */}
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="border-b px-4 py-2.5" style={{ background: TONE.indigo.bg, borderColor: "var(--border)" }}>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: TONE.indigo.text }}>
              <BarChart3 className="w-3.5 h-3.5" />
              Bảng Dòng Tiền Chi Tiết
            </h4>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {/* Row: Chỉ số phụ */}
            {normalizedSubIndices.length > 0 && (
              <GridRow label="Chỉ số">
                <div className="flex flex-wrap gap-2">
                  {normalizedSubIndices.map((idx) => {
                    const positive = idx.change_pct >= 0;
                    return (
                      <span
                        key={idx.name}
                        className="text-[11px] px-2 py-0.5 rounded-md border"
                        style={{
                          color: positive ? TONE.emerald.text : TONE.red.text,
                          borderColor: positive ? TONE.emerald.border : TONE.red.border,
                          background: positive ? TONE.emerald.bg : TONE.red.bg,
                        }}
                      >
                        {idx.name}: {idx.change_pct >= 0 ? "+" : ""}
                        {idx.change_pts} ({idx.change_pct >= 0 ? "+" : ""}
                        {idx.change_pct}%)
                      </span>
                    );
                  })}
                </div>
              </GridRow>
            )}

            {/* Row: Khối ngoại */}
            {(data.foreign_top_buy?.length || data.foreign_top_sell?.length) && (
              <GridRow label="Giao dịch Khối ngoại">
                <div className="space-y-1.5">
                  {data.foreign_top_buy && data.foreign_top_buy.length > 0 && (
                    <TagLine
                      icon={<ArrowUpCircle className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Top mua ròng:"
                      items={data.foreign_top_buy}
                      tone="emerald"
                    />
                  )}
                  {data.foreign_top_sell && data.foreign_top_sell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Top bán ròng:"
                      items={data.foreign_top_sell}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Giao dịch Tự doanh */}
            {(data.prop_trading_top_buy?.length || data.prop_trading_top_sell?.length) && (
              <GridRow label="Giao dịch Tự doanh">
                <div className="space-y-1.5">
                  {data.prop_trading_top_buy && data.prop_trading_top_buy.length > 0 && (
                    <TagLine
                      icon={<ArrowUpCircle className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Top mua ròng:"
                      items={data.prop_trading_top_buy}
                      tone="emerald"
                    />
                  )}
                  {data.prop_trading_top_sell && data.prop_trading_top_sell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Top bán ròng:"
                      items={data.prop_trading_top_sell}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Nhóm ảnh hưởng */}
            {(data.sector_gainers?.length || data.sector_losers?.length) && (
              <GridRow label="Nhóm ảnh hưởng">
                <div className="space-y-1.5">
                  {data.sector_gainers && data.sector_gainers.length > 0 && (
                    <TagLine
                      icon={<TrendingUp className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Tăng giá:"
                      items={data.sector_gainers}
                      tone="emerald"
                    />
                  )}
                  {data.sector_losers && data.sector_losers.length > 0 && (
                    <TagLine
                      icon={<TrendingDown className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Giảm giá:"
                      items={data.sector_losers}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Tín hiệu Mua/Bán chủ động */}
            {(data.buy_signals?.length || data.sell_signals?.length) && (
              <GridRow label="Tín hiệu BU/SD">
                <div className="space-y-1.5">
                  {data.buy_signals && data.buy_signals.length > 0 && (
                    <TagLine
                      icon={<Zap className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="BU (KLGD lớn):"
                      items={data.buy_signals}
                      tone="emerald"
                    />
                  )}
                  {data.sell_signals && data.sell_signals.length > 0 && (
                    <TagLine
                      icon={<Zap className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="SD (KLGD lớn):"
                      items={data.sell_signals}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Top đột phá */}
            {data.top_breakout && data.top_breakout.length > 0 && (
              <GridRow label="Top đột phá">
                <TagLine
                  icon={<Rocket className="w-3 h-3" style={{ color: TONE.purple.text }} />}
                  label=""
                  items={data.top_breakout}
                  tone="purple"
                />
              </GridRow>
            )}
          </div>
        </div>

        {/* ═══ Khối 3: Kết luận / Nhận định phiên tới ═══ */}
        {data.outlook && (
          <div className="border rounded-xl p-4" style={{ background: TONE.indigo.bg, borderColor: TONE.indigo.border }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-4 h-4" style={{ color: TONE.indigo.text }} />
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: TONE.indigo.text }}>
                Nhận Định Phiên Tới
              </h4>
            </div>
            <p className="text-[15px] leading-relaxed italic" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{data.outlook}&rdquo;
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-0.5 pt-2">
          <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            Thông tin nội bộ - ADN Capital
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

/* ─── Sub-components ─── */

/** Flashnote bullet with left border accent */
function FlashBullet({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 pl-3 border-l-2" style={{ borderColor: TONE[tone].border }}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {children}
      </span>
    </li>
  );
}

/** Grid row: left label (3/12) + right content (9/12) */
function GridRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
      <div className="md:col-span-3 px-4 py-3 flex items-start" style={{ background: "var(--surface-2)" }}>
        <span className="text-[11px] font-semibold leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <div className="md:col-span-9 px-4 py-3">{children}</div>
    </div>
  );
}

/** Inline tag line: icon + label + comma-joined items */
function TagLine({
  icon,
  label,
  items,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  tone: Tone;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {label && (
          <span className="font-bold" style={{ color: TONE[tone].text }}>{label} </span>
        )}
        {items.join(", ")}
      </p>
    </div>
  );
}

/**
 * Tự động bôi đậm keywords: MUA ròng, BÁN ròng, HoSE, HNX, UPCoM, GTGD,
 * số liệu tỷ đồng, tên sàn, v.v.
 */
function BoldKeywords({ text }: { text: string }) {
  const parts = text.split(
    /(MUA ròng|BÁN ròng|mua ròng|bán ròng|HoSE|HNX|UPCoM|GTGD|Khớp lệnh|Thỏa thuận|tăng|giảm|\d[\d,.]+\s*tỷ(?:\s*đồng)?)/gi,
  );
  return (
    <>
      {parts.map((part, i) =>
        /MUA ròng|mua ròng/i.test(part) ? (
          <span key={i} className="font-bold" style={{ color: TONE.emerald.text }}>
            {part}
          </span>
        ) : /BÁN ròng|bán ròng/i.test(part) ? (
          <span key={i} className="font-bold" style={{ color: TONE.red.text }}>
            {part}
          </span>
        ) : /HoSE|HNX|UPCoM|GTGD|Khớp lệnh|Thỏa thuận/i.test(part) ? (
          <span key={i} className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {part}
          </span>
        ) : /\d[\d,.]+\s*tỷ/i.test(part) ? (
          <span key={i} className="font-semibold" style={{ color: TONE.indigo.text }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
