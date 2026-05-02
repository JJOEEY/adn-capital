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
  AlertTriangle,
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
  individual_top_buy?: string[];
  individual_top_sell?: string[];
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
    const compactName = name.replace(/[^A-Za-z0-9]/g, "");
    if (compactName && /^0+$/.test(compactName)) return false;
    return Number.isFinite(row.change_pts) || Number.isFinite(row.change_pct);
  });
}

function normalizeFlowItems(items: string[] | undefined): string[] {
  if (!Array.isArray(items)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const cleaned = String(item ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const leadingToken = cleaned.split(/[:：\-–—(|]/)[0]?.trim() ?? "";
    const alnumToken = leadingToken.replace(/[^A-Za-z0-9]/g, "");
    if (alnumToken && /^0+$/.test(alnumToken)) continue;
    if (/^0{3,}\b/.test(cleaned)) continue;
    if (!/[A-Za-zÀ-ỹ]/u.test(cleaned) && /^[\d.,:+\-|/()%\s]+$/.test(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatNetFlow(value: number): string {
  const abs = Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return `${value >= 0 ? "Mua ròng" : "Bán ròng"} ${abs} tỷ`;
}

function parseForeignNetFlow(text: string | undefined): string[] {
  if (!text) return [];
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/([+-]?\d[\d.,]*)\s*tỷ/i);
  if (!match) return [];
  const value = parseNumber(match[1]);
  if (value == null) return [];
  const lower = cleaned.toLowerCase();
  const signed = lower.includes("bán ròng") ? -Math.abs(value) : Math.abs(value);
  return [formatNetFlow(signed)];
}

function parseNamedNetFlow(text: string | undefined, label: string): string[] {
  if (!text) return [];
  const normalizedLabel = normalizeForMatch(label);
  const segment =
    text
      .split("|")
      .map((part) => part.trim())
      .find((part) => normalizeForMatch(part).includes(normalizedLabel)) ?? "";
  const match = segment.match(/([+-]?\d[\d.,]*)\s*tỷ/i) ?? segment.match(/([+-]?\d[\d.,]*)/);
  if (!match) return [];
  const value = parseNumber(match[1]);
  return value == null ? [] : [formatNetFlow(value)];
}

function isWeakOutlook(text: string | undefined): boolean {
  const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  const normalized = normalizeForMatch(cleaned);
  if (normalized === "chi so chinh") return true;
  if (normalized.includes("bang dong tien chi tiet")) return true;
  if (/^(vn-?index|vni|vn30|hnx-?index|upcom-?index)\s*[:：]/i.test(cleaned) && cleaned.length < 120) return true;
  return cleaned.length < 60;
}

function buildNextSessionOutlook(data: EodData): string {
  const direction =
    data.change_pct > 0 ? "tích cực nhưng vẫn cần chọn lọc" : data.change_pct < 0 ? "thận trọng" : "trung tính";
  const indexLine =
    data.vnindex > 0
      ? `VN-Index đang ở ${data.vnindex.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} điểm (${data.change_pct >= 0 ? "+" : ""}${data.change_pct}%).`
      : "";
  const breadthLine =
    data.breadth?.total > 0
      ? `Độ rộng ghi nhận ${data.breadth.up} mã tăng, ${data.breadth.down} mã giảm và ${data.breadth.unchanged} mã đứng giá.`
      : "";
  const liquidityLine =
    data.liquidity > 0
      ? `Thanh khoản đạt ${Math.round(data.liquidity).toLocaleString("vi-VN")} tỷ đồng.`
      : "";
  const foreignLine = parseForeignNetFlow(data.foreign_flow)[0];
  const propLine = parseNamedNetFlow(data.notable_trades, "Tự doanh")[0];
  const individualLine = parseNamedNetFlow(data.notable_trades, "Cá nhân")[0];
  const flowParts = [
    foreignLine ? `khối ngoại ${foreignLine.toLowerCase()}` : "",
    propLine ? `tự doanh ${propLine.toLowerCase()}` : "",
    individualLine ? `cá nhân ${individualLine.toLowerCase()}` : "",
  ].filter(Boolean);
  const flowLine = flowParts.length > 0 ? `Dòng tiền ghi nhận ${flowParts.join(", ")}.` : "";
  const actionLine =
    data.change_pct < 0
      ? "Phiên tới ưu tiên quản trị rủi ro, hạn chế mua đuổi và chỉ thăm dò ở các cổ phiếu giữ nền giá tốt kèm thanh khoản xác nhận."
      : "Phiên tới có thể tiếp tục quan sát nhóm dẫn dắt, ưu tiên cổ phiếu vượt nền với thanh khoản cải thiện và điểm mua rõ ràng.";
  return [indexLine, liquidityLine, breadthLine, flowLine, actionLine, `Trạng thái chung: ${direction}.`]
    .filter(Boolean)
    .join(" ");
}

function EveningBriefEmptyState() {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg border p-2" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <AlertTriangle className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Bản tin cuối ngày đang chờ cập nhật
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Bản tin mới nhất sẽ hiển thị tại đây ngay sau lần tổng hợp kế tiếp.
          </p>
        </div>
      </div>
    </div>
  );
}

export function EveningNews() {
  const eodTopic = useTopic<EodData>("brief:eod:latest", {
    pollMs: 300_000,
    timeoutMs: 8_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    staleWhileRevalidate: true,
  });
  const data = eodTopic.data;

  if (eodTopic.isLoading && !data) return <EveningNewsSkeleton />;
  if (!data) return <EveningBriefEmptyState />;

  const up = data.change_pct >= 0;
  const normalizedSubIndices = normalizeSubIndices(data.sub_indices);
  const foreignTopBuy = normalizeFlowItems(data.foreign_top_buy);
  const foreignTopSell = normalizeFlowItems(data.foreign_top_sell);
  const propTradingTopBuy = normalizeFlowItems(data.prop_trading_top_buy);
  const propTradingTopSell = normalizeFlowItems(data.prop_trading_top_sell);
  const individualTopBuy = normalizeFlowItems(data.individual_top_buy);
  const individualTopSell = normalizeFlowItems(data.individual_top_sell);
  const foreignNetSummary = parseForeignNetFlow(data.foreign_flow);
  const propNetSummary = parseNamedNetFlow(data.notable_trades, "Tự doanh");
  const individualNetSummary = parseNamedNetFlow(data.notable_trades, "Cá nhân");
  const sectorGainers = normalizeFlowItems(data.sector_gainers);
  const sectorLosers = normalizeFlowItems(data.sector_losers);
  const buySignals = normalizeFlowItems(data.buy_signals);
  const sellSignals = normalizeFlowItems(data.sell_signals);
  const topBreakout = normalizeFlowItems(data.top_breakout);
  const exchangeLiquidityLine =
    data.liquidity_by_exchange &&
    ((data.liquidity_by_exchange.HOSE ?? 0) > 0 ||
      (data.liquidity_by_exchange.HNX ?? 0) > 0 ||
      (data.liquidity_by_exchange.UPCOM ?? 0) > 0)
      ? `Thanh khoản theo sàn: HoSE ${(data.liquidity_by_exchange.HOSE ?? 0).toLocaleString("vi-VN")} | HNX ${(data.liquidity_by_exchange.HNX ?? 0).toLocaleString("vi-VN")} | UPCoM ${(data.liquidity_by_exchange.UPCOM ?? 0).toLocaleString("vi-VN")} tỷ đồng.`
      : null;
  const nextSessionOutlook = isWeakOutlook(data.outlook) ? buildNextSessionOutlook(data) : data.outlook;

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
            {(foreignTopBuy.length || foreignTopSell.length || foreignNetSummary.length) && (
              <GridRow label="Giao dịch Khối ngoại">
                <div className="space-y-1.5">
                  {foreignNetSummary.length > 0 && (
                    <TagLine
                      icon={<Users className="w-3 h-3" style={{ color: TONE.amber.text }} />}
                      label="Tổng hợp:"
                      items={foreignNetSummary}
                      tone="amber"
                    />
                  )}
                  {foreignTopBuy.length > 0 && (
                    <TagLine
                      icon={<ArrowUpCircle className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Top mua ròng:"
                      items={foreignTopBuy}
                      tone="emerald"
                    />
                  )}
                  {foreignTopSell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Top bán ròng:"
                      items={foreignTopSell}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Giao dịch Tự doanh */}
            {(propTradingTopBuy.length || propTradingTopSell.length || propNetSummary.length) && (
              <GridRow label="Giao dịch Tự doanh">
                <div className="space-y-1.5">
                  {propNetSummary.length > 0 && (
                    <TagLine
                      icon={<BarChart3 className="w-3 h-3" style={{ color: TONE.purple.text }} />}
                      label="Tổng hợp:"
                      items={propNetSummary}
                      tone="purple"
                    />
                  )}
                  {propTradingTopBuy.length > 0 && (
                    <TagLine
                      icon={<ArrowUpCircle className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Top mua ròng:"
                      items={propTradingTopBuy}
                      tone="emerald"
                    />
                  )}
                  {propTradingTopSell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Top bán ròng:"
                      items={propTradingTopSell}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {(individualTopBuy.length || individualTopSell.length || individualNetSummary.length) && (
              <GridRow label="Giao dịch Cá nhân">
                <div className="space-y-1.5">
                  {individualNetSummary.length > 0 && (
                    <TagLine
                      icon={<Users className="w-3 h-3" style={{ color: TONE.blue.text }} />}
                      label="Tổng hợp:"
                      items={individualNetSummary}
                      tone="blue"
                    />
                  )}
                  {individualTopBuy.length > 0 && (
                    <TagLine
                      icon={<ArrowUpCircle className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Top mua ròng:"
                      items={individualTopBuy}
                      tone="emerald"
                    />
                  )}
                  {individualTopSell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Top bán ròng:"
                      items={individualTopSell}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Nhóm ảnh hưởng */}
            {(sectorGainers.length || sectorLosers.length) && (
              <GridRow label="Nhóm ảnh hưởng">
                <div className="space-y-1.5">
                  {sectorGainers.length > 0 && (
                    <TagLine
                      icon={<TrendingUp className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="Tăng giá:"
                      items={sectorGainers}
                      tone="emerald"
                    />
                  )}
                  {sectorLosers.length > 0 && (
                    <TagLine
                      icon={<TrendingDown className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="Giảm giá:"
                      items={sectorLosers}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Tín hiệu Mua/Bán chủ động */}
            {(buySignals.length || sellSignals.length) && (
              <GridRow label="Tín hiệu BU/SD">
                <div className="space-y-1.5">
                  {buySignals.length > 0 && (
                    <TagLine
                      icon={<Zap className="w-3 h-3" style={{ color: TONE.emerald.text }} />}
                      label="BU (KLGD lớn):"
                      items={buySignals}
                      tone="emerald"
                    />
                  )}
                  {sellSignals.length > 0 && (
                    <TagLine
                      icon={<Zap className="w-3 h-3" style={{ color: TONE.red.text }} />}
                      label="SD (KLGD lớn):"
                      items={sellSignals}
                      tone="red"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Top đột phá */}
            {topBreakout.length > 0 && (
              <GridRow label="Top đột phá">
                <TagLine
                  icon={<Rocket className="w-3 h-3" style={{ color: TONE.purple.text }} />}
                  label=""
                  items={topBreakout}
                  tone="purple"
                />
              </GridRow>
            )}
          </div>
        </div>

        {/* ═══ Khối 3: Kết luận / Nhận định phiên tới ═══ */}
        {nextSessionOutlook && (
          <div className="border rounded-xl p-4" style={{ background: TONE.indigo.bg, borderColor: TONE.indigo.border }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-4 h-4" style={{ color: TONE.indigo.text }} />
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: TONE.indigo.text }}>
                Nhận Định Phiên Tới
              </h4>
            </div>
            <p className="text-[15px] leading-relaxed italic" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{nextSessionOutlook}&rdquo;
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
