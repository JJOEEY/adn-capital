"use client";

import { useEffect, useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BarChart2, RefreshCw, Search, Crown, Flame, Minus, AlertTriangle } from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════════
//  Kiểu dữ liệu trả về từ API Python (GET /api/v1/rs-rating)
// ══════════════════════════════════════════════════════════════════════════════

interface RSStockData {
  ticker: string;
  sector: string;
  close: number;
  rs_rating: number;
}

interface RSResponse {
  count: number;
  updated_at: string;
  skipped: number;
  data: RSStockData[];
}

// ══════════════════════════════════════════════════════════════════════════════
//  Hàm lấy màu nền + màu chữ + nhãn cho RS Rating
//
//  Quy tắc:
//    RS >= 90 → Tím (chữ trắng)   → "Siêu Cổ Phiếu"
//    RS 80–89 → Xanh lá (chữ trắng) → "Dẫn Dắt"
//    RS 50–79 → Vàng (chữ đen)    → "Trung Bình"
//    RS < 50  → Đỏ (chữ trắng)    → "Yếu/Bỏ qua"
// ══════════════════════════════════════════════════════════════════════════════

type LoaiRS = "sieu_co_phieu" | "dan_dat" | "trung_binh" | "yeu";

interface ThongTinMauRS {
  bg: string;          // class Tailwind cho nền
  text: string;        // class Tailwind cho chữ
  label: string;       // nhãn tiếng Việt
  loai: LoaiRS;
  icon: React.ReactNode;
}

function layThongTinRS(rs: number): ThongTinMauRS {
  if (rs >= 90) {
    return {
      bg: "bg-purple-600",
      text: "text-white",
      label: "Siêu Cổ Phiếu",
      loai: "sieu_co_phieu",
      icon: <Crown className="w-3 h-3" />,
    };
  }
  if (rs >= 80) {
    return {
      bg: "bg-emerald-600",
      text: "text-white",
      label: "Dẫn Dắt",
      loai: "dan_dat",
      icon: <Flame className="w-3 h-3" />,
    };
  }
  if (rs >= 50) {
    return {
      bg: "bg-yellow-500",
      text: "text-black",
      label: "Trung Bình",
      loai: "trung_binh",
      icon: <Minus className="w-3 h-3" />,
    };
  }
  return {
    bg: "bg-red-600",
    text: "text-white",
    label: "Yếu/Bỏ qua",
    loai: "yeu",
    icon: <AlertTriangle className="w-3 h-3" />,
  };
}

// Format giá VNĐ: 128500 → "128.500"
function formatGia(gia: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(gia));
}

// ══════════════════════════════════════════════════════════════════════════════
//  TRANG CHÍNH: Bảng xếp hạng RS Rating
// ══════════════════════════════════════════════════════════════════════════════

