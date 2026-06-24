"use client";

import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";

type MoverSide = "up" | "down";
type MoverTimeframe = "5m" | "15m" | "30m" | "1h" | "1D" | "1W" | "1M" | "3M";

export type PulseTopMoverRow = {
  ticker: string;
  exchange?: string | null;
  sector?: string | null;
  price: number;
  volume: number;
  valueBillion: number;
  marketCapBillion?: number | null;
  changePercent1D: number;
  periodChangePercent: number;
};

export type PulseTopMoverFrame = {
  enabled: boolean;
  label: string;
  rows?: PulseTopMoverRow[];
  missingReason?: string | null;
};

export type PulseTopMoversPayload = {
  defaultTimeframe?: MoverTimeframe;
  timeframes?: Partial<Record<MoverTimeframe, PulseTopMoverFrame>>;
  updatedAt?: string | null;
};

const TIMEFRAMES: Array<{ key: MoverTimeframe; label: string }> = [
  { key: "1D", label: "Hôm nay" },
  { key: "1W", label: "Tuần" },
  { key: "1M", label: "Tháng" },
  { key: "3M", label: "3 tháng" },
  { key: "5m", label: "5 phút" },
  { key: "15m", label: "15 phút" },
  { key: "30m", label: "30 phút" },
  { key: "1h", label: "1 giờ" },
];

const LIQUIDITY_OPTIONS = [
  { key: "all", label: "Không hạn chế", minValue: 0 },
  { key: "5b", label: "GTGD từ 5 tỷ", minValue: 5 },
  { key: "10b", label: "GTGD từ 10 tỷ", minValue: 10 },
  { key: "20b", label: "GTGD từ 20 tỷ", minValue: 20 },
  { key: "100b", label: "GTGD từ 100 tỷ", minValue: 100 },
];

const MARKET_CAP_OPTIONS = [
  { key: "all", label: "Tất cả", test: (_value: number | null | undefined) => true },
  { key: "large", label: "Vốn hóa lớn từ 10.000 tỷ", test: (value: number | null | undefined) => value != null && value >= 10_000 },
  { key: "mid", label: "Vốn hóa vừa 1.000-10.000 tỷ", test: (value: number | null | undefined) => value != null && value >= 1_000 && value < 10_000 },
  { key: "small", label: "Vốn hóa nhỏ dưới 1.000 tỷ", test: (value: number | null | undefined) => value != null && value < 1_000 },
];

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatVolume(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} ng`;
  return new Intl.NumberFormat("vi-VN").format(Math.round(value));
}

function formatValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)} tỷ`;
}

function frameHasRows(frame: PulseTopMoverFrame | null | undefined) {
  return Boolean(frame?.enabled && Array.isArray(frame.rows) && frame.rows.length > 0);
}

