"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  FlaskConical,
  LineChart,
  Play,
  Plus,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { fetchBacktestManifest, runBacktestProvider } from "@/lib/providers/client";
import type { ProviderInputValue, ProviderRunResponse } from "@/types/provider-manifest";

function fmtEq(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(0)} tr`;
  return Math.round(v).toLocaleString("vi-VN");
}

type ScopeType = "index" | "ticker" | "watchlist" | "sector";
type UnknownRecord = Record<string, unknown>;
type SavedStrategy = { id: string; name: string; config: UnknownRecord; result: UnknownRecord; pinned?: boolean; createdAt: string };

interface ConditionOption {
  id: string;
  label: string;
  group: string;
  description: string;
}

interface LabAssumptions {
  startDate: string;
  endDate: string;
  capital: number;
  fee: number;
  slippage: number;
  minLiquidity: number;
  maxPositions: number;
  weightPercent: number;
  positionDrawdown: number;
  strategyDrawdown: number;
  benchmark: string;
}

const MAX_CONDITIONS = 20;

const scopeOptions: Array<{ value: ScopeType; label: string; helper: string }> = [
  { value: "index", label: "Rổ chỉ số", helper: "VN30, VN100, HOSE, HNX, UPCOM" },
  { value: "ticker", label: "Cổ phiếu riêng", helper: "Kiểm định một mã cụ thể" },
  { value: "watchlist", label: "Danh mục", helper: "Watchlist hoặc danh mục nội bộ" },
  { value: "sector", label: "Nhóm ngành", helper: "Ngân hàng, chứng khoán, dầu khí..." },
];

const indexOptions = ["VN30", "VN100", "HOSE", "HNX", "UPCOM"];
const watchlistOptions = ["ADN Radar 500", "Cổ phiếu thanh khoản cao", "VN30 mở rộng", "Danh mục tự chọn"];
const sectorOptions = [
  "Ngân hàng",
  "Chứng khoán",
  "Bất động sản",
  "Dầu khí",
  "Thép",
  "Bán lẻ",
  "Công nghệ",
  "Khu công nghiệp",
  "Hóa chất",
  "Vật liệu xây dựng",
];
const benchmarkOptions = ["VNINDEX", "VN30", "Buy-and-hold cùng mã"];

const buyConditions: ConditionOption[] = [
  { id: "price", label: "Giá cổ phiếu", group: "Thông tin cổ phiếu", description: "Lọc theo vùng giá tối thiểu hoặc tối đa." },
  { id: "market_cap", label: "Vốn hóa", group: "Thông tin cổ phiếu", description: "Ưu tiên cổ phiếu có quy mô phù hợp." },
  { id: "avg_value", label: "GTGD trung bình", group: "Thông tin cổ phiếu", description: "Loại bỏ mã có thanh khoản quá thấp." },
  { id: "volume_spike", label: "%KLGD đột biến", group: "Thông tin cổ phiếu", description: "Phát hiện khối lượng tăng bất thường." },
  { id: "ema_ma", label: "EMA/MA", group: "Kỹ thuật", description: "Giá nằm trên hoặc vượt đường trung bình." },
  { id: "macd", label: "MACD", group: "Kỹ thuật", description: "Động lượng cải thiện hoặc xác nhận xu hướng." },
  { id: "rsi", label: "RSI", group: "Kỹ thuật", description: "Đánh giá sức mạnh ngắn hạn, tránh mua quá nóng." },
  { id: "bollinger", label: "Bollinger Band", group: "Kỹ thuật", description: "Kiểm tra nền giá, biên dao động và điểm bung nền." },
  { id: "stoch_rsi", label: "StochRSI", group: "Kỹ thuật", description: "Bắt nhịp hồi phục động lượng ngắn hạn." },
  { id: "rs", label: "RS", group: "Kỹ thuật", description: "Ưu tiên mã khỏe hơn thị trường chung." },
  { id: "technical_cross", label: "Giá vượt/giá cắt đường kỹ thuật", group: "Kỹ thuật", description: "Giá vượt kháng cự, MA hoặc vùng kỹ thuật quan trọng." },
  { id: "pe", label: "P/E", group: "Định giá", description: "So sánh mức định giá theo lợi nhuận." },
  { id: "pb", label: "P/B", group: "Định giá", description: "So sánh mức định giá theo giá trị sổ sách." },
  { id: "roe", label: "ROE", group: "Định giá", description: "Đánh giá hiệu quả sử dụng vốn chủ sở hữu." },
  { id: "roa", label: "ROA", group: "Định giá", description: "Đánh giá hiệu quả sử dụng tài sản." },
  { id: "eps", label: "EPS", group: "Định giá", description: "Theo dõi lợi nhuận trên mỗi cổ phiếu." },
  { id: "eps_growth", label: "Tăng trưởng EPS", group: "Định giá", description: "Ưu tiên doanh nghiệp có tăng trưởng lợi nhuận." },
  { id: "foreign_buy", label: "Khối ngoại mua ròng", group: "Dòng tiền", description: "Theo dõi lực mua từ nhà đầu tư nước ngoài." },
  { id: "proprietary_buy", label: "Tự doanh mua ròng", group: "Dòng tiền", description: "Theo dõi lực mua từ tự doanh." },
  { id: "individual_buy", label: "Cá nhân mua ròng", group: "Dòng tiền", description: "Theo dõi dòng tiền từ nhà đầu tư cá nhân." },
  { id: "cashflow_value", label: "GTGD mua/bán ròng", group: "Dòng tiền", description: "Xác nhận dòng tiền bằng giá trị giao dịch." },
];

const sellConditions: ConditionOption[] = [
  { id: "ema_ma_sell", label: "EMA/MA", group: "Kỹ thuật", description: "Thoát khi giá thủng đường trung bình quan trọng." },
  { id: "macd_sell", label: "MACD", group: "Kỹ thuật", description: "Thoát khi động lượng suy yếu rõ." },
  { id: "rsi_sell", label: "RSI", group: "Kỹ thuật", description: "Thoát khi lực tăng suy yếu hoặc quá nóng." },
  { id: "bollinger_sell", label: "Bollinger Band", group: "Kỹ thuật", description: "Thoát khi giá phá biên rủi ro hoặc thất bại sau bung nền." },
  { id: "stoch_rsi_sell", label: "StochRSI", group: "Kỹ thuật", description: "Thoát khi động lượng ngắn hạn đảo chiều." },
  { id: "rs_sell", label: "RS", group: "Kỹ thuật", description: "Thoát khi cổ phiếu yếu đi so với thị trường." },
  { id: "technical_cross_sell", label: "Giá vượt/giá cắt đường kỹ thuật", group: "Kỹ thuật", description: "Thoát khi giá cắt xuống hỗ trợ hoặc vùng kỹ thuật." },
  { id: "foreign_sell", label: "Khối ngoại bán ròng", group: "Dòng tiền", description: "Cảnh báo áp lực bán từ khối ngoại." },
  { id: "proprietary_sell", label: "Tự doanh bán ròng", group: "Dòng tiền", description: "Cảnh báo áp lực bán từ tự doanh." },
  { id: "individual_sell", label: "Cá nhân bán ròng", group: "Dòng tiền", description: "Cảnh báo áp lực bán từ nhà đầu tư cá nhân." },
  { id: "cashflow_sell", label: "GTGD mua/bán ròng", group: "Dòng tiền", description: "Theo dõi áp lực bán bằng giá trị giao dịch." },
  { id: "take_profit", label: "Chốt lời", group: "Quản trị rủi ro", description: "Khóa lợi nhuận khi đạt vùng mục tiêu." },
  { id: "stop_loss", label: "Cắt lỗ", group: "Quản trị rủi ro", description: "Thoát khi vị thế đi sai kịch bản." },
  { id: "trailing_stop", label: "Trailing stop", group: "Quản trị rủi ro", description: "Dời điểm bảo vệ lợi nhuận theo xu hướng." },
  { id: "position_drawdown", label: "Drawdown theo vị thế", group: "Quản trị rủi ro", description: "Thoát khi một vị thế sụt giảm quá giới hạn." },
];

const defaultAssumptions: LabAssumptions = {
  startDate: "2025-05-08",
  endDate: "2026-05-08",
  capital: 100_000_000,
  fee: 0.15,
  slippage: 0.1,
  minLiquidity: 5,
  maxPositions: 5,
  weightPercent: 20,
  positionDrawdown: 7,
  strategyDrawdown: 20,
  benchmark: "VNINDEX",
};

type ParamField = (
  | { key: string; label: string; type: "number"; default: number; step?: number }
  | { key: string; label: string; type: "select"; default: string; options: { value: string; label: string }[] }
) & { showIf?: (p: Record<string, string | number>) => boolean };

const OP_OPTS = [
  { value: "lt", label: "<" },
  { value: "gt", label: ">" },
  { value: "between", label: "Trong khoảng" },
];

// Tham số mỗi điều kiện — KHỚP DEFAULTS của engine backtest_engine.py.
const CONDITION_PARAMS: Record<string, ParamField[]> = {
  price: [
    { key: "min", label: "Giá tối thiểu (nghìn)", type: "number", default: 0 },
    { key: "max", label: "Giá tối đa (0 = ∞)", type: "number", default: 0 },
  ],
  avg_value: [{ key: "minTy", label: "GTGD TB ≥ (tỷ)", type: "number", default: 5 }],
  volume_spike: [{ key: "mult", label: "KLGD ≥ ×TB20", type: "number", default: 1.5, step: 0.1 }],
  ema_ma: [
    { key: "period", label: "Kỳ EMA", type: "number", default: 20 },
    { key: "mode", label: "Cách so", type: "select", default: "above", options: [
      { value: "above", label: "Giá trên EMA" }, { value: "cross_up", label: "Giá cắt lên EMA" }, { value: "fast_above_slow", label: "EMA nhanh > chậm" } ] },
    { key: "slow", label: "EMA chậm (chế độ nhanh-chậm)", type: "number", default: 50 },
  ],
  macd: [
    { key: "fast", label: "Nhanh", type: "number", default: 12 },
    { key: "slow", label: "Chậm", type: "number", default: 26 },
    { key: "signal", label: "Signal", type: "number", default: 9 },
    { key: "mode", label: "Tín hiệu", type: "select", default: "hist_pos", options: [
      { value: "hist_pos", label: "Histogram > 0" }, { value: "cross_up", label: "Cắt lên signal" } ] },
  ],
  rsi: [
    { key: "op", label: "Toán tử", type: "select", default: "between", options: OP_OPTS },
    { key: "low", label: "Ngưỡng", type: "number", default: 50, showIf: (p) => String(p.op ?? "between") !== "gt" },
    { key: "high", label: "Ngưỡng", type: "number", default: 70, showIf: (p) => { const op = String(p.op ?? "between"); return op === "between" || op === "gt"; } },
  ],
  bollinger: [
    { key: "period", label: "Kỳ", type: "number", default: 20 },
    { key: "std", label: "Độ lệch chuẩn", type: "number", default: 2, step: 0.5 },
    { key: "mode", label: "Điểm vào", type: "select", default: "above_mid", options: [
      { value: "above_mid", label: "Trên dải giữa" }, { value: "break_upper", label: "Bung biên trên" }, { value: "bounce_lower", label: "Bật biên dưới" } ] },
  ],
  stoch_rsi: [
    { key: "op", label: "Toán tử", type: "select", default: "between", options: OP_OPTS },
    { key: "low", label: "Ngưỡng", type: "number", default: 20, showIf: (p) => String(p.op ?? "between") !== "gt" },
    { key: "high", label: "Ngưỡng", type: "number", default: 80, showIf: (p) => { const op = String(p.op ?? "between"); return op === "between" || op === "gt"; } },
  ],
  rs: [
    { key: "period", label: "Kỳ so sánh", type: "number", default: 20 },
    { key: "minOut", label: "Vượt benchmark ≥ (%)", type: "number", default: 0 },
  ],
  technical_cross: [{ key: "lookback", label: "Đỉnh N phiên", type: "number", default: 20 }],
  ema_ma_sell: [
    { key: "period", label: "Kỳ EMA", type: "number", default: 20 },
    { key: "mode", label: "Cách so", type: "select", default: "below", options: [
      { value: "below", label: "Giá dưới EMA" }, { value: "cross_down", label: "Giá cắt xuống EMA" } ] },
  ],
  macd_sell: [
    { key: "fast", label: "Nhanh", type: "number", default: 12 },
    { key: "slow", label: "Chậm", type: "number", default: 26 },
    { key: "signal", label: "Signal", type: "number", default: 9 },
    { key: "mode", label: "Tín hiệu", type: "select", default: "cross_down", options: [
      { value: "cross_down", label: "Cắt xuống signal" }, { value: "hist_neg", label: "Histogram < 0 (động lượng âm)" } ] },
  ],
  rsi_sell: [
    { key: "op", label: "Toán tử", type: "select", default: "gt", options: [{ value: "gt", label: ">" }, { value: "lt", label: "<" }] },
    { key: "value", label: "Ngưỡng", type: "number", default: 75 },
  ],
  bollinger_sell: [
    { key: "period", label: "Kỳ", type: "number", default: 20 },
    { key: "std", label: "Độ lệch chuẩn", type: "number", default: 2, step: 0.5 },
  ],
  stoch_rsi_sell: [{ key: "value", label: "Ngưỡng quá mua", type: "number", default: 80 }],
  rs_sell: [{ key: "period", label: "Kỳ so sánh", type: "number", default: 20 }],
  technical_cross_sell: [{ key: "period", label: "Kỳ MA", type: "number", default: 50 }],
  take_profit: [{ key: "percent", label: "Chốt lời (%)", type: "number", default: 15 }],
  stop_loss: [{ key: "percent", label: "Cắt lỗ (%)", type: "number", default: 7 }],
  trailing_stop: [{ key: "percent", label: "Trailing (%)", type: "number", default: 7 }],
  position_drawdown: [{ key: "percent", label: "DD vị thế (%)", type: "number", default: 7 }],
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatNumber(value: unknown, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Chưa chạy";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function formatPercent(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Chưa chạy";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(1)}%`;
}

