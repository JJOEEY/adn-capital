"use client";

import { Crown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";

interface LeaderStock {
  rank: number;
  symbol: string;
  name: string;
  rsRating: number;
  price: number;
  changePercent: number;
  sector: string;
}

interface TopLeadersProps {
  stocks: LeaderStock[];
}

function formatPrice(v: number): string {
  return new Intl.NumberFormat("vi-VN").format(v);
}

export function TopLeaders({ stocks }: TopLeadersProps) {
  return (
    <Card glow="purple" className="p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: "rgba(168,85,247,0.10)" }}>
            <Crown className="w-4 h-4" style={{ color: "#a855f7" }} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#a855f7" }}>
              Top 5 Siêu Cổ Phiếu
            </h3>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{PRODUCT_NAMES.rsRating} cao nhất hôm nay</p>
          </div>
        </div>
        <a
          href="/rs-rating"
          className="text-[12px] font-bold uppercase tracking-wider transition-colors"
          style={{ color: "rgba(168,85,247,0.70)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#a855f7")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(168,85,247,0.70)")}
        >
          Xem tất cả →
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[12px] font-bold uppercase tracking-wider border-b" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-3">Mã</th>
              <th className="pb-2 pr-3 hidden sm:table-cell">Ngành</th>
              <th className="pb-2 pr-3 text-right">Giá</th>
              <th className="pb-2 pr-3 text-right">%</th>
              <th className="pb-2 text-right">RS</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr
                key={s.symbol}
                className="border-b border-[var(--border)] transition-colors cursor-pointer"
              >
                <td className="py-2.5 pr-2">
                  <span className="text-xs font-black" style={{ color: s.rank <= 3 ? "#a855f7" : "var(--text-muted)" }}>
                    {s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : s.rank}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <div>
                    <span className="text-sm font-black transition-colors" style={{ color: "var(--text-primary)" }}>
                      {s.symbol}
                    </span>
                    <p className="text-[12px] sm:hidden" style={{ color: "var(--text-muted)" }}>{s.sector}</p>
                  </div>
                </td>
                <td className="py-2.5 pr-3 hidden sm:table-cell">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.sector}</span>
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <span className="text-xs font-bold font-mono" style={{ color: "var(--text-secondary)" }}>
                    {formatPrice(s.price)}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <span className="text-xs font-bold font-mono" style={{ color: s.changePercent >= 0 ? "#16a34a" : "var(--danger)" }}>
                    {s.changePercent > 0 ? "+" : ""}{s.changePercent.toFixed(2).replace(".", ",")}%
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" style={{ color: "#a855f7" }} />
                    <span className="text-sm font-black font-mono" style={{ color: "#a855f7" }}>{s.rsRating}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function TopLeadersSkeleton() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg animate-pulse" style={{ background: "var(--surface-2)" }} />
        <div className="h-4 w-40 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
            <div className="h-4 w-12 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
            <div className="flex-1" />
            <div className="h-4 w-16 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
            <div className="h-4 w-10 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
          </div>
        ))}
      </div>
    </Card>
  );
}