export function PulseTopMoversCard({ data }: { data: PulseTopMoversPayload | null }) {
  const [side, setSide] = useState<MoverSide>("up");
  const [timeframe, setTimeframe] = useState<MoverTimeframe>(data?.defaultTimeframe ?? "1D");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exchange, setExchange] = useState("ALL");
  const [marketCap, setMarketCap] = useState("all");
  const [liquidity, setLiquidity] = useState("all");

  const resolvedTimeframe = useMemo<MoverTimeframe>(() => {
    const selectedFrame = data?.timeframes?.[timeframe];
    if (frameHasRows(selectedFrame)) return timeframe;
    const fallback = TIMEFRAMES.find((item) => frameHasRows(data?.timeframes?.[item.key]));
    return fallback?.key ?? timeframe;
  }, [data?.timeframes, timeframe]);

  const currentFrame = data?.timeframes?.[resolvedTimeframe] ?? null;
  const selectedLabel = TIMEFRAMES.find((item) => item.key === timeframe)?.label ?? timeframe;
  const resolvedLabel = currentFrame?.label || TIMEFRAMES.find((item) => item.key === resolvedTimeframe)?.label || resolvedTimeframe;
  const usingFallback = resolvedTimeframe !== timeframe && frameHasRows(currentFrame);

  const rows = useMemo(() => {
    const minValue = LIQUIDITY_OPTIONS.find((item) => item.key === liquidity)?.minValue ?? 0;
    const marketCapFilter = MARKET_CAP_OPTIONS.find((item) => item.key === marketCap) ?? MARKET_CAP_OPTIONS[0];
    const raw = Array.isArray(currentFrame?.rows) ? currentFrame.rows : [];
    return raw
      .filter((row) => (exchange === "ALL" ? true : row.exchange === exchange))
      .filter((row) => marketCapFilter.test(row.marketCapBillion))
      .filter((row) => row.valueBillion >= minValue)
      .filter((row) => (side === "up" ? row.periodChangePercent > 0 : row.periodChangePercent < 0))
      .sort((a, b) =>
        side === "up"
          ? b.periodChangePercent - a.periodChangePercent || b.valueBillion - a.valueBillion
          : a.periodChangePercent - b.periodChangePercent || b.valueBillion - a.valueBillion,
      )
      .slice(0, 20);
  }, [currentFrame?.rows, exchange, liquidity, marketCap, side]);

  return (
    <div className="rounded-xl border p-3 h-full flex flex-col" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            Top biến động
          </div>
          <div className="mt-1 flex rounded-full p-0.5" style={{ background: "var(--bg-hover)" }}>
            {(["up", "down"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSide(item)}
                className="rounded-full px-3 py-1 text-[11px] font-black"
                style={{
                  background: side === item ? "var(--surface)" : "transparent",
                  color: side === item ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {item === "up" ? "Tăng giá" : "Giảm giá"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value as MoverTimeframe)}
            className="rounded-lg border px-2 py-1 text-[11px] font-bold"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
          >
            {TIMEFRAMES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="rounded-lg border p-1.5"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            title="Bộ lọc"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!frameHasRows(currentFrame) ? (
        <div className="flex h-48 items-center justify-center rounded-lg border px-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {currentFrame?.missingReason ?? `Chưa có dữ liệu phù hợp cho khung ${selectedLabel}.`}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border px-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Không có mã phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="relative flex-1 min-h-0">
          {/* List tuyệt đối: không tính vào chiều cao hàng grid → card cao bằng 2 ô kia, dài hơn thì cuộn. */}
          <div className="absolute inset-0 overflow-auto">
          {usingFallback ? (
            <div className="mb-2 rounded-lg border px-3 py-2 text-[11px] font-bold" style={{ borderColor: "rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
              Đang dùng dữ liệu gần nhất: {resolvedLabel}
            </div>
          ) : null}
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <th className="py-2 text-left">Mã CK</th>
                <th className="py-2 text-right">Giá</th>
                <th className="py-2 text-right">KLGD</th>
                <th className="py-2 text-right">GTGD</th>
                <th className="py-2 text-right">%1D</th>
                <th className="py-2 text-right">{resolvedLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const tone = row.periodChangePercent >= 0 ? "#10b981" : "#ef4444";
                return (
                  <tr key={`${row.ticker}-${resolvedTimeframe}`} className="border-b text-[12px]" style={{ borderColor: "rgba(148,163,184,0.12)", animation: `topMoverIn 360ms ease-out ${Math.min(index * 16, 220)}ms both` }}>
                    <td className="py-2 font-black" style={{ color: tone }}>{row.ticker}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{formatPrice(row.price)}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: "var(--text-secondary)" }}>{formatVolume(row.volume)}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: "var(--text-secondary)" }}>{formatValue(row.valueBillion)}</td>
                    <td className="py-2 text-right">
                      <span className="rounded-md px-2 py-1 font-black" style={{ background: row.changePercent1D >= 0 ? "rgba(16,185,129,0.16)" : "rgba(239,68,68,0.16)", color: row.changePercent1D >= 0 ? "#10b981" : "#ef4444" }}>
                        {formatPct(row.changePercent1D)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="rounded-md px-2 py-1 font-black" style={{ background: row.periodChangePercent >= 0 ? "rgba(16,185,129,0.86)" : "rgba(239,68,68,0.86)", color: "#fff" }}>
                        {formatPct(row.periodChangePercent)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {filterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Bộ lọc</div>
              <button type="button" onClick={() => setFilterOpen(false)} className="rounded-full p-2" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Sàn giao dịch</span>
                <select value={exchange} onChange={(event) => setExchange(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}>
                  <option value="ALL">Tất cả</option>
                  <option value="HOSE">HoSE</option>
                  <option value="HNX">HNX</option>
                  <option value="UPCOM">UPCOM</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Vốn hóa</span>
                <select value={marketCap} onChange={(event) => setMarketCap(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}>
                  {MARKET_CAP_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Thanh khoản</span>
                <select value={liquidity} onChange={(event) => setLiquidity(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}>
                  {LIQUIDITY_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setFilterOpen(false)} className="w-full rounded-xl px-3 py-3 text-sm font-black" style={{ background: "var(--primary)", color: "var(--bg)" }}>
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes topMoverIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
