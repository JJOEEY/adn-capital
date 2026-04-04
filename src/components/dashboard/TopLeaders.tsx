"use client";

import { Crown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";

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
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <Crown className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-purple-400 uppercase tracking-wider">
              Top 5 Siêu Cổ Phiếu
            </h3>
            <p className="text-[10px] text-neutral-500">RS Rating cao nhất hôm nay</p>
          </div>
        </div>
        <a
          href="/rs-rating"
          className="text-[10px] font-bold text-purple-400/70 hover:text-purple-400 transition-colors uppercase tracking-wider"
        >
          Xem tất cả →
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
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
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-pointer group"
              >
                <td className="py-2.5 pr-2">
                  <span className={`text-xs font-black ${s.rank <= 3 ? "text-purple-400" : "text-neutral-500"}`}>
                    {s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : s.rank}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <div>
                    <span className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                      {s.symbol}
                    </span>
                    <p className="text-[10px] text-neutral-500 sm:hidden">{s.sector}</p>
                  </div>
                </td>
                <td className="py-2.5 pr-3 hidden sm:table-cell">
                  <span className="text-xs text-neutral-400">{s.sector}</span>
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <span className="text-xs font-bold text-neutral-300 font-mono">
                    {formatPrice(s.price)}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <span className={`text-xs font-bold font-mono ${s.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.changePercent > 0 ? "+" : ""}{s.changePercent.toFixed(2).replace(".", ",")}%
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-purple-400" />
                    <span className="text-sm font-black text-purple-400 font-mono">{s.rsRating}</span>
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
        <div className="w-7 h-7 rounded-lg bg-neutral-800 animate-pulse" />
        <div className="h-4 w-40 bg-neutral-800 rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-neutral-800 animate-pulse" />
            <div className="h-4 w-12 bg-neutral-800 rounded animate-pulse" />
            <div className="flex-1" />
            <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-10 bg-neutral-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </Card>
  );
}
