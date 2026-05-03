"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Download, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";
import { getRsColor, getRsBgStyle, getRsLabel, formatPrice, formatPercent } from "@/lib/utils";
import type { StockData } from "@/types";

interface RatingTableProps {
  stocks: StockData[];
  selectedDate?: string;
  asOfDate?: string | null;
  dateLoading?: boolean;
  onDateChange?: (date: string) => void;
  onClearDate?: () => void;
  onDownload?: () => void;
}

export function RatingTable({
  stocks,
  selectedDate = "",
  asOfDate,
  dateLoading = false,
  onDateChange,
  onClearDate,
  onDownload,
}: RatingTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "superstar" | "star" | "watch" | "farmer">("all");
  const [sectorFilter, setSectorFilter] = useState("all");

  const sectors = useMemo(
    () =>
      Array.from(new Set(stocks.map((stock) => stock.sector).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "vi"),
      ),
    [stocks],
  );

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

    const matchSector = sectorFilter === "all" || s.sector === sectorFilter;

    return matchSearch && matchFilter && matchSector;
  });

  const filterBtn = (label: string, val: typeof filter, count: number) => (
    <button
      onClick={() => setFilter(val)}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
        filter === val
          ? ""
          : "bg-[var(--surface)]"
      }`}
      style={filter === val ? { background: "rgba(22,163,74,0.15)", color: "#16a34a", borderColor: "rgba(22,163,74,0.30)" } : { borderColor: "var(--border)" }}
    >
      {label}
      <span className="ml-1.5 text-[12px] opacity-70">({count})</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã cổ phiếu..."
            className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-sm rounded-xl outline-none transition-all"
            style={{ color: "var(--text-primary)" }}
          />
            </div>

            <div className="relative w-full sm:w-56">
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-all"
                style={{ color: "var(--text-primary)" }}
                aria-label="Lọc theo ngành"
              >
                <option value="all">Tất cả ngành</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
              <CalendarDays className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange?.(e.target.value)}
                className="bg-transparent outline-none"
                style={{ color: "var(--text-primary)" }}
                aria-label="Lọc theo ngày"
              />
            </label>
            {selectedDate ? (
              <button
                onClick={onClearDate}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:text-[var(--text-primary)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="h-4 w-4" />
                Bỏ lọc ngày
              </button>
            ) : null}
            <button
              onClick={onDownload}
              disabled={stocks.length === 0 || dateLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-bold transition hover:text-[var(--text-primary)] disabled:opacity-50"
              style={{ color: "var(--text-muted)" }}
            >
              <Download className="h-4 w-4" />
              Tải bảng theo ngày
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {filterBtn("Tất cả", "all", stocks.length)}
          {filterBtn("Super Star", "superstar", stocks.filter((s) => s.rsRating > 90).length)}
          {filterBtn("Star", "star", stocks.filter((s) => s.rsRating >= 80 && s.rsRating <= 90).length)}
          {filterBtn("Watch", "watch", stocks.filter((s) => s.rsRating >= 60 && s.rsRating < 80).length)}
          {filterBtn("Farmer", "farmer", stocks.filter((s) => s.rsRating < 60).length)}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Ngày dữ liệu: {asOfDate || "mới nhất"}</span>
          <span>·</span>
          <span>Đang hiển thị {filtered.length}/{stocks.length} mã</span>
          {dateLoading ? (
            <>
              <span>·</span>
              <span>Đang tải ngày đã chọn...</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  #
                </th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  Mã CK
                </th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                  Tên
                </th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  Giá
                </th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  %Thay đổi
                </th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  {PRODUCT_NAMES.rsRating}
                </th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                  Nhãn
                </th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
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
                  className="border-b border-[var(--border)] transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm font-mono" style={{ color: "var(--text-primary)" }}>{stock.symbol}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{stock.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {formatPrice(stock.price)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                        stock.changePercent >= 0 ? "" : ""
                      }`}
                      style={{ color: stock.changePercent >= 0 ? "#16a34a" : "var(--danger)" }}
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
                      <div className="px-2.5 py-0.5 rounded-lg border text-xs font-bold font-mono" style={getRsBgStyle(stock.rsRating)}>
                        <span style={{ color: getRsColor(stock.rsRating) }}>{stock.rsRating}</span>
                      </div>
                      <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: stock.rsRating > 90 ? "#a855f7" : stock.rsRating >= 80 ? "#16a34a" : stock.rsRating >= 60 ? "#eab308" : "var(--text-muted)",
                            width: `${stock.rsRating}%`,
                          }}
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
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{stock.sector}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
              Không tìm thấy cổ phiếu phù hợp
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
