"use client";

import useSWR from "swr";
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

/* ═══════════════════════════════════════════════════════════════════════════
 *  EveningNews — Tổng hợp Thị trường  ·  19:00
 *  Kết hợp: Flashnote (text) + Bảng Dòng Tiền (CSS Grid dark mode)
 * ═══════════════════════════════════════════════════════════════════════════ */

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fetch failed");
    return r.json();
  });

interface EodData {
  date: string;
  vnindex: number;
  change_pct: number;
  liquidity: number;
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

export function EveningNews() {
  const { data, isLoading } = useSWR<EodData>(
    "/api/market-news?type=eod",
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 300_000,
      fallbackData: undefined,
    },
  );

  if (isLoading || !data) return <EveningNewsSkeleton />;

  const up = data.change_pct >= 0;

  return (
    <div className="relative rounded-2xl border border-indigo-500/15 bg-gray-900/90 shadow-[0_4px_40px_-12px_rgba(99,102,241,0.12)] overflow-hidden transform-gpu">
      {/* ─── Ambient glow ─── */}
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-indigo-500/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

      {/* ─── Header ─── */}
      <div className="relative z-10 border-b border-gray-800/60 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Moon className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider">
              Bản Tin Tổng Hợp ({data.date})
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              END-OF-DAY BRIEF
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-600 font-mono block">
            {data.date}
          </span>
          {data.vnindex > 0 && (
            <span
              className={`text-xs font-bold ${
                up ? "text-emerald-400" : "text-red-400"
              }`}
            >
              VNI {data.vnindex.toLocaleString("en-US", { maximumFractionDigits: 1 })} (
              {up && "+"}
              {data.change_pct}%)
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* ═══ KHU VỰC 1: ADN Capital Flashnote (Text Summary) ═══ */}
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
          <h4 className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            ADN Capital Flashnote
          </h4>

          <ul className="space-y-3">
            {/* Thanh khoản */}
            {data.liquidity_detail && (
              <FlashBullet
                icon={<Banknote className="w-3.5 h-3.5 text-blue-400" />}
                color="border-blue-500/30"
              >
                <BoldKeywords text={data.liquidity_detail} />
              </FlashBullet>
            )}

            {/* Khối ngoại */}
            {data.foreign_flow && (
              <FlashBullet
                icon={<Users className="w-3.5 h-3.5 text-amber-400" />}
                color="border-amber-500/30"
              >
                <BoldKeywords text={data.foreign_flow} />
              </FlashBullet>
            )}

            {/* Tổ chức / Tự doanh */}
            {data.notable_trades && (
              <FlashBullet
                icon={<BarChart3 className="w-3.5 h-3.5 text-purple-400" />}
                color="border-purple-500/30"
              >
                <BoldKeywords text={data.notable_trades} />
              </FlashBullet>
            )}
          </ul>
        </div>

        {/* ═══ KHU VỰC 2: Bảng Dòng Tiền (CSS Grid dark mode) ═══ */}
        <div className="border border-gray-700/40 rounded-xl overflow-hidden">
          <div className="bg-indigo-500/5 border-b border-gray-700/40 px-4 py-2.5">
            <h4 className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Bảng Dòng Tiền Chi Tiết
            </h4>
          </div>

          <div className="divide-y divide-gray-700/30">
            {/* Row: Chỉ số phụ */}
            {data.sub_indices && data.sub_indices.length > 0 && (
              <GridRow label="Chỉ số">
                <div className="flex flex-wrap gap-2">
                  {data.sub_indices.map((idx) => (
                    <span
                      key={idx.name}
                      className={`text-[11px] px-2 py-0.5 rounded-md border ${
                        idx.change_pct >= 0
                          ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                          : "text-red-400 border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      {idx.name}: {idx.change_pct >= 0 ? "+" : ""}
                      {idx.change_pts} ({idx.change_pct >= 0 ? "+" : ""}
                      {idx.change_pct}%)
                    </span>
                  ))}
                </div>
              </GridRow>
            )}

            {/* Row: Khối ngoại */}
            {(data.foreign_top_buy?.length || data.foreign_top_sell?.length) && (
              <GridRow label="Giao dịch Khối ngoại">
                <div className="space-y-1.5">
                  {data.foreign_top_buy && data.foreign_top_buy.length > 0 && (
                    <TagLine
                      icon={<ArrowUpCircle className="w-3 h-3 text-emerald-400" />}
                      label="Top mua ròng:"
                      items={data.foreign_top_buy}
                      color="text-emerald-400"
                    />
                  )}
                  {data.foreign_top_sell && data.foreign_top_sell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3 text-red-400" />}
                      label="Top bán ròng:"
                      items={data.foreign_top_sell}
                      color="text-red-400"
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
                      icon={<ArrowUpCircle className="w-3 h-3 text-emerald-400" />}
                      label="Top mua ròng:"
                      items={data.prop_trading_top_buy}
                      color="text-emerald-400"
                    />
                  )}
                  {data.prop_trading_top_sell && data.prop_trading_top_sell.length > 0 && (
                    <TagLine
                      icon={<ArrowDownCircle className="w-3 h-3 text-red-400" />}
                      label="Top bán ròng:"
                      items={data.prop_trading_top_sell}
                      color="text-red-400"
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
                      icon={<TrendingUp className="w-3 h-3 text-emerald-400" />}
                      label="Tăng giá:"
                      items={data.sector_gainers}
                      color="text-emerald-400"
                    />
                  )}
                  {data.sector_losers && data.sector_losers.length > 0 && (
                    <TagLine
                      icon={<TrendingDown className="w-3 h-3 text-red-400" />}
                      label="Giảm giá:"
                      items={data.sector_losers}
                      color="text-red-400"
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
                      icon={<Zap className="w-3 h-3 text-emerald-400" />}
                      label="BU (KLGD lớn):"
                      items={data.buy_signals}
                      color="text-emerald-400"
                    />
                  )}
                  {data.sell_signals && data.sell_signals.length > 0 && (
                    <TagLine
                      icon={<Zap className="w-3 h-3 text-red-400" />}
                      label="SD (KLGD lớn):"
                      items={data.sell_signals}
                      color="text-red-400"
                    />
                  )}
                </div>
              </GridRow>
            )}

            {/* Row: Top đột phá */}
            {data.top_breakout && data.top_breakout.length > 0 && (
              <GridRow label="Top đột phá">
                <TagLine
                  icon={<Rocket className="w-3 h-3 text-purple-400" />}
                  label=""
                  items={data.top_breakout}
                  color="text-purple-400"
                />
              </GridRow>
            )}
          </div>
        </div>

        {/* ═══ Khối 3: Kết luận / Nhận định phiên tới ═══ */}
        {data.outlook && (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-4 h-4 text-indigo-400" />
              <h4 className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider">
                Nhận Định Phiên Tới
              </h4>
            </div>
            <p className="text-[13px] text-gray-300 leading-relaxed italic">
              &ldquo;{data.outlook}&rdquo;
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-0.5 pt-2">
          <p className="text-[9px] text-gray-500 font-medium">
            Thông tin nội bộ - ADN Capital
          </p>
          <p className="text-[9px] text-indigo-400/60 font-bold tracking-wider">
            ADNCAPITAL.COM.VN
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

/** Flashnote bullet with left border accent */
function FlashBullet({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex items-start gap-2.5 pl-3 border-l-2 ${color}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-[12px] text-gray-300 leading-relaxed">
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
      <div className="md:col-span-3 px-4 py-3 bg-gray-800/30 flex items-start">
        <span className="text-[11px] text-gray-400 font-semibold leading-relaxed">
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
  color,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  color: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-[11px] text-gray-300 leading-relaxed">
        {label && (
          <span className={`font-bold ${color}`}>{label} </span>
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
          <span key={i} className="font-bold text-emerald-400">
            {part}
          </span>
        ) : /BÁN ròng|bán ròng/i.test(part) ? (
          <span key={i} className="font-bold text-red-400">
            {part}
          </span>
        ) : /HoSE|HNX|UPCoM|GTGD|Khớp lệnh|Thỏa thuận/i.test(part) ? (
          <span key={i} className="font-semibold text-white">
            {part}
          </span>
        ) : /\d[\d,.]+\s*tỷ/i.test(part) ? (
          <span key={i} className="font-semibold text-indigo-300">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
