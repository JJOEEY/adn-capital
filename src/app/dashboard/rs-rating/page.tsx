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
      bg: "#9333ea",
      text: "#ffffff",
      label: "Siêu Cổ Phiếu",
      loai: "sieu_co_phieu",
      icon: <Crown className="w-3 h-3" />,
    };
  }
  if (rs >= 80) {
    return {
      bg: "#059669",
      text: "#ffffff",
      label: "Dẫn Dắt",
      loai: "dan_dat",
      icon: <Flame className="w-3 h-3" />,
    };
  }
  if (rs >= 50) {
    return {
      bg: "#eab308",
      text: "#000000",
      label: "Trung Bình",
      loai: "trung_binh",
      icon: <Minus className="w-3 h-3" />,
    };
  }
  return {
    bg: "#dc2626",
    text: "#ffffff",
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
  const nutLoc = (label: string, val: typeof filter, soLuong: number, style: React.CSSProperties) => (
    <button
      onClick={() => setFilter(filter === val ? "all" : val)}
      className="text-xs px-3 py-1.5 rounded-lg border transition-all font-medium"
      style={filter === val ? style : { color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface)" }}
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
            <div className="p-2.5 rounded-xl border flex-shrink-0" style={{ background: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.25)" }}>
              <BarChart2 className="w-5 h-5" style={{ color: "#a855f7" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                RS Rating <span style={{ color: "#a855f7" }}>CANSLIM</span>
              </h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: "var(--text-muted)" }}>
                Bảng xếp hạng Sức mạnh Tương đối — {data.length} mã cổ phiếu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-[12px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                Dữ liệu: {updatedAt}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg border transition-all disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ═══ CHÚ THÍCH MÀU SẮC RS ═══ */}
        <div className="flex flex-wrap gap-2">
          {nutLoc("Siêu Cổ Phiếu (≥ 90)", "sieu_co_phieu", thongKe.sieu_co_phieu,
            { background: "rgba(147,51,234,0.20)", color: "#a855f7", borderColor: "rgba(168,85,247,0.40)" })}
          {nutLoc("Dẫn Dắt (80–89)", "dan_dat", thongKe.dan_dat,
            { background: "rgba(5,150,105,0.20)", color: "#10b981", borderColor: "rgba(16,185,129,0.40)" })}
          {nutLoc("Trung Bình (50–79)", "trung_binh", thongKe.trung_binh,
            { background: "rgba(234,179,8,0.20)", color: "#eab308", borderColor: "rgba(234,179,8,0.40)" })}
          {nutLoc("Yếu/Bỏ qua (< 50)", "yeu", thongKe.yeu,
            { background: "rgba(220,38,38,0.20)", color: "#ef4444", borderColor: "rgba(239,68,68,0.40)" })}
        </div>

        {/* ═══ Ô TÌM KIẾM ═══ */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            value={timKiem}
            onChange={(e) => setTimKiem(e.target.value)}
            placeholder="Tìm mã CK hoặc ngành... (VD: FPT, Ngân hàng)"
            className="w-full pl-9 pr-4 py-2.5 border focus:border-[var(--primary)] text-sm rounded-xl outline-none transition-all"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* ═══ LOADING STATE ═══ */}
        {loading && data.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-[var(--surface)] rounded-xl animate-pulse border border-[var(--border)]"
              />
            ))}
            <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
              ⏳ Đang tính toán RS Rating từ dữ liệu FiinQuantX (có thể mất 10–30 giây lần đầu)...
            </p>
          </div>
        ) : error ? (
          /* ═══ ERROR STATE ═══ */
          <div className="text-center py-16 space-y-3">
            <div className="inline-flex p-3 rounded-2xl border" style={{ background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.20)" }}>
              <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>{error}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Kiểm tra FiinQuant Bridge đang chạy tại localhost:8000
            </p>
            <button
              onClick={fetchData}
              className="text-xs hover:underline" style={{ color: "#a855f7" }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          /* ═══ DATA TABLE ═══ */
          <div className="bg-[var(--surface-2)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3 w-12" style={{ color: "var(--text-muted)" }}>
                      #
                    </th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      Mã CK
                    </th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3 hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                      Ngành
                    </th>
                    <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      Giá (₫)
                    </th>
                    <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      RS Rating
                    </th>
                    <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
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
                        className="border-b border-[var(--border)] transition-colors"
                        style={{ background: "transparent" }}
                      >
                        {/* Số thứ tự */}
                        <td className="px-4 py-3 font-mono" style={{ color: "var(--text-muted)" }}>
                          {i + 1}
                        </td>

                        {/* Mã cổ phiếu */}
                        <td className="px-4 py-3">
                          <span className="font-bold text-sm font-mono tracking-wide" style={{ color: "var(--text-primary)" }}>
                            {stock.ticker}
                          </span>
                        </td>

                        {/* Ngành */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{stock.sector}</span>
                        </td>

                        {/* Giá đóng cửa */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                            {formatGia(stock.close)}
                          </span>
                        </td>

                        {/* RS Rating – Badge có màu */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold font-mono"
                              style={{ background: info.bg, color: info.text }}
                            >
                              {info.icon}
                              {stock.rs_rating}
                            </div>
                            {/* Thanh tiến trình nhỏ */}
                            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${stock.rs_rating}%`,
                                  background: stock.rs_rating >= 90 ? "#a855f7" : stock.rs_rating >= 80 ? "#10b981" : stock.rs_rating >= 50 ? "#eab308" : "#ef4444"
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Nhãn phân loại */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex justify-center">
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border"
                              style={stock.rs_rating >= 90
                                ? { background: "rgba(168,85,247,0.15)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" }
                                : stock.rs_rating >= 80
                                ? { background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)" }
                                : stock.rs_rating >= 50
                                ? { background: "rgba(234,179,8,0.15)", color: "#eab308", borderColor: "rgba(234,179,8,0.25)" }
                                : { background: "rgba(239,68,68,0.15)", color: "#ef4444", borderColor: "rgba(239,68,68,0.25)" }
                              }
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
                <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>
                  Không tìm thấy cổ phiếu phù hợp
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ CÔNG THỨC ═══ */}
        {data.length > 0 && (
          <div className="text-[11px] space-y-1 px-1" style={{ color: "var(--text-muted)" }}>
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
