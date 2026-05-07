"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  LineChart,
  Play,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { fetchBacktestManifest, runBacktestProvider } from "@/lib/providers/client";
import type { BacktestProviderManifest, ProviderInputValue, ProviderRunResponse } from "@/types/provider-manifest";

type ScopeType = "index" | "ticker" | "watchlist" | "sector";
type ConditionSide = "buy" | "sell";
type UnknownRecord = Record<string, unknown>;

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

interface EquityPoint {
  label: string;
  strategy: number;
  benchmark?: number;
}

const MAX_CONDITIONS = 20;

const scopeOptions: Array<{ value: ScopeType; label: string; helper: string }> = [
  { value: "index", label: "Rổ chỉ số", helper: "VN30, VN100, HOSE, HNX, UPCOM" },
  { value: "ticker", label: "Cổ phiếu riêng", helper: "Kiểm định trên một mã cụ thể" },
  { value: "watchlist", label: "Danh mục", helper: "Watchlist hoặc danh mục nội bộ" },
  { value: "sector", label: "Nhóm ngành", helper: "Ngân hàng, chứng khoán, dầu khí..." },
];

const indexOptions = ["VN30", "VN100", "HOSE", "HNX", "UPCOM"];
const tickerOptions = ["FPT", "HPG", "SSI", "GVR", "TCB", "VND", "VRE", "BSR", "MBB", "STB"];
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
  { id: "volume_spike", label: "%KLGD đột biến", group: "Thông tin cổ phiếu", description: "Phát hiện dòng tiền tăng bất thường." },
  { id: "ema_ma", label: "EMA/MA", group: "Kỹ thuật", description: "Giá nằm trên hoặc vượt đường trung bình." },
  { id: "macd", label: "MACD", group: "Kỹ thuật", description: "Động lượng cải thiện hoặc xác nhận xu hướng." },
  { id: "rsi", label: "RSI", group: "Kỹ thuật", description: "Đánh giá sức mạnh ngắn hạn, tránh mua quá nóng." },
  { id: "bollinger", label: "Bollinger Band", group: "Kỹ thuật", description: "Kiểm tra nền giá, biên dao động và điểm bung nén." },
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
  { id: "bollinger_sell", label: "Bollinger Band", group: "Kỹ thuật", description: "Thoát khi giá phá biên rủi ro hoặc thất bại sau bung nén." },
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

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatNumber(value: unknown, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Chưa có";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function formatPercent(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Chưa có";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(1)}%`;
}

function formatDrawdown(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Chưa có";
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

function getTrades(result: ProviderRunResponse | null): UnknownRecord[] {
  const record = getResultRecord(result);
  if (!record) return [];
  const rawTrades = Array.isArray(record.trades)
    ? record.trades
    : isRecord(record.result) && Array.isArray(record.result.trades)
      ? record.result.trades
      : [];
  return rawTrades.filter(isRecord).slice(0, 30);
}

function getEquityCurve(result: ProviderRunResponse | null): EquityPoint[] {
  const record = getResultRecord(result);
  if (!record) return [];
  const candidates = [record.equityCurve, record.equity_curve, record.chart_data, record.curve, record.series];
  const raw = candidates.find(Array.isArray);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((point, index) => ({
      label: String(point.date ?? point.label ?? point.time ?? index + 1),
      strategy: Number(point.strategy ?? point.adn ?? point.equity ?? point.value ?? point.portfolio ?? 100),
      benchmark:
        point.benchmark != null || point.vnindex != null
          ? Number(point.benchmark ?? point.vnindex)
          : undefined,
    }))
    .filter((point) => Number.isFinite(point.strategy));
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
  if (result?.insight) return result.insight;
  if (result?.summary) return result.summary;
  if (!metrics) return "AIDEN chỉ phân tích sau khi có kết quả kiểm định. Không có kết quả thì không đưa nhận định.";

  const netReturn = pickNumber(metrics, ["netReturn", "net_return", "totalReturn", "total_return", "return"]);
  const maxDrawdown = pickNumber(metrics, ["maxDrawdown", "max_drawdown", "drawdown"]);
  const trades = pickNumber(metrics, ["numberOfTrades", "totalTrades", "total_trades", "trades"]);

  const notes: string[] = [];
  if (typeof netReturn === "number") {
    notes.push(netReturn > 0 ? "Chiến thuật có lợi nhuận dương trong giai đoạn kiểm định." : "Chiến thuật chưa tạo lợi nhuận dương trong giai đoạn kiểm định.");
  }
  if (typeof maxDrawdown === "number") {
    const dd = Math.abs(Math.abs(maxDrawdown) <= 1 ? maxDrawdown * 100 : maxDrawdown);
    notes.push(dd > 20 ? "Drawdown cao, cần giảm tỷ trọng hoặc siết điều kiện thoát lệnh." : "Drawdown đang ở vùng có thể kiểm soát, nhưng vẫn cần kiểm tra thêm theo từng giai đoạn.");
  }
  if (typeof trades === "number") {
    notes.push(trades < 20 ? "Số lượng lệnh còn ít, chưa đủ mẫu để kết luận chiến thuật ổn định." : "Số lượng lệnh đủ để đọc xu hướng ban đầu, nên tiếp tục kiểm tra độ bền.");
  }
  notes.push("Kết luận có điều kiện: cần đọc thêm danh sách lệnh, phí, trượt giá và forward test trước khi dùng tiền thật.");
  return notes.join(" ");
}

function ConditionPicker({
  title,
  side,
  options,
  selected,
  totalSelected,
  onToggle,
}: {
  title: string;
  side: ConditionSide;
  options: ConditionOption[];
  selected: string[];
  totalSelected: number;
  onToggle: (id: string) => void;
}) {
  const grouped = groupConditions(options);
  const accent = side === "buy" ? "#22c55e" : "#ef4444";

  return (
    <section className="rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white"
            style={{ background: accent }}
          >
            {side === "buy" ? "M" : "B"}
          </span>
          <div>
            <h2 className="font-black" style={{ color: "var(--text-primary)" }}>
              {title}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Đã chọn {selected.length} điều kiện. Tổng Mua/Bán tối đa {MAX_CONDITIONS}.
            </p>
          </div>
        </div>
        <ChevronDown className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
      </div>

      <div className="space-y-5 p-4">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              {group}
            </h3>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {items.map((option) => {
                const checked = selected.includes(option.id);
                const disabled = !checked && totalSelected >= MAX_CONDITIONS;
                return (
                  <label
                    key={option.id}
                    className="flex min-h-[76px] cursor-pointer gap-3 rounded-xl border p-3 transition disabled:opacity-60"
                    style={{
                      background: checked ? "rgba(34,197,94,0.08)" : "var(--surface-2)",
                      borderColor: checked ? "rgba(34,197,94,0.35)" : "var(--border)",
                      opacity: disabled ? 0.55 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onToggle(option.id)}
                      className="mt-1 h-4 w-4 accent-emerald-600"
                    />
                    <span>
                      <span className="block text-sm font-black" style={{ color: "var(--text-primary)" }}>
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "neutral" | "warn" }) {
  const toneColor =
    tone === "good" ? "#22c55e" : tone === "bad" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "var(--text-primary)";
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-black" style={{ color: toneColor }}>
        {value}
      </div>
    </div>
  );
}

function EquityCurvePreview({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border p-5 text-center" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <div>
          <LineChart className="mx-auto h-8 w-8" style={{ color: "var(--text-muted)" }} />
          <p className="mt-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Equity curve sẽ hiển thị sau khi chạy kiểm định.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Đường chiến thuật sẽ được so sánh với VNINDEX khi engine trả dữ liệu.
          </p>
        </div>
      </div>
    );
  }

  const width = 720;
  const height = 260;
  const allValues = points.flatMap((point) => [point.strategy, point.benchmark].filter((value): value is number => typeof value === "number" && Number.isFinite(value)));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const toX = (index: number) => (index / Math.max(points.length - 1, 1)) * width;
  const toY = (value: number) => height - ((value - min) / range) * height;
  const strategyPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.strategy)}`).join(" ");
  const benchmarkPoints = points.filter((point) => typeof point.benchmark === "number");
  const benchmarkPath = benchmarkPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(points.indexOf(point))} ${toY(point.benchmark as number)}`)
    .join(" ");

  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
          Equity curve so với VNINDEX
        </h3>
        <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Chiến thuật</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> VNINDEX</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full overflow-visible">
        <path d={strategyPath} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
        {benchmarkPath ? <path d={benchmarkPath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" /> : null}
      </svg>
    </div>
  );
}

function TradeExplorer({ trades }: { trades: UnknownRecord[] }) {
  return (
    <div className="rounded-2xl border" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
          Trade Explorer
        </h3>
      </div>
      {trades.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead style={{ color: "var(--text-muted)" }}>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Ngày mua</th>
                <th className="px-4 py-3">Giá mua</th>
                <th className="px-4 py-3">Ngày bán</th>
                <th className="px-4 py-3">Giá bán</th>
                <th className="px-4 py-3">P&L</th>
                <th className="px-4 py-3">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr key={index} className="border-b last:border-b-0" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <td className="px-4 py-3 font-bold">{String(trade.ticker ?? trade.symbol ?? "-")}</td>
                  <td className="px-4 py-3">{String(trade.entryDate ?? trade.entry_date ?? trade.dateIn ?? "-")}</td>
                  <td className="px-4 py-3">{String(trade.entryPrice ?? trade.entry_price ?? "-")}</td>
                  <td className="px-4 py-3">{String(trade.exitDate ?? trade.exit_date ?? trade.dateOut ?? "-")}</td>
                  <td className="px-4 py-3">{String(trade.exitPrice ?? trade.exit_price ?? "-")}</td>
                  <td className="px-4 py-3">{typeof trade.pnl === "number" ? formatPercent(trade.pnl) : String(trade.pnl ?? "-")}</td>
                  <td className="px-4 py-3">{String(trade.reason ?? trade.exitReason ?? "Theo luật chiến thuật")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5 text-sm" style={{ color: "var(--text-muted)" }}>
          Danh sách lệnh sẽ hiển thị khi bộ kiểm định trả chi tiết từng giao dịch.
        </div>
      )}
    </div>
  );
}

export function StrategyValidationStudio() {
  const [strategyName, setStrategyName] = useState("VN Momentum Breakout");
  const [scopeType, setScopeType] = useState<ScopeType>("index");
  const [universe, setUniverse] = useState("VN30");
  const [ticker, setTicker] = useState("FPT");
  const [watchlist, setWatchlist] = useState(watchlistOptions[0]);
  const [sector, setSector] = useState(sectorOptions[0]);
  const [buySelected, setBuySelected] = useState(["ema_ma", "volume_spike", "rsi"]);
  const [sellSelected, setSellSelected] = useState(["ema_ma_sell", "stop_loss", "take_profit"]);
  const [assumptions, setAssumptions] = useState<LabAssumptions>(defaultAssumptions);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<ProviderRunResponse | null>(null);

  const totalSelected = buySelected.length + sellSelected.length;
  const selectedBuyLabels = buyConditions.filter((item) => buySelected.includes(item.id)).map((item) => item.label);
  const selectedSellLabels = sellConditions.filter((item) => sellSelected.includes(item.id)).map((item) => item.label);
  const scopeLabel = useMemo(() => {
    if (scopeType === "index") return universe;
    if (scopeType === "ticker") return ticker;
    if (scopeType === "watchlist") return watchlist;
    return sector;
  }, [scopeType, universe, ticker, watchlist, sector]);

  const metrics = getMetrics(runResult);
  const trades = getTrades(runResult);
  const curve = getEquityCurve(runResult);
  const coachDiagnosis = buildCoachDiagnosis(metrics, runResult);

  const metricCards = [
    { label: "Net Return", value: formatPercent(pickNumber(metrics, ["netReturn", "net_return", "totalReturn", "total_return", "return"])), tone: "good" as const },
    { label: "CAGR", value: formatPercent(pickNumber(metrics, ["cagr", "annualizedReturn", "annualized_return"])), tone: "good" as const },
    { label: "Max Drawdown", value: formatDrawdown(pickNumber(metrics, ["maxDrawdown", "max_drawdown", "drawdown"])), tone: "bad" as const },
    { label: "Win Rate", value: formatPercent(pickNumber(metrics, ["winRate", "win_rate"])), tone: "neutral" as const },
    { label: "Profit Factor", value: formatNumber(pickNumber(metrics, ["profitFactor", "profit_factor"])), tone: "neutral" as const },
    {
      label: "Avg Win / Avg Loss",
      value: `${formatPercent(pickNumber(metrics, ["avgWin", "avg_win"]))} / ${formatPercent(pickNumber(metrics, ["avgLoss", "avg_loss"]))}`,
      tone: "neutral" as const,
    },
    { label: "Sharpe / Sortino", value: `${formatNumber(pickNumber(metrics, ["sharpe"]))} / ${formatNumber(pickNumber(metrics, ["sortino"]))}`, tone: "neutral" as const },
    { label: "Number of Trades", value: formatNumber(pickNumber(metrics, ["numberOfTrades", "totalTrades", "total_trades", "trades"])), tone: "neutral" as const },
    { label: "Avg Holding Period", value: formatNumber(pickNumber(metrics, ["avgHoldingPeriod", "avg_holding_period"]), " ngày"), tone: "neutral" as const },
    { label: "Exposure", value: formatPercent(pickNumber(metrics, ["exposure"])), tone: "neutral" as const },
    { label: "Turnover", value: formatPercent(pickNumber(metrics, ["turnover"])), tone: "neutral" as const },
    { label: "Fee / Slippage Impact", value: `${formatPercent(pickNumber(metrics, ["feeImpact", "fee_impact"]))} / ${formatPercent(pickNumber(metrics, ["slippageImpact", "slippage_impact"]))}`, tone: "warn" as const },
  ];

  function updateAssumption<K extends keyof LabAssumptions>(key: K, value: string) {
    setAssumptions((current) => ({
      ...current,
      [key]: key === "benchmark" || key === "startDate" || key === "endDate" ? value : Number(value),
    }));
  }

  function toggleCondition(side: ConditionSide, id: string) {
    const setter = side === "buy" ? setBuySelected : setSellSelected;
    setter((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (totalSelected >= MAX_CONDITIONS) return current;
      return [...current, id];
    });
  }

  function saveDraft() {
    const draft = {
      strategyName,
      scopeType,
      universe,
      ticker,
      watchlist,
      sector,
      buySelected,
      sellSelected,
      assumptions,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem("adn_lab_strategy_v2_draft", JSON.stringify(draft));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  async function selectProvider() {
    const manifest = await fetchBacktestManifest();
    const provider = manifest.providers.find((item: BacktestProviderManifest) => item.providerType === "backtest") ?? manifest.providers[0];
    if (!provider) throw new Error("NO_PROVIDER");
    return provider;
  }

  async function runBacktest() {
    setRunning(true);
    setRunError(null);
    try {
      const provider = await selectProvider();
      const inputs: Record<string, ProviderInputValue> = {
        ticker: scopeType === "ticker" ? ticker : ticker,
        dateRange: { start: assumptions.startDate, end: assumptions.endDate },
        lookback: buySelected.includes("ema_ma") ? 20 : 30,
        minVolumeRatio: buySelected.includes("volume_spike") ? 1.5 : 1,
        universe: scopeType === "index" ? universe : scopeType === "sector" ? sector : scopeType === "watchlist" ? watchlist : "CUSTOM",
        includeDelisted: false,
        note: JSON.stringify({
          name: strategyName,
          scope: scopeLabel,
          buy: selectedBuyLabels,
          sell: selectedSellLabels,
          assumptions,
        }),
      };

      const response = await runBacktestProvider({
        providerKey: provider.providerKey,
        inputs,
        context: {
          labVersion: "adn-lab-v2",
          strategy: {
            name: strategyName,
            scopeType,
            scopeLabel,
            buyConditions: buySelected,
            sellConditions: sellSelected,
            assumptions,
          },
        },
        requestInsight: true,
      });
      setRunResult(response);
    } catch {
      setRunError("Chưa thể chạy kiểm định lúc này. Vui lòng thử lại sau hoặc giảm bớt điều kiện.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 p-4 md:p-6">
      <section className="rounded-[2rem] border p-5 md:p-7" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em]" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
              <FlaskConical className="h-4 w-4" /> ADN Lab v2
            </div>
            <h1 className="text-3xl font-black leading-tight md:text-5xl" style={{ color: "var(--text-primary)" }}>
              Phòng thí nghiệm kiểm định chiến thuật đầu tư.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              Chọn điều kiện mua/bán bằng no-code builder, chạy mô phỏng trên dữ liệu lịch sử, đọc rủi ro và cải thiện chiến thuật trước khi dùng tiền thật.
            </p>
          </div>
          <div className="rounded-2xl border p-4 text-sm leading-6" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)", color: "var(--text-primary)" }}>
            <div className="flex items-center gap-2 font-black" style={{ color: "#f59e0b" }}>
              <ShieldAlert className="h-4 w-4" /> Nguyên tắc sản phẩm
            </div>
            <p className="mt-2">Quá khứ không bảo đảm kết quả tương lai. ADN Lab giúp loại bỏ chiến thuật tệ, không phải công cụ phím hàng.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border p-3 text-sm font-bold" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        {scopeLabel} · Daily · {assumptions.startDate} đến {assumptions.endDate} · Fee {assumptions.fee}% · Slippage {assumptions.slippage}% · Max {assumptions.maxPositions} mã · Benchmark {assumptions.benchmark}
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">
          <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Tên chiến thuật</span>
              <input
                value={strategyName}
                onChange={(event) => setStrategyName(event.target.value)}
                className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3 text-lg font-black outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>

            <div className="mt-4 grid gap-2">
              {scopeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScopeType(option.value)}
                  className="rounded-xl border p-3 text-left transition"
                  style={{
                    background: scopeType === option.value ? "rgba(34,197,94,0.12)" : "var(--surface-2)",
                    borderColor: scopeType === option.value ? "rgba(34,197,94,0.35)" : "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>{option.helper}</span>
                </button>
              ))}
            </div>

            <select
              value={scopeType === "index" ? universe : scopeType === "watchlist" ? watchlist : scopeType === "sector" ? sector : ticker}
              onChange={(event) => {
                if (scopeType === "index") setUniverse(event.target.value);
                if (scopeType === "watchlist") setWatchlist(event.target.value);
                if (scopeType === "sector") setSector(event.target.value);
                if (scopeType === "ticker") setTicker(event.target.value);
              }}
              className="mt-4 w-full rounded-xl border px-3 py-3 text-sm font-bold outline-none"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              {(scopeType === "index" ? indexOptions : scopeType === "watchlist" ? watchlistOptions : scopeType === "sector" ? sectorOptions : tickerOptions).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--text-primary)" }}>
              <SlidersHorizontal className="h-4 w-4" /> Giả định kiểm định
            </h2>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Từ ngày</span>
                  <input type="date" value={assumptions.startDate} onChange={(event) => updateAssumption("startDate", event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
                <label>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Đến ngày</span>
                  <input type="date" value={assumptions.endDate} onChange={(event) => updateAssumption("endDate", event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </label>
              </div>

              {[
                ["capital", "Vốn giả lập", "VNĐ"],
                ["fee", "Phí giao dịch", "%"],
                ["slippage", "Trượt giá", "%"],
                ["minLiquidity", "Thanh khoản tối thiểu", "tỷ/ngày"],
                ["maxPositions", "Số mã tối đa", "mã"],
                ["weightPercent", "Tỷ trọng mỗi lệnh", "%"],
                ["positionDrawdown", "Drawdown mỗi vị thế", "%"],
                ["strategyDrawdown", "Drawdown toàn chiến thuật", "%"],
              ].map(([key, label, suffix]) => (
                <label key={key} className="block">
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <div className="mt-1 flex rounded-xl border" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                    <input
                      type="number"
                      value={assumptions[key as keyof LabAssumptions] as number}
                      onChange={(event) => updateAssumption(key as keyof LabAssumptions, event.target.value)}
                      className="w-full bg-transparent px-3 py-2 text-sm font-bold outline-none"
                      style={{ color: "var(--text-primary)" }}
                    />
                    <span className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{suffix}</span>
                  </div>
                </label>
              ))}

              <label>
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Mốc so sánh</span>
                <select
                  value={assumptions.benchmark}
                  onChange={(event) => updateAssumption("benchmark", event.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {benchmarkOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <ConditionPicker
            title="Điều kiện Mua"
            side="buy"
            options={buyConditions}
            selected={buySelected}
            totalSelected={totalSelected}
            onToggle={(id) => toggleCondition("buy", id)}
          />
          <ConditionPicker
            title="Điều kiện Bán"
            side="sell"
            options={sellConditions}
            selected={sellSelected}
            totalSelected={totalSelected}
            onToggle={(id) => toggleCondition("sell", id)}
          />
          <EquityCurvePreview points={curve} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--text-primary)" }}>
              <Target className="h-4 w-4" /> Strategy DNA
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <p style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Tên:</strong> {strategyName}</p>
              <p style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Phạm vi:</strong> {scopeLabel}</p>
              <p style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Mua khi:</strong> {shortList(selectedBuyLabels)}</p>
              <p style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>Bán khi:</strong> {shortList(selectedSellLabels)}</p>
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--text-primary)" }}>
              <Bot className="h-4 w-4" /> ADN Coach
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              <p>{coachDiagnosis}</p>
              {!runResult ? (
                <p>Nên bắt đầu bằng ít điều kiện, sau đó đọc drawdown, phí và trượt giá trước khi thêm bộ lọc mới.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black" style={{ color: "#f59e0b" }}>
              <ShieldAlert className="h-4 w-4" /> Risk Warning
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-primary)" }}>
              Không triển khai tiền thật chỉ vì backtest đẹp. Chiến thuật cần kiểm tra thêm qua nhiều giai đoạn và forward test 30-60 tín hiệu.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={runBacktest}
              disabled={running || buySelected.length === 0 || sellSelected.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              <Play className="h-4 w-4" /> {running ? "Đang kiểm định..." : "Chạy kiểm định"}
            </button>
            <button
              onClick={saveDraft}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Save className="h-4 w-4" /> {saved ? "Đã lưu bản nháp" : "Lưu phiên bản"}
            </button>
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black" style={{ color: "var(--text-primary)" }}>
              <BarChart3 className="h-5 w-5" /> ADN Strategy Report
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Report chỉ hiển thị kết quả sau khi bộ kiểm định deterministic chạy xong.
            </p>
          </div>
          <span
            className="rounded-full border px-3 py-1 text-xs font-black"
            style={{
              background: runResult ? "rgba(34,197,94,0.10)" : "var(--surface-2)",
              borderColor: runResult ? "rgba(34,197,94,0.35)" : "var(--border)",
              color: runResult ? "#22c55e" : "var(--text-muted)",
            }}
          >
            {runResult ? "Đã có kết quả" : "Chưa chạy"}
          </span>
        </div>

        {runError ? (
          <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "var(--text-primary)" }}>
            <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 text-red-500" /> {runError}</div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => <MetricCard key={card.label} {...card} />)}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <TradeExplorer trades={trades} />
          <div className="rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <h3 className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--text-primary)" }}>
              <Sparkles className="h-4 w-4" /> Kết luận có điều kiện
            </h3>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              {runResult
                ? "Chiến thuật cần được đọc cùng Max Drawdown, số lượng lệnh, phí, trượt giá và độ ổn định. Không dùng kết quả này như khuyến nghị đầu tư."
                : "Sau khi chạy kiểm định, ADN Lab sẽ tóm tắt chiến thuật có vượt mốc so sánh không, rủi ro nằm ở đâu và bước kiểm tra tiếp theo là gì."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: TrendingUp, title: "Robustness Lab", body: "Phase 2: kiểm tra out-of-sample, độ nhạy tham số, bối cảnh thị trường và phí/trượt giá." },
          { icon: TrendingDown, title: "Strategy Compare", body: "So sánh nhiều phiên bản chiến thuật để tránh chọn bản chỉ đẹp ở quá khứ." },
          { icon: CheckCircle2, title: "Forward Test", body: "Đưa chiến thuật vào paper validation trước khi tạo cảnh báo hoặc watchlist." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <Icon className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <h3 className="mt-3 font-black" style={{ color: "var(--text-primary)" }}>{item.title}</h3>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{item.body}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