export default function RSRatingDashboardPage() {
  const [data, setData] = useState<RSStockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [timKiem, setTimKiem] = useState("");
  const [filter, setFilter] = useState<"all" | LoaiRS>("all");

  // ── Gọi API qua Next.js proxy ───────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rs-rating", {
        signal: AbortSignal.timeout(60_000), // timeout 60 giây (tính toán nặng)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? `Lỗi HTTP ${res.status}`);
      }
      const json = await res.json();
      // Proxy trả về { stocks: [...], updatedAt }  → map lại sang RSStockData
      const mapped: RSStockData[] = (json.stocks ?? []).map(
        (s: { symbol: string; sector: string; price: number; rsRating: number }) => ({
          ticker: s.symbol,
          sector: s.sector,
          close: s.price,
          rs_rating: s.rsRating,
        })
      );
      setData(mapped);
      setUpdatedAt(json.updatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định khi gọi API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Lọc & tìm kiếm ──────────────────────────────────────────────────
  const duLieuDaLoc = useMemo(() => {
    return data.filter((s) => {
      // Lọc theo tìm kiếm (mã CK hoặc ngành)
      const khớpTimKiem =
        timKiem === "" ||
        s.ticker.includes(timKiem.toUpperCase()) ||
        s.sector.toLowerCase().includes(timKiem.toLowerCase());

      // Lọc theo nhóm RS
      const thongTin = layThongTinRS(s.rs_rating);
      const khớpFilter = filter === "all" || thongTin.loai === filter;

      return khớpTimKiem && khớpFilter;
    });
  }, [data, timKiem, filter]);

  // ── Thống kê từng nhóm ───────────────────────────────────────────────
  const thongKe = useMemo(() => ({
    sieu_co_phieu: data.filter((s) => s.rs_rating >= 90).length,
    dan_dat: data.filter((s) => s.rs_rating >= 80 && s.rs_rating < 90).length,
    trung_binh: data.filter((s) => s.rs_rating >= 50 && s.rs_rating < 80).length,
    yeu: data.filter((s) => s.rs_rating < 50).length,
  }), [data]);

  // ── Nút lọc nhóm ─────────────────────────────────────────────────────
  const nutLoc = (label: string, val: typeof filter, soLuong: number, mau: string) => (
    <button
      onClick={() => setFilter(filter === val ? "all" : val)}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
        filter === val ? mau : "text-neutral-500 border-neutral-800 hover:border-neutral-600 bg-neutral-900"
      }`}
    >
      {label}
      <span className="ml-1.5 text-[12px] opacity-70">({soLuong})</span>
    </button>
  );

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex-shrink-0">
              <BarChart2 className="w-5 h-5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                RS Rating <span className="text-purple-400">CANSLIM</span>
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 truncate">
                Bảng xếp hạng Sức mạnh Tương đối — {data.length} mã cổ phiếu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-[12px] text-neutral-600 hidden sm:inline">
                Dữ liệu: {updatedAt}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ═══ CHÚ THÍCH MÀU SẮC RS ═══ */}
        <div className="flex flex-wrap gap-2">
          {nutLoc("Siêu Cổ Phiếu (≥ 90)", "sieu_co_phieu", thongKe.sieu_co_phieu,
            "bg-purple-600/20 text-purple-400 border-purple-500/40")}
          {nutLoc("Dẫn Dắt (80–89)", "dan_dat", thongKe.dan_dat,
            "bg-emerald-600/20 text-emerald-400 border-emerald-500/40")}
          {nutLoc("Trung Bình (50–79)", "trung_binh", thongKe.trung_binh,
            "bg-yellow-500/20 text-yellow-400 border-yellow-500/40")}
          {nutLoc("Yếu/Bỏ qua (< 50)", "yeu", thongKe.yeu,
            "bg-red-600/20 text-red-400 border-red-500/40")}
        </div>

        {/* ═══ Ô TÌM KIẾM ═══ */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
          <input
            value={timKiem}
            onChange={(e) => setTimKiem(e.target.value)}
            placeholder="Tìm mã CK hoặc ngành... (VD: FPT, Ngân hàng)"
            className="w-full pl-9 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-purple-500/50 text-neutral-100 placeholder-neutral-600 text-sm rounded-xl outline-none transition-all"
          />
        </div>

        {/* ═══ LOADING STATE ═══ */}
        {loading && data.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-neutral-900 rounded-xl animate-pulse border border-neutral-800/50"
              />
            ))}
            <p className="text-center text-xs text-neutral-600 mt-4">
              ⏳ Đang tính toán RS Rating từ dữ liệu FiinQuantX (có thể mất 10–30 giây lần đầu)...
            </p>
          </div>
        ) : error ? (
          /* ═══ ERROR STATE ═══ */
          <div className="text-center py-16 space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-red-400 text-sm font-medium">{error}</p>
            <p className="text-neutral-600 text-xs">
              Kiểm tra FiinQuant Bridge đang chạy tại localhost:8000
            </p>
            <button
              onClick={fetchData}
              className="text-xs text-purple-400 hover:underline"
            >
              Thử lại
            </button>
          </div>
        ) : (
          /* ═══ DATA TABLE ═══ */
          <div className="bg-neutral-900/50 rounded-2xl border border-neutral-800/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3 w-12">
                      #
                    </th>
                    <th className="text-left text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                      Mã CK
                    </th>
                    <th className="text-left text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                      Ngành
                    </th>
                    <th className="text-right text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                      Giá (₫)
                    </th>
                    <th className="text-center text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3">
                      RS Rating
                    </th>
                    <th className="text-center text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                      Nhãn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {duLieuDaLoc.map((stock, i) => {
                    const info = layThongTinRS(stock.rs_rating);
                    return (
                      <tr
                        key={stock.ticker}
                        className="border-b border-neutral-800/40 hover:bg-neutral-800/30 transition-colors"
                      >
                        {/* Số thứ tự */}
                        <td className="px-4 py-3 text-xs text-neutral-600 font-mono">
                          {i + 1}
                        </td>

                        {/* Mã cổ phiếu */}
                        <td className="px-4 py-3">
                          <span className="font-bold text-white text-sm font-mono tracking-wide">
                            {stock.ticker}
                          </span>
                        </td>

                        {/* Ngành */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-neutral-400">{stock.sector}</span>
                        </td>

                        {/* Giá đóng cửa */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-mono font-semibold text-neutral-100">
                            {formatGia(stock.close)}
                          </span>
                        </td>

                        {/* RS Rating – Badge có màu */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={`
                                inline-flex items-center gap-1 px-3 py-1 rounded-lg
                                text-xs font-bold font-mono
                                ${info.bg} ${info.text}
                              `}
                            >
                              {info.icon}
                              {stock.rs_rating}
                            </div>
                            {/* Thanh tiến trình nhỏ */}
                            <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  stock.rs_rating >= 90
                                    ? "bg-purple-500"
                                    : stock.rs_rating >= 80
                                    ? "bg-emerald-500"
                                    : stock.rs_rating >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${stock.rs_rating}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Nhãn phân loại */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex justify-center">
                            <span
                              className={`
                                inline-flex items-center gap-1 text-[11px] font-semibold
                                px-2.5 py-1 rounded-lg border
                                ${stock.rs_rating >= 90
                                  ? "bg-purple-500/15 text-purple-400 border-purple-500/25"
                                  : stock.rs_rating >= 80
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                  : stock.rs_rating >= 50
                                  ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                                  : "bg-red-500/15 text-red-400 border-red-500/25"
                                }
                              `}
                            >
                              {info.icon}
                              {info.label}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Không có kết quả */}
              {duLieuDaLoc.length === 0 && !loading && (
                <div className="text-center py-16 text-neutral-500 text-sm">
                  Không tìm thấy cổ phiếu phù hợp
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ CÔNG THỨC ═══ */}
        {data.length > 0 && (
          <div className="text-[11px] text-neutral-600 space-y-1 px-1">
            <p>
              <span className="text-neutral-500 font-medium">Công thức:</span>{" "}
              Raw_RS = 0.4 × (C/C63) + 0.2 × (C/C126) + 0.2 × (C/C189) + 0.2 × (C/C252)
            </p>
            <p>
              <span className="text-neutral-500 font-medium">Phương pháp:</span>{" "}
              CANSLIM (William J. O&apos;Neil) — Trọng số 3 tháng gần nhất gấp đôi. Xếp hạng percentile 1–99.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