function formatDrawdown(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Chưa chạy";
  const normalized = Math.abs(value) <= 1 ? Math.abs(value * 100) : Math.abs(value);
  return `-${normalized.toFixed(1)}%`;
}

function pickNumber(source: UnknownRecord | null, keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function getResultRecord(result: ProviderRunResponse | null) {
  if (!result || !isRecord(result.result)) return null;
  return result.result;
}

function getMetrics(result: ProviderRunResponse | null) {
  const record = getResultRecord(result);
  if (!record) return null;
  if (isRecord(record.metrics)) return record.metrics;
  if (isRecord(record.kpi)) return record.kpi;
  if (isRecord(record.performance)) return record.performance;
  if (isRecord(record.result) && isRecord(record.result.metrics)) return record.result.metrics;
  return record;
}

function getEquityCurve(result: ProviderRunResponse | null): { date: string; value: number; benchmark: number | null }[] {
  const record = getResultRecord(result);
  const raw = record && Array.isArray(record.equityCurve) ? record.equityCurve : [];
  return raw
    .filter(isRecord)
    .map((p) => ({
      date: String(p.date ?? ""),
      value: typeof p.value === "number" ? p.value : Number(p.value) || 0,
      benchmark:
        p.benchmark == null ? null : typeof p.benchmark === "number" ? p.benchmark : Number(p.benchmark) || null,
    }))
    .filter((p) => Boolean(p.date));
}

function getAllTrades(result: ProviderRunResponse | null): UnknownRecord[] {
  const record = getResultRecord(result);
  if (!record) return [];
  const raw = Array.isArray(record.trades)
    ? record.trades
    : isRecord(record.result) && Array.isArray(record.result.trades)
      ? record.result.trades
      : [];
  return raw.filter(isRecord);
}

function tradePnl(t: UnknownRecord): number | null {
  const raw = t.pnl ?? t.return;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

type TradeAnalysis = {
  total: number; wins: number; losses: number; winRate: number;
  avgPnl: number; avgWin: number; avgLoss: number; rr: number;
  best: { ticker: string; pnl: number } | null;
  worst: { ticker: string; pnl: number } | null;
  distribution: { bucket: number; label: string; count: number }[];
};

function analyzeTrades(trades: UnknownRecord[]): TradeAnalysis {
  const rows = trades
    .map((t) => ({ ticker: safeText(t.ticker), pnl: tradePnl(t) }))
    .filter((x): x is { ticker: string; pnl: number } => x.pnl !== null);
  const total = rows.length;
  const wins = rows.filter((x) => x.pnl > 0);
  const losses = rows.filter((x) => x.pnl < 0);
  const sum = (arr: { pnl: number }[]) => arr.reduce((s, x) => s + x.pnl, 0);
  const avgWin = wins.length ? sum(wins) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(sum(losses) / losses.length) : 0;
  let best: { ticker: string; pnl: number } | null = null;
  let worst: { ticker: string; pnl: number } | null = null;
  for (const x of rows) {
    if (!best || x.pnl > best.pnl) best = x;
    if (!worst || x.pnl < worst.pnl) worst = x;
  }
  const buckets = new Map<number, number>();
  for (const x of rows) {
    const b = Math.floor(x.pnl / 5) * 5;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const distribution = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, count]) => ({ bucket, label: `${bucket >= 0 ? "+" : ""}${bucket}%`, count }));
  return {
    total, wins: wins.length, losses: losses.length,
    winRate: total ? (wins.length / total) * 100 : 0,
    avgPnl: total ? sum(rows) / total : 0,
    avgWin, avgLoss, rr: avgLoss > 0 ? avgWin / avgLoss : 0,
    best, worst, distribution,
  };
}

