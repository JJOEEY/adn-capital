"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getRsColor, getRsBgColor, getRsLabel, formatPrice, formatPercent } from "@/lib/utils";
import type { StockData } from "@/types";

interface RatingTableProps {
  stocks: StockData[];
}

export function RatingTable({ stocks }: RatingTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "superstar" | "star" | "watch" | "farmer">("all");

  const filtered = stocks.filter((s) => {
    const matchSearch =
      search === "" ||
      s.symbol.includes(search.toUpperCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === "all" ||
      (filter === "superstar" && s.rsRating > 90) ||
      (filter === "star" && s.rsRating >= 80 && s.rsRating <= 90) ||
      (filter === "watch" && s.rsRating >= 60 && s.rsRating < 80) ||
      (filter === "farmer" && s.rsRating < 60);

    return matchSearch && matchFilter;
  });

  const filterBtn = (label: string, val: typeof filter, count: number) => (
    <button
      onClick={() => setFilter(val)}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
        filter === val
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
      }`}
    >
      {label}
      <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã cổ phiếu..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 text-neutral-100 placeholder-neutral-600 text-sm rounded-xl outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filterBtn("Tất cả", "all", stocks.length)}
          {filterBtn("Super Star", "superstar", stocks.filter((s) => s.rsRating > 90).length)}
          {filterBtn("Star", "star", stocks.filter((s) => s.rsRating >= 80 && s.rsRating <= 90).length)}
          {filterBtn("Watch", "watch", stocks.filter((s) => s.rsRating >= 60 && s.rsRating < 80).length)}
          {filterBtn("Farmer", "farmer", stocks.filter((s) => s.rsRating < 60).length)}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                  #
                </th>
                <th className="text-left text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                  Mã CK
                </th>
                <th className="text-left text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                  Tên
                </th>
                <th className="text-right text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                  Giá
                </th>
                <th className="text-right text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                  %Thay đổi
                </th>
                <th className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                  RS Rating
                </th>
                <th className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Nhãn
                </th>
                <th className="text-left text-xs text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Ngành
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((stock, i) => (
                <motion.tr
                  key={stock.symbol}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-white text-sm font-mono">{stock.symbol}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-neutral-400">{stock.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-semibold text-neutral-100">
                      {formatPrice(stock.price)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                        stock.changePercent >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {stock.changePercent >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {formatPercent(stock.changePercent)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold font-mono ${getRsBgColor(stock.rsRating)}`}>
                        <span className={getRsColor(stock.rsRating)}>{stock.rsRating}</span>
                      </div>
                      <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            stock.rsRating > 90
                              ? "bg-purple-500"
                              : stock.rsRating >= 80
                              ? "bg-emerald-500"
                              : stock.rsRating >= 60
                              ? "bg-yellow-500"
                              : "bg-neutral-600"
                          }`}
                          style={{ width: `${stock.rsRating}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex justify-center">
                      <Badge
                        variant={
                          stock.rsRating > 90
                            ? "purple"
                            : stock.rsRating >= 80
                            ? "emerald"
                            : stock.rsRating >= 60
                            ? "yellow"
                            : "gray"
                        }
                      >
                        {getRsLabel(stock.rsRating)}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-neutral-500">{stock.sector}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">
              Không tìm thấy cổ phiếu phù hợp
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
