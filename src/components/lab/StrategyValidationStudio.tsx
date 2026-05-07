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
  Target,
} from "lucide-react";
import { fetchBacktestManifest, runBacktestProvider } from "@/lib/providers/client";
import type { ProviderInputValue, ProviderRunResponse } from "@/types/provider-manifest";

type ScopeType = "index" | "ticker" | "watchlist" | "sector";
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

function ConditionGrid({
  options,
  selected,
  onToggle,
}: {
  options: ConditionOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const grouped = groupConditions(options);
  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          <h4 className="mb-3 text-xs font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            {group}
          </h4>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="rounded-2xl border p-4 text-left transition"
                  style={{
                    background: checked ? "var(--primary-light)" : "var(--surface)",
                    borderColor: checked ? "var(--primary)" : "var(--border)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border"
                      style={{
                        borderColor: checked ? "var(--primary)" : "var(--border)",
                        background: checked ? "var(--primary)" : "transparent",
                      }}
                    >
                      {checked ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-black" style={{ color: "var(--text-primary)" }}>
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                        {item.description}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
      <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
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

export function StrategyValidationStudio() {
  const [strategyName, setStrategyName] = useState("Chiến thuật mới");
  const [scope, setScope] = useState<ScopeType>("ticker");
  const [selection, setSelection] = useState("FPT");
  const [buySelected, setBuySelected] = useState<string[]>(["ema_ma", "volume_spike", "rsi"]);
  const [sellSelected, setSellSelected] = useState<string[]>(["ema_ma_sell", "stop_loss"]);
  const [assumptions, setAssumptions] = useState<LabAssumptions>(defaultAssumptions);
  const [openPanel, setOpenPanel] = useState<"buy" | "sell">("buy");
  const [result, setResult] = useState<ProviderRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

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
  const trades = getTrades(result);

  const scopeValues = scope === "index" ? indexOptions : scope === "watchlist" ? watchlistOptions : scope === "sector" ? sectorOptions : [];

  const updateAssumption = <K extends keyof LabAssumptions>(key: K, value: LabAssumptions[K]) => {
    setAssumptions((current) => ({ ...current, [key]: value }));
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
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Bộ kiểm định chiến thuật chưa trả kết quả.";
      setError(`${message} Demo ADN hiện tại vẫn nằm bên dưới để xem lại kết quả đã lưu.`);
    } finally {
      setIsRunning(false);
    }
  };

  const metricCards = [
    {
      label: "Net Return",
      value: formatPercent(pickNumber(metrics, ["netReturn", "net_return", "totalReturn", "total_return", "return"])),
    },
    {
      label: "CAGR",
      value: formatPercent(pickNumber(metrics, ["cagr", "annualizedReturn", "annualized_return"])),
    },
    {
      label: "Max Drawdown",
      value: formatDrawdown(pickNumber(metrics, ["maxDrawdown", "max_drawdown", "drawdown"])),
    },
    {
      label: "Win Rate",
      value: formatPercent(pickNumber(metrics, ["winRate", "win_rate"])),
    },
    {
      label: "Profit Factor",
      value: formatNumber(pickNumber(metrics, ["profitFactor", "profit_factor"])),
    },
    {
      label: "Số lệnh",
      value: formatNumber(pickNumber(metrics, ["numberOfTrades", "totalTrades", "total_trades", "trades"])),
    },
  ];

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
                <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
                  ADN Lab v2
                </p>
                <h1 className="text-2xl font-black md:text-4xl" style={{ color: "var(--text-primary)" }}>
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
                <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{title}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-black" style={{ color: "var(--text-primary)" }}>Phạm vi kiểm định</h2>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                Tên chiến thuật
              </span>
              <input
                className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-bold outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                value={strategyName}
                onChange={(event) => setStrategyName(event.target.value)}
              />
            </label>

            <div className="mt-5 grid gap-3">
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
                  <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{item.helper}</p>
                </button>
              ))}
            </div>

            {scope === "ticker" ? (
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                  Mã cổ phiếu
                </span>
                <input
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-black uppercase outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  value={selection}
                  onChange={(event) => setSelection(event.target.value.toUpperCase())}
                />
              </label>
            ) : (
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                  Lựa chọn
                </span>
                <select
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-black outline-none"
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

          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-black" style={{ color: "var(--text-primary)" }}>Giả định kiểm định</h2>
            </div>
            <div className="mt-5 grid gap-4">
              <NumberInput label="Vốn giả lập" value={assumptions.capital} suffix="đ" onChange={(value) => updateAssumption("capital", value)} />
              <NumberInput label="Phí giao dịch" value={assumptions.fee} suffix="%" onChange={(value) => updateAssumption("fee", value)} />
              <NumberInput label="Trượt giá" value={assumptions.slippage} suffix="%" onChange={(value) => updateAssumption("slippage", value)} />
              <NumberInput label="Thanh khoản tối thiểu" value={assumptions.minLiquidity} suffix="tỷ/ngày" onChange={(value) => updateAssumption("minLiquidity", value)} />
              <NumberInput label="Số mã tối đa" value={assumptions.maxPositions} onChange={(value) => updateAssumption("maxPositions", value)} />
              <NumberInput label="Tỷ trọng mỗi lệnh" value={assumptions.weightPercent} suffix="%" onChange={(value) => updateAssumption("weightPercent", value)} />
              <NumberInput label="Drawdown từng vị thế" value={assumptions.positionDrawdown} suffix="%" onChange={(value) => updateAssumption("positionDrawdown", value)} />
              <NumberInput label="Drawdown toàn chiến thuật" value={assumptions.strategyDrawdown} suffix="%" onChange={(value) => updateAssumption("strategyDrawdown", value)} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Từ ngày</span>
                  <input
                    type="date"
                    value={assumptions.startDate}
                    onChange={(event) => updateAssumption("startDate", event.target.value)}
                    className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-bold outline-none"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Đến ngày</span>
                  <input
                    type="date"
                    value={assumptions.endDate}
                    onChange={(event) => updateAssumption("endDate", event.target.value)}
                    className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-bold outline-none"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Benchmark</span>
                <select
                  value={assumptions.benchmark}
                  onChange={(event) => updateAssumption("benchmark", event.target.value)}
                  className="w-full rounded-xl border bg-transparent px-3 py-3 text-sm font-black outline-none"
                  style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                >
                  {benchmarkOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
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

          <div className="rounded-[1.5rem] border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "buy" ? "sell" : "buy")}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-black text-white">M</span>
                <span className="font-black" style={{ color: "var(--text-primary)" }}>Điều kiện mua</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{buySelected.length} điều kiện</span>
              </span>
              <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            </button>
            {openPanel === "buy" ? (
              <div className="border-t p-5" style={{ borderColor: "var(--border)" }}>
                <p className="mb-5 text-sm font-bold" style={{ color: selectedCount >= MAX_CONDITIONS ? "#f59e0b" : "var(--text-muted)" }}>
                  Chỉ được chọn tối đa {MAX_CONDITIONS} điều kiện mua và bán. Đã chọn: {selectedCount}/{MAX_CONDITIONS}.
                </p>
                <ConditionGrid options={buyConditions} selected={buySelected} onToggle={(id) => toggleCondition(id, "buy")} />
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.5rem] border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "sell" ? "buy" : "sell")}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-red-500 px-2 py-1 text-xs font-black text-white">B</span>
                <span className="font-black" style={{ color: "var(--text-primary)" }}>Điều kiện bán</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{sellSelected.length} điều kiện</span>
              </span>
              <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            </button>
            {openPanel === "sell" ? (
              <div className="border-t p-5" style={{ borderColor: "var(--border)" }}>
                <p className="mb-5 text-sm font-bold" style={{ color: selectedCount >= MAX_CONDITIONS ? "#f59e0b" : "var(--text-muted)" }}>
                  Chỉ được chọn tối đa {MAX_CONDITIONS} điều kiện mua và bán. Đã chọn: {selectedCount}/{MAX_CONDITIONS}.
                </p>
                <ConditionGrid options={sellConditions} selected={sellSelected} onToggle={(id) => toggleCondition(id, "sell")} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runBacktest}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              <Play className="h-4 w-4" />
              {isRunning ? "Đang kiểm định..." : "Chạy kiểm định"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
            >
              <Save className="h-4 w-4" />
              Lưu phiên bản
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(245,158,11,0.35)", color: "#f59e0b", background: "rgba(245,158,11,0.08)" }}>
              {error}
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-black" style={{ color: "var(--text-primary)" }}>ADN Strategy Report</h2>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {metricCards.map((item) => (
                <div key={item.label} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                  <p className="mt-2 text-xl font-black" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Equity curve so với {assumptions.benchmark}</p>
              </div>
              <div className="mt-4 flex h-56 items-center justify-center rounded-xl border border-dashed" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                {result ? "Bộ kiểm định đã trả kết quả. Biểu đồ chi tiết sẽ hiển thị theo contract equity curve." : "Chưa chạy kiểm định."}
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-black" style={{ color: "var(--text-primary)" }}>Trade Explorer</h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead style={{ color: "var(--text-muted)" }}>
                  <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                    <th className="py-3">Ngày mua</th>
                    <th>Mã</th>
                    <th>Giá mua</th>
                    <th>Giá bán</th>
                    <th>Nắm giữ</th>
                    <th>P&L</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length ? (
                    trades.map((trade, index) => (
                      <tr key={`${safeText(trade.ticker, "TRADE")}-${index}`} className="border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        <td className="py-3">{safeText(trade.entryDate ?? trade.dateIn ?? trade.date)}</td>
                        <td className="font-black" style={{ color: "var(--text-primary)" }}>{safeText(trade.ticker)}</td>
                        <td>{safeText(trade.entry ?? trade.entryPrice)}</td>
                        <td>{safeText(trade.exit ?? trade.exitPrice)}</td>
                        <td>{safeText(trade.holdingDays ?? trade.holding)}</td>
                        <td>{safeText(trade.pnl ?? trade.return)}</td>
                        <td>{safeText(trade.reason ?? trade.exitReason, "Theo điều kiện chiến thuật")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-5 text-center" colSpan={7} style={{ color: "var(--text-muted)" }}>
                        Chưa có danh sách lệnh. Hãy chạy kiểm định hoặc xem demo ADN hiện tại bên dưới.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" style={{ color: "#f59e0b" }} />
              <h2 className="font-black" style={{ color: "var(--text-primary)" }}>Strategy DNA</h2>
            </div>
            <div className="mt-5 space-y-4 text-sm">
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
                  <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-black" style={{ color: "var(--text-primary)" }}>ADN Coach</h2>
            </div>
            <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              {buildCoachDiagnosis(metrics, result)}
            </p>
            <div className="mt-5 space-y-3">
              {["Thêm bộ lọc xu hướng thị trường", "Kiểm tra lại với trượt giá cao hơn", "Xem các lệnh thua lớn nhất"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="w-full rounded-xl border px-3 py-2 text-left text-xs font-bold"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-2)" }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border p-5" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.35)" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "#f59e0b" }} />
              <h2 className="font-black" style={{ color: "#f59e0b" }}>Cảnh báo rủi ro</h2>
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Backtest chỉ cho biết chiến thuật từng hoạt động ra sao trong quá khứ. Kết quả tốt vẫn cần kiểm tra
              forward test, phí, trượt giá, thanh khoản và giai đoạn thị trường xấu.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