function getWarnings(result: ProviderRunResponse | null): string[] {
  if (!result) return [];
  const top = Array.isArray(result.warnings) ? result.warnings : [];
  const rec = getResultRecord(result);
  const nested = rec && Array.isArray(rec.warnings) ? rec.warnings : [];
  return Array.from(new Set([...top, ...nested].filter((w): w is string => typeof w === "string" && w.trim().length > 0)));
}

function groupConditions(options: ConditionOption[]) {
  return options.reduce<Record<string, ConditionOption[]>>((acc, option) => {
    acc[option.group] = [...(acc[option.group] ?? []), option];
    return acc;
  }, {});
}

function shortList(labels: string[]) {
  if (labels.length === 0) return "Chưa chọn";
  if (labels.length <= 4) return labels.join(" + ");
  return `${labels.slice(0, 4).join(" + ")} + ${labels.length - 4} điều kiện`;
}

function buildCoachDiagnosis(metrics: UnknownRecord | null, result: ProviderRunResponse | null) {
  const response = result as unknown as UnknownRecord | null;
  if (typeof response?.insight === "string") return response.insight;
  if (typeof response?.summary === "string") return response.summary;
  if (!metrics) {
    return "ADN Coach chỉ phân tích sau khi có kết quả kiểm định thật. Nếu bộ kiểm định chưa trả kết quả, hãy xem demo ADN hiện tại bên dưới để đối chiếu cách trình bày.";
  }

  const netReturn = pickNumber(metrics, ["netReturn", "net_return", "totalReturn", "total_return", "return"]);
  const maxDrawdown = pickNumber(metrics, ["maxDrawdown", "max_drawdown", "drawdown"]);
  const trades = pickNumber(metrics, ["numberOfTrades", "totalTrades", "total_trades", "trades"]);

  const notes: string[] = [];
  if (typeof netReturn === "number") {
    notes.push(
      netReturn > 0
        ? "Chiến thuật có lợi nhuận dương trong giai đoạn kiểm định."
        : "Chiến thuật chưa tạo lợi nhuận dương trong giai đoạn kiểm định.",
    );
  }
  if (typeof maxDrawdown === "number") {
    const dd = Math.abs(Math.abs(maxDrawdown) <= 1 ? maxDrawdown * 100 : maxDrawdown);
    notes.push(
      dd > 20
        ? "Drawdown cao, cần giảm tỷ trọng hoặc siết điều kiện thoát lệnh."
        : "Drawdown đang ở vùng có thể kiểm soát, nhưng vẫn cần kiểm tra thêm theo từng giai đoạn.",
    );
  }
  if (typeof trades === "number") {
    notes.push(
      trades < 20
        ? "Số lệnh còn thấp, chưa đủ mẫu để kết luận chắc chắn."
        : "Số lệnh đủ để bắt đầu đọc chất lượng chiến thuật, nhưng vẫn nên forward test.",
    );
  }
  notes.push("Không nên dùng tiền thật ngay; hãy kiểm tra thêm phí, trượt giá và giai đoạn thị trường xấu.");
  return notes.join(" ");
}

function safeText(value: unknown, fallback = "-") {
  if (value == null) return fallback;
  if (typeof value === "number") return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
  return String(value);
}

function ParamInput({ field, value, onChange }: { field: ParamField; value: string | number; onChange: (v: string | number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{field.label}</span>
      {field.type === "select" ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs font-semibold outline-none"
          style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type="number"
          value={String(value)}
          step={field.step ?? 1}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs font-semibold outline-none"
          style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
        />
      )}
    </label>
  );
}

// Modal chọn điều kiện — chỉ checkbox theo nhóm (tham số chỉnh sau ở chip), gọn như DNSE.
function ConditionModal({
  side,
  options,
  selected,
  onToggle,
  onClose,
}: {
  side: "buy" | "sell";
  options: ConditionOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const grouped = groupConditions(options);
  const applyColor = side === "buy" ? "#16a34a" : "#dc2626";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div
        className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-6 shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Thêm điều kiện {side === "buy" ? "Mua" : "Bán"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <X className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <p className="mt-1 text-xs font-semibold" style={{ color: "#f59e0b" }}>
          *Chỉ được chọn tối đa {MAX_CONDITIONS} điều kiện Mua và Bán
        </p>
        <div className="mt-4 space-y-5">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{group}</p>
              <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const checked = selected.includes(item.id);
                  return (
                    <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={checked} onChange={() => onToggle(item.id)} className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: applyColor }}
          >
            Áp dụng điều kiện {side === "buy" ? "Mua" : "Bán"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Chip điều kiện đã thêm — gọn, chỉnh tham số ngay tại chỗ.
function ConditionChip({
  item,
  params,
  onParam,
  onRemove,
}: {
  item: ConditionOption;
  params: Record<string, Record<string, string | number>>;
  onParam: (id: string, key: string, value: string | number) => void;
  onRemove: () => void;
}) {
  const fields = CONDITION_PARAMS[item.id];
  const visible = fields ? fields.filter((f) => !f.showIf || f.showIf(params[item.id] ?? {})) : [];
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</span>
        <button type="button" onClick={onRemove} title="Xoá điều kiện" className="shrink-0">
          <Trash2 className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>
      {visible.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {visible.map((f) => (
            <ParamInput key={f.key} field={f} value={params[item.id]?.[f.key] ?? f.default} onChange={(v) => onParam(item.id, f.key, v)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NumberInput({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex items-center rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-bold outline-none"
          style={{ color: "var(--text-primary)" }}
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? (
          <span className="px-3 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

// Dashboard kết quả kiểu DNSE — KPI, donut tỷ lệ thắng, phân phối lợi nhuận, best/worst, bảng deal.
function ResultDashboard({
  metrics,
  analysis,
  trades,
  warnings,
}: {
  metrics: UnknownRecord | null;
  analysis: TradeAnalysis;
  trades: UnknownRecord[];
  warnings: string[];
}) {
  const [q, setQ] = useState("");
  const netReturn = pickNumber(metrics, ["netReturn", "net_return", "totalReturn", "total_return", "return"]);
  const nrColor = typeof netReturn === "number" ? (netReturn >= 0 ? "#16a34a" : "#dc2626") : "var(--text-primary)";
  const donut = [
    { name: "Số deal lãi", value: analysis.wins, color: "#16a34a" },
    { name: "Số deal lỗ", value: analysis.losses, color: "#dc2626" },
  ];
  const ql = q.trim().toUpperCase();
  const shown = ql ? trades.filter((t) => safeText(t.ticker).toUpperCase().includes(ql)) : trades;
  return (
    <div className="space-y-4">
      {warnings.length > 0 ? (
        <div className="space-y-1 rounded-2xl border p-3 text-sm leading-6" style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
          {warnings.map((w, i) => (
            <p key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{w}</span></p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Lãi/lỗ luỹ kế</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: nrColor }}>{formatPercent(netReturn)}</p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Rủi ro/lợi nhuận</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>1:{analysis.rr.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270} paddingAngle={2} stroke="none">
                    {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Tỷ lệ thắng</span>
                <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{analysis.winRate.toFixed(2)}%</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#16a34a" }} /> Lãi {analysis.wins}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#dc2626" }} /> Lỗ {analysis.losses}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Phân phối lợi nhuận</p>
          {analysis.distribution.length > 0 ? (
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.distribution} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval={0} axisLine={false} tickLine={false} angle={-40} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--border)", fillOpacity: 0.2 }} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} formatter={(v) => [`${v} deal`, "Số lượng"]} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {analysis.distribution.map((d) => <Cell key={d.bucket} fill={d.bucket < 0 ? "#dc2626" : "#16a34a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-3 flex h-64 items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa đủ deal để vẽ phân phối.</div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>CAGR</p>
          <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>{formatPercent(pickNumber(metrics, ["cagr", "annualizedReturn", "annualized_return"]))}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Max Drawdown</p>
          <p className="mt-1 text-lg font-bold" style={{ color: "#dc2626" }}>{formatDrawdown(pickNumber(metrics, ["maxDrawdown", "max_drawdown", "drawdown"]))}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Profit Factor</p>
          <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(pickNumber(metrics, ["profitFactor", "profit_factor"]))}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Lãi trung bình/deal</p>
          <p className="mt-1 text-lg font-bold" style={{ color: analysis.avgPnl >= 0 ? "#16a34a" : "#dc2626" }}>{analysis.avgPnl >= 0 ? "+" : ""}{analysis.avgPnl.toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Số lượng deal</p>
          <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>{analysis.total}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Lãi nhiều nhất</p>
          <p className="mt-1 text-lg font-bold" style={{ color: "#16a34a" }}>{analysis.best ? `${analysis.best.ticker} +${analysis.best.pnl}%` : "—"}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Lỗ nhiều nhất</p>
          <p className="mt-1 text-lg font-bold" style={{ color: "#dc2626" }}>{analysis.worst ? `${analysis.worst.ticker} ${analysis.worst.pnl}%` : "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <Search className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã CK" className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="mt-3 max-h-[440px] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead style={{ color: "var(--text-muted)" }}>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                <th className="py-2.5">Mã</th><th>Ngày mua</th><th>Giá mua</th><th>Ngày bán</th><th>Giá bán</th><th className="text-right">Lãi/lỗ</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? shown.map((trade, index) => {
                const pnl = tradePnl(trade);
                const win = pnl !== null && pnl >= 0;
                const color = pnl === null ? "var(--text-secondary)" : win ? "#16a34a" : "#dc2626";
                return (
                  <tr key={`${safeText(trade.ticker, "T")}-${index}`} className="border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <td className="py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>{safeText(trade.ticker)}</td>
                    <td>{safeText(trade.entryDate ?? trade.dateIn ?? trade.date)}</td>
                    <td><span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: "#16a34a" }}>M</span>{safeText(trade.entry ?? trade.entryPrice)}</td>
                    <td>{safeText(trade.exitDate ?? trade.dateOut)}</td>
                    <td><span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: "#dc2626" }}>B</span>{safeText(trade.exit ?? trade.exitPrice)}</td>
                    <td className="text-right font-bold" style={{ color }}>{pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl}%` : "—"}</td>
                  </tr>
                );
              }) : (
                <tr><td className="py-5 text-center" colSpan={6} style={{ color: "var(--text-muted)" }}>Không có deal khớp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function StrategyValidationStudio() {
  const [strategyName, setStrategyName] = useState("Chiến thuật mới");
  const [scope, setScope] = useState<ScopeType>("ticker");
  const [selection, setSelection] = useState("FPT");
  const [buySelected, setBuySelected] = useState<string[]>(["ema_ma", "volume_spike", "rsi"]);
  const [sellSelected, setSellSelected] = useState<string[]>(["ema_ma_sell", "stop_loss"]);
  const [assumptions, setAssumptions] = useState<LabAssumptions>(defaultAssumptions);
  const [conditionParams, setConditionParams] = useState<Record<string, Record<string, string | number>>>({});
  const [buyLogic, setBuyLogic] = useState<"and" | "or">("and");
  const [sellLogic, setSellLogic] = useState<"and" | "or">("or");
  const [modalSide, setModalSide] = useState<"buy" | "sell" | null>(null);
  const [resultTab, setResultTab] = useState<"dashboard" | "equity" | "coach" | "history">("dashboard");
  const [result, setResult] = useState<ProviderRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [saved, setSaved] = useState<SavedStrategy[]>([]);
  const [saving, setSaving] = useState(false);
  const [coachAi, setCoachAi] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const selectedCount = buySelected.length + sellSelected.length;
  const buyLabels = useMemo(
    () => buyConditions.filter((item) => buySelected.includes(item.id)).map((item) => item.label),
    [buySelected],
  );
  const sellLabels = useMemo(
    () => sellConditions.filter((item) => sellSelected.includes(item.id)).map((item) => item.label),
    [sellSelected],
  );
  const metrics = getMetrics(result);
  const equityCurve = getEquityCurve(result);
  const runWarnings = getWarnings(result);
  const allTrades = useMemo(() => getAllTrades(result), [result]);
  const analysis = useMemo(() => analyzeTrades(allTrades), [allTrades]);

  const scopeValues = scope === "index" ? indexOptions : scope === "watchlist" ? watchlistOptions : scope === "sector" ? sectorOptions : [];

  const updateAssumption = <K extends keyof LabAssumptions>(key: K, value: LabAssumptions[K]) => {
    setAssumptions((current) => ({ ...current, [key]: value }));
  };

  const setConditionParam = (id: string, key: string, value: string | number) => {
    setConditionParams((cur) => ({ ...cur, [id]: { ...(cur[id] ?? {}), [key]: value } }));
  };

  const toggleCondition = (id: string, side: "buy" | "sell") => {
    const selected = side === "buy" ? buySelected : sellSelected;
    const setter = side === "buy" ? setBuySelected : setSellSelected;
    const exists = selected.includes(id);
    if (!exists && selectedCount >= MAX_CONDITIONS) {
      setError(`Chỉ được chọn tối đa ${MAX_CONDITIONS} điều kiện mua và bán.`);
      return;
    }
    setError(null);
    setter(exists ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const runBacktest = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setCoachAi(null);
    try {
      const manifest = await fetchBacktestManifest();
      const provider = manifest.providers[0];
      if (!provider) throw new Error("Chưa có bộ kiểm định chiến thuật khả dụng.");

      const inputs: Record<string, ProviderInputValue> = {
        strategyName,
        scope,
        universe: selection,
        startDate: assumptions.startDate,
        endDate: assumptions.endDate,
        capital: assumptions.capital,
        fee: assumptions.fee,
        slippage: assumptions.slippage,
        minLiquidity: assumptions.minLiquidity,
        maxPositions: assumptions.maxPositions,
        weightPercent: assumptions.weightPercent,
        positionDrawdown: assumptions.positionDrawdown,
        strategyDrawdown: assumptions.strategyDrawdown,
        benchmark: assumptions.benchmark,
        buyConditions: buySelected,
        sellConditions: sellSelected,
        buyLogic,
        sellLogic,
        conditionParams: JSON.stringify(conditionParams),
      };

      const response = await runBacktestProvider({
        providerKey: provider.providerKey,
        inputs,
        context: {
          label: "ADN Lab v2 no-code strategy",
          buyLabels,
          sellLabels,
        },
        requestInsight: true,
      });
      setResult(response);
      // Tự lưu vào LỊCH SỬ (chưa ghim) — không chặn UI, lỗi log thì bỏ qua.
      const stamp = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      persistRun(response, false, `${strategyName} · ${stamp}`).catch(() => {});
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Bộ kiểm định chiến thuật chưa trả kết quả.";
      setError(`${message} Demo ADN hiện tại vẫn nằm bên dưới để xem lại kết quả đã lưu.`);
    } finally {
      setIsRunning(false);
    }
  };

  const loadSaved = async () => {
    try {
      const res = await fetch("/api/lab/strategies");
      if (res.ok) {
        const data = await res.json();
        setSaved(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      /* im lặng */
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const persistRun = async (resp: ProviderRunResponse, pinned: boolean, name: string) => {
    const config = { strategyName, scope, selection, buySelected, sellSelected, buyLogic, sellLogic, conditionParams, assumptions };
    const resultSummary = {
      metrics: getMetrics(resp),
      equityCurve: getEquityCurve(resp),
      coverage: isRecord(getResultRecord(resp)?.coverage) ? getResultRecord(resp)?.coverage : null,
    };
    const res = await fetch("/api/lab/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config, result: resultSummary, pinned }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => null);
      throw new Error(e?.error ?? "Lỗi lưu");
    }
    await loadSaved();
  };

  const saveStrategy = async () => {
    if (!result || saving) return;
    setSaving(true);
    setError(null);
    try {
      await persistRun(result, true, strategyName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu chiến thuật");
    } finally {
      setSaving(false);
    }
  };

  const loadStrategy = (item: SavedStrategy) => {
    const c = item.config as {
      strategyName?: string; scope?: ScopeType; selection?: string;
      buySelected?: string[]; sellSelected?: string[];
      buyLogic?: "and" | "or"; sellLogic?: "and" | "or";
      conditionParams?: Record<string, Record<string, string | number>>; assumptions?: LabAssumptions;
    };
    if (c.strategyName) setStrategyName(c.strategyName);
    if (c.scope) setScope(c.scope);
    if (typeof c.selection === "string") setSelection(c.selection);
    if (Array.isArray(c.buySelected)) setBuySelected(c.buySelected);
    if (Array.isArray(c.sellSelected)) setSellSelected(c.sellSelected);
    if (c.buyLogic === "and" || c.buyLogic === "or") setBuyLogic(c.buyLogic);
    if (c.sellLogic === "and" || c.sellLogic === "or") setSellLogic(c.sellLogic);
    if (c.conditionParams) setConditionParams(c.conditionParams);
    if (c.assumptions) setAssumptions({ ...defaultAssumptions, ...c.assumptions });
    setResult(null);
    setError(null);
  };

  const deleteStrategy = async (id: string) => {
    try {
      await fetch(`/api/lab/strategies/${id}`, { method: "DELETE" });
      await loadSaved();
    } catch {
      /* im lặng */
    }
  };

  const analyzeCoach = async () => {
    if (!metrics || coachLoading) return;
    setCoachLoading(true);
    try {
      const res = await fetch("/api/lab/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics,
          context: {
            strategyName, scope, universe: selection, benchmark: assumptions.benchmark,
            period: `${assumptions.startDate} → ${assumptions.endDate}`, buyLabels, sellLabels,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "ADN Coach chưa phản hồi");
      setCoachAi(typeof data.analysis === "string" ? data.analysis : null);
    } catch (e) {
      setCoachAi(e instanceof Error ? e.message : "Lỗi AI");
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div
        className="rounded-[2rem] border p-5 md:p-7"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl p-3" style={{ background: "var(--primary-light)" }}>
                <FlaskConical className="h-6 w-6" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--primary)" }}>
                  ADN Lab v2
                </p>
                <h1 className="text-2xl font-bold md:text-4xl" style={{ color: "var(--text-primary)" }}>
                  Strategy Validation Studio
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Phòng thí nghiệm kiểm định chiến thuật đầu tư bằng dữ liệu thị trường Việt Nam.
              ADN Lab giúp kiểm tra chiến thuật trước khi dùng tiền thật, không cam kết kết quả tương lai.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            {[
              ["Backtest", "Mô phỏng quá khứ"],
              ["AI Coach", "Giải thích kết quả"],
              ["Risk Review", "Đọc rủi ro trước"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ===================== CỘT TRÁI — MỌI CÔNG CỤ ===================== */}
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Phạm vi kiểm định</h2>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Tên chiến thuật
              </span>
              <input
                className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-bold outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                value={strategyName}
                onChange={(event) => setStrategyName(event.target.value)}
              />
            </label>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {scopeOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setScope(item.value);
                    const nextOptions =
                      item.value === "index"
                        ? indexOptions
                        : item.value === "watchlist"
                          ? watchlistOptions
                          : item.value === "sector"
                            ? sectorOptions
                            : [];
                    setSelection(item.value === "ticker" ? "FPT" : nextOptions[0] ?? "FPT");
                  }}
                  className="rounded-2xl border p-4 text-left transition"
                  style={{
                    background: scope === item.value ? "var(--primary-light)" : "var(--surface)",
                    borderColor: scope === item.value ? "var(--primary)" : "var(--border)",
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{item.helper}</p>
                </button>
              ))}
            </div>

            {scope === "ticker" ? (
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Mã cổ phiếu
                </span>
                <input
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-semibold outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  value={selection}
                  onChange={(event) => setSelection(event.target.value.toUpperCase())}
                />
              </label>
            ) : (
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Lựa chọn
                </span>
                <select
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-semibold outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  value={selection}
                  onChange={(event) => setSelection(event.target.value)}
                >
                  {scopeValues.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Điều kiện Mua — bấm + để mở modal, chỉ hiện cái đã thêm */}
          <div className="rounded-[1.5rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">M</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Điều kiện Mua</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{buySelected.length}</span>
              </span>
              <button type="button" onClick={() => setModalSide("buy")} className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ borderColor: "var(--border)", color: "var(--primary)" }} title="Thêm điều kiện mua">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {buySelected.length > 0 ? (
              <>
                <div className="mt-3 flex items-center gap-4 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Khớp:</span>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" name="buyLogic" checked={buyLogic === "and"} onChange={() => setBuyLogic("and")} /> Và</label>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" name="buyLogic" checked={buyLogic === "or"} onChange={() => setBuyLogic("or")} /> Hoặc</label>
                </div>
                <div className="mt-3 space-y-2">
                  {buyConditions.filter((c) => buySelected.includes(c.id)).map((item) => (
                    <ConditionChip key={item.id} item={item} params={conditionParams} onParam={setConditionParam} onRemove={() => toggleCondition(item.id, "buy")} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>Chưa có điều kiện. Bấm + để thêm.</p>
            )}
          </div>

          {/* Điều kiện Bán */}
          <div className="rounded-[1.5rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="rounded-lg bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">B</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Điều kiện Bán</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>{sellSelected.length}</span>
              </span>
              <button type="button" onClick={() => setModalSide("sell")} className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ borderColor: "var(--border)", color: "#dc2626" }} title="Thêm điều kiện bán">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {sellSelected.length > 0 ? (
              <>
                <div className="mt-3 flex items-center gap-4 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Khớp:</span>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" name="sellLogic" checked={sellLogic === "and"} onChange={() => setSellLogic("and")} /> Và</label>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" name="sellLogic" checked={sellLogic === "or"} onChange={() => setSellLogic("or")} /> Hoặc</label>
                </div>
                <div className="mt-3 space-y-2">
                  {sellConditions.filter((c) => sellSelected.includes(c.id)).map((item) => (
                    <ConditionChip key={item.id} item={item} params={conditionParams} onParam={setConditionParam} onRemove={() => toggleCondition(item.id, "sell")} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>Chưa có điều kiện. Bấm + để thêm.</p>
            )}
          </div>

          {/* NAV + giả định kiểm chứng */}
          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>NAV &amp; giả định kiểm chứng</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <NumberInput label="NAV (vốn giả lập)" value={assumptions.capital} suffix="đ" onChange={(value) => updateAssumption("capital", value)} />
              <NumberInput label="Phí giao dịch" value={assumptions.fee} suffix="%" onChange={(value) => updateAssumption("fee", value)} />
              <NumberInput label="Trượt giá" value={assumptions.slippage} suffix="%" onChange={(value) => updateAssumption("slippage", value)} />
              <NumberInput label="Thanh khoản tối thiểu" value={assumptions.minLiquidity} suffix="tỷ/ngày" onChange={(value) => updateAssumption("minLiquidity", value)} />
              <NumberInput label="Số mã tối đa" value={assumptions.maxPositions} onChange={(value) => updateAssumption("maxPositions", value)} />
              <NumberInput label="Tỷ trọng mỗi lệnh" value={assumptions.weightPercent} suffix="%" onChange={(value) => updateAssumption("weightPercent", value)} />
              <NumberInput label="Drawdown từng vị thế" value={assumptions.positionDrawdown} suffix="%" onChange={(value) => updateAssumption("positionDrawdown", value)} />
              <NumberInput label="Drawdown toàn chiến thuật" value={assumptions.strategyDrawdown} suffix="%" onChange={(value) => updateAssumption("strategyDrawdown", value)} />
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Từ ngày</span>
                <input
                  type="date"
                  value={assumptions.startDate}
                  onChange={(event) => updateAssumption("startDate", event.target.value)}
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-bold outline-none"
                  style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Đến ngày</span>
                <input
                  type="date"
                  value={assumptions.endDate}
                  onChange={(event) => updateAssumption("endDate", event.target.value)}
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-bold outline-none"
                  style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Benchmark</span>
                <select
                  value={assumptions.benchmark}
                  onChange={(event) => updateAssumption("benchmark", event.target.value)}
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-semibold outline-none"
                  style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                >
                  {benchmarkOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runBacktest}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              <Play className="h-4 w-4" />
              {isRunning ? "Đang kiểm định..." : "Chạy kiểm định"}
            </button>
            <button
              type="button"
              onClick={saveStrategy}
              disabled={!result || saving}
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
              title={result ? "Lưu chiến thuật + kết quả" : "Chạy kiểm định trước khi lưu"}
            >
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu chiến thuật"}
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(245,158,11,0.35)", color: "#f59e0b", background: "rgba(245,158,11,0.08)" }}>
              {error}
            </div>
          ) : null}

        </div>

        {/* ===================== CỘT PHẢI — KẾT QUẢ (DASHBOARD + TAB) ===================== */}
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
              <span>{selection}</span>
              <span>· Daily</span>
              <span>· {assumptions.startDate} đến {assumptions.endDate}</span>
              <span>· Phí {assumptions.fee}%</span>
              <span>· Trượt giá {assumptions.slippage}%</span>
              <span>· Tối đa {assumptions.maxPositions} mã</span>
              <span>· Benchmark {assumptions.benchmark}</span>
            </div>
          </div>

          {/* thanh tab */}
          <div className="flex flex-wrap gap-1 rounded-2xl border p-1" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {([
              ["dashboard", "Bảng kết quả"],
              ["equity", "Đường vốn"],
              ["coach", "ADN Coach"],
              ["history", `Lịch sử${saved.length ? ` (${saved.length})` : ""}`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setResultTab(id)}
                className="rounded-xl px-3.5 py-2 text-sm font-semibold transition"
                style={resultTab === id ? { background: "var(--primary)", color: "#fff" } : { color: "var(--text-muted)" }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* nội dung tab */}
          {resultTab === "dashboard" ? (
            result ? (
              <ResultDashboard metrics={metrics} analysis={analysis} trades={allTrades} warnings={runWarnings} />
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[1.5rem] border p-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="rounded-2xl p-4" style={{ background: "var(--primary-light)" }}>
                  <BarChart3 className="h-8 w-8" style={{ color: "var(--primary)" }} />
                </div>
                <p className="mt-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Lựa chọn điều kiện để chạy chiến thuật</p>
                <p className="mt-1 max-w-sm text-xs leading-5" style={{ color: "var(--text-muted)" }}>Thêm điều kiện Mua/Bán bên trái rồi bấm &quot;Chạy kiểm định&quot; để xem bảng kết quả chi tiết.</p>
              </div>
            )
          ) : resultTab === "equity" ? (
            <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Equity curve so với {assumptions.benchmark}</h2>
              </div>
              {equityCurve.length > 1 ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={equityCurve} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval="preserveStartEnd" minTickGap={44} tickFormatter={(d) => String(d).slice(5)} axisLine={false} tickLine={false} />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "var(--text-muted)" }} formatter={(v) => `${fmtEq(Number(v) || 0)}₫`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" name="Chiến thuật" stroke="var(--primary)" strokeWidth={2} fill="url(#eqFill)" />
                      <Line type="monotone" dataKey="benchmark" name={assumptions.benchmark} stroke="var(--text-muted)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-4 flex h-72 items-center justify-center rounded-xl border border-dashed" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  {result ? "Kết quả chưa đủ điểm để vẽ đường vốn." : "Chưa chạy kiểm định."}
                </div>
              )}
            </div>
          ) : resultTab === "coach" ? (
            <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>ADN Coach — Nhận định</h2>
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{buildCoachDiagnosis(metrics, result)}</p>
              {result ? (
                <button type="button" onClick={analyzeCoach} disabled={coachLoading} className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-60" style={{ background: "var(--primary)" }}>
                  <Bot className="h-3.5 w-3.5" />
                  {coachLoading ? "AIDEN đang đọc…" : "Phân tích sâu (AI)"}
                </button>
              ) : null}
              {coachAi ? (
                <p className="mt-3 whitespace-pre-line rounded-xl border p-3 text-xs leading-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>{coachAi}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              {saved.length > 0 ? (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Lịch sử & chiến thuật đã lưu ({saved.length})</p>
                  <div className="space-y-2">
                    {saved.slice().sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false)).map((item) => {
                      const m = isRecord(item.result) && isRecord(item.result.metrics) ? item.result.metrics : null;
                      const nr = m && typeof m.netReturn === "number" ? m.netReturn : null;
                      return (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                          <input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => setCompareIds((c) => (c.includes(item.id) ? c.filter((x) => x !== item.id) : [...c, item.id]))} className="h-4 w-4 shrink-0" title="Chọn để so sánh" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                              {item.pinned ? <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>ĐÃ LƯU</span> : null}
                              <span className="truncate">{item.name}</span>
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{new Date(item.createdAt).toLocaleString("vi-VN")}{nr !== null ? ` · ${nr >= 0 ? "+" : ""}${nr}%` : ""}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => loadStrategy(item)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>Nạp lại</button>
                            <button type="button" onClick={() => deleteStrategy(item.id)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "rgba(192,57,43,0.3)", color: "var(--danger)" }}>Xóa</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {compareIds.length >= 2 ? (
                    <div className="mt-4 overflow-x-auto border-t pt-4" style={{ borderColor: "var(--border)" }}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>So sánh {compareIds.length} chiến thuật</p>
                      {(() => {
                        const sel = saved.filter((s) => compareIds.includes(s.id));
                        const rows: { label: string; keys: string[]; fmt: (n: number | undefined) => string }[] = [
                          { label: "Net Return", keys: ["netReturn"], fmt: formatPercent },
                          { label: "CAGR", keys: ["cagr"], fmt: formatPercent },
                          { label: "Max DD", keys: ["maxDrawdown"], fmt: formatDrawdown },
                          { label: "Win Rate", keys: ["winRate"], fmt: formatPercent },
                          { label: "Profit Factor", keys: ["profitFactor"], fmt: formatNumber },
                          { label: "Số lệnh", keys: ["numberOfTrades"], fmt: formatNumber },
                        ];
                        return (
                          <table className="w-full min-w-[420px] text-xs">
                            <thead>
                              <tr style={{ color: "var(--text-muted)" }}>
                                <th className="py-2 text-left">KPI</th>
                                {sel.map((s) => <th key={s.id} className="py-2 pl-3 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.label} className="border-t" style={{ borderColor: "var(--border)" }}>
                                  <td className="py-2" style={{ color: "var(--text-muted)" }}>{r.label}</td>
                                  {sel.map((s) => {
                                    const m = isRecord(s.result) && isRecord(s.result.metrics) ? s.result.metrics : null;
                                    return <td key={s.id} className="py-2 pl-3 text-right font-bold" style={{ color: "var(--text-secondary)" }}>{r.fmt(pickNumber(m, r.keys))}</td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Chưa có chiến thuật nào được lưu. Chạy &amp; lưu để xem lại sau.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Strategy DNA + Cảnh báo rủi ro */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" style={{ color: "#f59e0b" }} />
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Strategy DNA</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Loại", "No-code strategy"],
              ["Phạm vi", selection],
              ["Timeframe", "Daily"],
              ["Điều kiện mua", shortList(buyLabels)],
              ["Điều kiện bán", shortList(sellLabels)],
              ["Quản trị vốn", `${formatMoney(assumptions.capital)}đ · ${assumptions.weightPercent}%/lệnh`],
              ["Benchmark", assumptions.benchmark],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border p-5" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.35)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "#f59e0b" }} />
            <h2 className="font-semibold" style={{ color: "#f59e0b" }}>Cảnh báo rủi ro</h2>
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Backtest chỉ cho biết chiến thuật từng hoạt động ra sao trong quá khứ. Kết quả tốt vẫn cần kiểm tra
            forward test, phí, trượt giá, thanh khoản và giai đoạn thị trường xấu.
          </p>
        </div>
      </div>

      {modalSide ? (
        <ConditionModal
          side={modalSide}
          options={modalSide === "buy" ? buyConditions : sellConditions}
          selected={modalSide === "buy" ? buySelected : sellSelected}
          onToggle={(id) => toggleCondition(id, modalSide)}
          onClose={() => setModalSide(null)}
        />
      ) : null}
    </section>
  );
}
