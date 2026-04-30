"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import type {
  DnseExecutionResult,
  OrderExecutionPreview,
  OrderTicket,
  OrderType,
} from "@/types/dnse-execution";

type LoanPackageOption = {
  loanPackageId: string;
  loanPackageName: string;
  interestRate: number | null;
  maxLoanRatio: number | null;
  isCash: boolean;
};

type OrderSizing = {
  ticker: string;
  side: "BUY" | "SELL";
  accountNo: string;
  orderType: OrderType;
  selectedLoanPackageId: string;
  loanPackages: LoanPackageOption[];
  price: number | null;
  displayPrice: number | null;
  totalAsset: number | null;
  buyingPower: number | null;
  sellingPower: number | null;
  buyMaxQuantity: number;
  sellMaxQuantity: number;
  recommendedQuantity: number;
  recommendedValue: number;
  recommendedNavPct: number;
  target: number | null;
  stoploss: number | null;
  warnings: string[];
};

type SizingResponse = {
  success?: boolean;
  sizing?: OrderSizing;
  error?: string;
};

type PreviewResponse = {
  ticket?: OrderTicket;
  confirmationPhrase?: string;
  previewOnly?: boolean;
  error?: string;
};

type SubmitResponse = {
  result?: DnseExecutionResult;
  error?: string;
};

type DirectOrderPanelProps = {
  ticker: string;
  defaultSide?: "BUY" | "SELL";
  defaultPrice?: number | null;
  defaultAccountId?: string | null;
  source?: string | null;
  signalId?: string | null;
  navPct?: number | null;
  canTrade: boolean;
};

type AutoConfigState = {
  buyEnabled: boolean;
  sellEnabled: boolean;
  useLoanPackage: boolean;
  loanPackageId: string;
  maxNavPctPerOrder: number | string;
  maxOrderValue: string;
  maxDailyValue: string;
  maxDailyOrders: number | string;
  allowedTickers: string;
  blockedTickers: string;
  maxLossPct: string;
  paused: boolean;
};

const ORDER_TYPES: OrderType[] = ["LO", "MTL", "ATO", "ATC"];
const LOT_SIZE = 100;

function fmtMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

function fmtNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString("vi-VN");
}

function toDisplayPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "";
  return String(value >= 1000 ? Number((value / 1000).toFixed(2)) : value);
}

function normalizeOrderPrice(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed < 1000 ? parsed * 1000 : parsed);
}

function floorToLot(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / LOT_SIZE) * LOT_SIZE;
}

function sideLabel(side: "BUY" | "SELL") {
  return side === "BUY" ? "MUA" : "BÁN";
}

function sourceLabel(source?: string | null) {
  if (source === "radar") return "ADN Radar";
  if (source === "aiden") return "AIDEN";
  return "ADN Link";
}

function friendlyResult(result: DnseExecutionResult | null) {
  if (!result) return null;
  if (result.status === "accepted") return "Lệnh đã được gửi thành công.";
  if (result.status === "approval_required") return "Lệnh đang bị chặn vì chưa đủ điều kiện phê duyệt.";
  if (result.status === "blocked_not_enabled") return "Lệnh chưa được gửi vì chế độ an toàn đang bật.";
  if (result.status === "rejected") return "Lệnh bị từ chối. Vui lòng kiểm tra lại điều kiện giao dịch.";
  return "Chưa thể gửi lệnh ở thời điểm hiện tại.";
}

function DirectStatus({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const palette = {
    neutral: { border: "var(--border)", bg: "var(--surface-2)", color: "var(--text-secondary)" },
    good: { border: "rgba(22,163,74,0.25)", bg: "rgba(22,163,74,0.10)", color: "#15803d" },
    warn: { border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.10)", color: "#92400e" },
    bad: { border: "rgba(192,57,43,0.25)", bg: "rgba(192,57,43,0.10)", color: "var(--danger)" },
  }[tone];
  return (
    <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: palette.border, background: palette.bg, color: palette.color }}>
      {children}
    </div>
  );
}

function AutoRadarConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [authorization, setAuthorization] = useState<{ active: boolean; expiresAt: string | null }>({
    active: false,
    expiresAt: null,
  });
  const [config, setConfig] = useState<AutoConfigState>({
    buyEnabled: false,
    sellEnabled: false,
    useLoanPackage: false,
    loanPackageId: "",
    maxNavPctPerOrder: 5,
    maxOrderValue: "",
    maxDailyValue: "",
    maxDailyOrders: 3,
    allowedTickers: "",
    blockedTickers: "",
    maxLossPct: "",
    paused: false,
  });

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/auto-config", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tải được cấu hình.");
      setConfig({
        buyEnabled: Boolean(data.config?.buyEnabled),
        sellEnabled: Boolean(data.config?.sellEnabled),
        useLoanPackage: Boolean(data.config?.useLoanPackage),
        loanPackageId: data.config?.loanPackageId ?? "",
        maxNavPctPerOrder: Number(data.config?.maxNavPctPerOrder ?? 5),
        maxOrderValue: data.config?.maxOrderValue ? String(data.config.maxOrderValue) : "",
        maxDailyValue: data.config?.maxDailyValue ? String(data.config.maxDailyValue) : "",
        maxDailyOrders: Number(data.config?.maxDailyOrders ?? 3),
        allowedTickers: Array.isArray(data.config?.allowedTickers) ? data.config.allowedTickers.join(", ") : "",
        blockedTickers: Array.isArray(data.config?.blockedTickers) ? data.config.blockedTickers.join(", ") : "",
        maxLossPct: data.config?.maxLossPct ? String(data.config.maxLossPct) : "",
        paused: Boolean(data.config?.paused),
      });
      setAuthorization({
        active: Boolean(data.authorization?.active),
        expiresAt: data.authorization?.expiresAt ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được cấu hình.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/auto-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          maxOrderValue: config.maxOrderValue ? Number(config.maxOrderValue) : null,
          maxDailyValue: config.maxDailyValue ? Number(config.maxDailyValue) : null,
          maxLossPct: config.maxLossPct ? Number(config.maxLossPct) : null,
          allowedTickers: config.allowedTickers.split(/[,\s]+/).filter(Boolean),
          blockedTickers: config.blockedTickers.split(/[,\s]+/).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được cấu hình.");
      setMessage("Đã lưu cấu hình đặt lệnh tự động theo ADN Radar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  const requestVerificationCode = async () => {
    setRequestingCode(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/auto-authorization/request-otp", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không gửi được mã xác thực.");
      setMessage(data.message ?? "Đã gửi mã xác thực.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được mã xác thực.");
    } finally {
      setRequestingCode(false);
    }
  };

  const confirmAuthorization = async () => {
    if (!verificationCode.trim()) {
      setError("Vui lòng nhập mã xác thực.");
      return;
    }
    setConfirming(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/auto-authorization/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: verificationCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không xác nhận được quyền giao dịch.");
      setAuthorization({
        active: true,
        expiresAt: data.authorization?.expiresAt ?? null,
      });
      setVerificationCode("");
      setMessage("Đã xác nhận quyền giao dịch cho đặt lệnh tự động.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được quyền giao dịch.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            Đặt lệnh tự động theo ADN Radar
          </h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Khách hàng đặt giới hạn trước, xác nhận quyền giao dịch và hệ thống chỉ hành động khi tín hiệu ADN Radar cùng các giới hạn an toàn đều hợp lệ.
          </p>
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[11px] font-bold"
          style={{
            borderColor: authorization.active ? "rgba(22,163,74,0.25)" : "var(--border)",
            background: authorization.active ? "rgba(22,163,74,0.10)" : "var(--surface-2)",
            color: authorization.active ? "#15803d" : "var(--text-muted)",
          }}
        >
          {authorization.active ? "Đã xác thực" : "Chưa xác thực"}
        </span>
      </div>

      {loading ? (
        <DirectStatus>Đang tải cấu hình...</DirectStatus>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--text-primary)" }}>Mua theo tín hiệu</span>
            <input type="checkbox" checked={config.buyEnabled} onChange={(event) => setConfig((prev) => ({ ...prev, buyEnabled: event.target.checked }))} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--text-primary)" }}>Bán theo tín hiệu</span>
            <input type="checkbox" checked={config.sellEnabled} onChange={(event) => setConfig((prev) => ({ ...prev, sellEnabled: event.target.checked }))} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--text-primary)" }}>Cho phép dùng gói vay giao dịch</span>
            <input type="checkbox" checked={config.useLoanPackage} onChange={(event) => setConfig((prev) => ({ ...prev, useLoanPackage: event.target.checked }))} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--text-primary)" }}>Tạm dừng tự động</span>
            <input type="checkbox" checked={config.paused} onChange={(event) => setConfig((prev) => ({ ...prev, paused: event.target.checked }))} />
          </label>
          {[
            ["Tỷ trọng tối đa mỗi lệnh (%)", "maxNavPctPerOrder"],
            ["Giá trị tối đa mỗi lệnh", "maxOrderValue"],
            ["Giá trị tối đa mỗi ngày", "maxDailyValue"],
            ["Số lệnh tối đa mỗi ngày", "maxDailyOrders"],
            ["Tự dừng khi lỗ vượt (%)", "maxLossPct"],
            ["Gói giao dịch ưu tiên", "loanPackageId"],
          ].map(([label, key]) => (
            <label key={key} className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              {label}
              <input
                value={String(config[key as keyof typeof config] ?? "")}
                onChange={(event) => setConfig((prev) => ({ ...prev, [key]: event.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
            </label>
          ))}
          <label className="text-xs font-semibold lg:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Danh sách mã được phép
            <input
              value={config.allowedTickers}
              onChange={(event) => setConfig((prev) => ({ ...prev, allowedTickers: event.target.value.toUpperCase() }))}
              placeholder="Ví dụ: HPG, FPT, SSI"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            />
          </label>
          <label className="text-xs font-semibold lg:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Danh sách mã không giao dịch
            <input
              value={config.blockedTickers}
              onChange={(event) => setConfig((prev) => ({ ...prev, blockedTickers: event.target.value.toUpperCase() }))}
              placeholder="Ví dụ: ABC, XYZ"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={saving || loading}
          className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
        <button
          type="button"
          onClick={() => void requestVerificationCode()}
          disabled={requestingCode}
          className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-2)" }}
        >
          {requestingCode ? "Đang gửi..." : "Gửi mã xác thực"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value)}
          placeholder="Nhập mã xác thực"
          className="rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={() => void confirmAuthorization()}
          disabled={confirming}
          className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
          style={{ borderColor: "rgba(22,163,74,0.25)", color: "#15803d", background: "rgba(22,163,74,0.10)" }}
        >
          {confirming ? "Đang xác nhận..." : "Xác nhận ủy quyền"}
        </button>
      </div>

      {authorization.active && authorization.expiresAt ? (
        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Quyền giao dịch đã xác thực đến {new Date(authorization.expiresAt).toLocaleString("vi-VN")}.
        </p>
      ) : null}
      {message ? <div className="mt-3"><DirectStatus tone="good">{message}</DirectStatus></div> : null}
      {error ? <div className="mt-3"><DirectStatus tone="bad">{error}</DirectStatus></div> : null}
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Hệ thống tự dừng khi vượt giới hạn, ngoài phiên giao dịch, quyền xác thực hết hạn hoặc chế độ an toàn được bật.
      </p>
    </section>
  );
}

export function DirectOrderPanel({
  ticker,
  defaultSide = "BUY",
  defaultPrice = null,
  defaultAccountId = null,
  source = null,
  signalId = null,
  navPct = null,
  canTrade,
}: DirectOrderPanelProps) {
  const [side, setSide] = useState<"BUY" | "SELL">(defaultSide);
  const [orderType, setOrderType] = useState<OrderType>("LO");
  const [priceInput, setPriceInput] = useState(toDisplayPrice(defaultPrice));
  const [quantity, setQuantity] = useState(0);
  const [loanPackageId, setLoanPackageId] = useState("CASH");
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [sizing, setSizing] = useState<OrderSizing | null>(null);
  const [loadingSizing, setLoadingSizing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<OrderExecutionPreview | null>(null);
  const [result, setResult] = useState<DnseExecutionResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSide(defaultSide);
  }, [defaultSide]);

  useEffect(() => {
    setPriceInput(toDisplayPrice(defaultPrice));
    setQuantityTouched(false);
    setPreview(null);
    setResult(null);
    setMessage(null);
    setError(null);
  }, [defaultPrice, ticker]);

  const selectedLoanPackage = useMemo(
    () => sizing?.loanPackages.find((item) => item.loanPackageId === loanPackageId) ?? null,
    [loanPackageId, sizing?.loanPackages],
  );

  const orderPrice = useMemo(() => normalizeOrderPrice(priceInput), [priceInput]);
  const orderValue = useMemo(() => (orderPrice ? orderPrice * quantity : 0), [orderPrice, quantity]);

  const loadSizing = async () => {
    if (!canTrade) return;
    setLoadingSizing(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/order-sizing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          side,
          price: priceInput || defaultPrice,
          orderType,
          loanPackageId,
          source,
          signalId,
          navPct,
        }),
      });
      const data = (await res.json()) as SizingResponse;
      if (!res.ok || !data.sizing) throw new Error(data.error ?? "Không tính được khối lượng.");
      setSizing(data.sizing);
      if (!priceInput && data.sizing.displayPrice) setPriceInput(String(data.sizing.displayPrice));
      if (data.sizing.selectedLoanPackageId && loanPackageId === "CASH") {
        setLoanPackageId(data.sizing.selectedLoanPackageId);
      }
      if (!quantityTouched && data.sizing.recommendedQuantity > 0) {
        setQuantity(data.sizing.recommendedQuantity);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tính được khối lượng.");
    } finally {
      setLoadingSizing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSizing();
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canTrade, ticker, side, orderType, priceInput, loanPackageId, signalId, navPct]);

  const setSideAndClear = (nextSide: "BUY" | "SELL") => {
    setSide(nextSide);
    setPreview(null);
    setResult(null);
    setMessage(null);
  };

  const changeQuantity = (delta: number) => {
    setQuantityTouched(true);
    setQuantity((prev) => Math.max(0, floorToLot(prev + delta)));
  };

  const validateBeforeCheck = (checkSide = side) => {
    if (!canTrade) return "Bạn cần liên kết và đăng nhập lại tài khoản DNSE trước khi đặt lệnh.";
    if (!ticker.trim()) return "Vui lòng chọn mã cổ phiếu.";
    if (!quantity || quantity <= 0) return "Vui lòng nhập khối lượng hợp lệ.";
    if (orderType === "LO" && !orderPrice) return "Lệnh LO cần có giá đặt.";
    const maxQuantity = checkSide === "BUY" ? sizing?.buyMaxQuantity ?? 0 : sizing?.sellMaxQuantity ?? 0;
    if (maxQuantity > 0 && quantity > maxQuantity) {
      return `Khối lượng vượt mức ${checkSide === "BUY" ? "mua" : "bán"} tối đa.`;
    }
    return null;
  };

  const checkOrder = async (nextSide = side) => {
    const oldSide = side;
    if (nextSide !== side) setSide(nextSide);
    const validationError = validateBeforeCheck(nextSide);
    if (validationError) {
      setError(validationError);
      return;
    }
    setChecking(true);
    setPreview(null);
    setResult(null);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: {
            ticker,
            accountId: sizing?.accountNo ?? defaultAccountId ?? "",
            side: nextSide,
            quantity,
            orderType,
            price: orderType === "LO" ? orderPrice : null,
            loanPackageId: loanPackageId === "CASH" ? null : loanPackageId,
            rationale: `${sourceLabel(source)} chuyển sang ADN Link`,
            metadata: { source, signalId, navPct },
          },
          source: source === "radar" || source === "aiden" ? "hybrid" : "manual",
        }),
      });
      const data = (await res.json()) as PreviewResponse;
      if (!res.ok || !data.ticket) throw new Error(data.error ?? "Không kiểm tra được lệnh.");
      setPreview(data.ticket.preview ?? null);
      setMessage(data.previewOnly ? "Lệnh đã được kiểm tra. Chế độ an toàn đang bật nên lệnh thật chưa được gửi." : "Lệnh đã được kiểm tra. Vui lòng xác nhận nếu thông tin đúng.");
    } catch (err) {
      if (nextSide !== oldSide) setSide(oldSide);
      setError(err instanceof Error ? err.message : "Không kiểm tra được lệnh.");
    } finally {
      setChecking(false);
    }
  };

  const submitOrder = async () => {
    if (!preview?.previewId) {
      setError("Vui lòng kiểm tra lệnh trước khi gửi.");
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/orders/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: preview.previewId,
          confirm: true,
          confirmationText: "CONFIRM",
          idempotencyKey: `${ticker}:${side}:${orderType}:${quantity}:${orderPrice ?? "market"}:${Date.now()}`,
        }),
      });
      const data = (await res.json()) as SubmitResponse;
      if (!data.result) throw new Error(data.error ?? "Không gửi được lệnh.");
      setResult(data.result);
      setMessage(friendlyResult(data.result));
      if (!res.ok && data.result.status !== "blocked_not_enabled") {
        setError(friendlyResult(data.result));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được lệnh.");
    } finally {
      setSending(false);
    }
  };

  const maxBuy = sizing?.buyMaxQuantity ?? 0;
  const maxSell = sizing?.sellMaxQuantity ?? 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              Bảng đặt lệnh
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Tự điền từ {sourceLabel(source)} theo tài khoản liên kết và giới hạn an toàn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSizing()}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface-2)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingSizing ? "animate-spin" : ""}`} />
            Tính lại
          </button>
        </div>

        {!canTrade ? (
          <DirectStatus tone="warn">Bạn cần liên kết tài khoản DNSE và đăng nhập lại trước khi đặt lệnh.</DirectStatus>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1fr,1fr]">
          <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Mã cổ phiếu
            <input
              value={ticker}
              readOnly
              className="mt-1 w-full rounded-xl border px-3 py-2 text-lg font-black"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            />
          </label>

          <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Gói giao dịch
            <select
              value={loanPackageId}
              onChange={(event) => {
                setLoanPackageId(event.target.value);
                setPreview(null);
              }}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-bold"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            >
              {(sizing?.loanPackages ?? [{ loanPackageId: "CASH", loanPackageName: "Giao dịch tiền mặt", isCash: true, interestRate: 0, maxLoanRatio: 0 }]).map((item) => (
                <option key={item.loanPackageId} value={item.loanPackageId}>
                  {item.loanPackageName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tổng tài sản ròng</p>
            <p className="mt-1 text-lg font-black" style={{ color: "var(--text-primary)" }}>{fmtMoney(sizing?.totalAsset)}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sức mua</p>
            <p className="mt-1 text-lg font-black" style={{ color: "#16a34a" }}>{fmtMoney(sizing?.buyingPower)}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Giá trị lệnh</p>
            <p className="mt-1 text-lg font-black" style={{ color: "var(--text-primary)" }}>{fmtMoney(orderValue)}</p>
          </div>
        </div>

        {selectedLoanPackage && !selectedLoanPackage.isCash ? (
          <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            Gói đang chọn: {selectedLoanPackage.loanPackageName}
            {selectedLoanPackage.maxLoanRatio != null ? ` · tỷ lệ vay tối đa ${selectedLoanPackage.maxLoanRatio}%` : ""}
            {selectedLoanPackage.interestRate != null ? ` · lãi suất ${selectedLoanPackage.interestRate}%` : ""}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {ORDER_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setOrderType(type);
                setPreview(null);
              }}
              className="rounded-xl border px-4 py-2 text-sm font-black"
              style={{
                borderColor: orderType === type ? "var(--primary)" : "var(--border)",
                color: orderType === type ? "var(--on-primary)" : "var(--text-primary)",
                background: orderType === type ? "var(--primary)" : "var(--surface-2)",
              }}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Giá đặt
            <div className="mt-1 flex rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <input
                value={priceInput}
                onChange={(event) => {
                  setPriceInput(event.target.value);
                  setPreview(null);
                }}
                disabled={orderType !== "LO"}
                className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3 py-2 text-lg font-black outline-none disabled:opacity-50"
                style={{ color: "var(--text-primary)" }}
              />
              <button type="button" onClick={() => setPriceInput(toDisplayPrice((orderPrice ?? 0) - 100))} className="border-l px-3 font-black" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>−</button>
              <button type="button" onClick={() => setPriceInput(toDisplayPrice((orderPrice ?? 0) + 100))} className="border-l px-3 font-black" style={{ borderColor: "var(--border)", color: "#16a34a" }}>+</button>
            </div>
          </label>

          <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Khối lượng đặt
            <div className="mt-1 flex rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <input
                value={quantity || ""}
                onChange={(event) => {
                  setQuantityTouched(true);
                  setQuantity(floorToLot(Number(event.target.value)));
                  setPreview(null);
                }}
                className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3 py-2 text-lg font-black outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <button type="button" onClick={() => changeQuantity(-LOT_SIZE)} className="border-l px-3 font-black" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>−</button>
              <button type="button" onClick={() => changeQuantity(LOT_SIZE)} className="border-l px-3 font-black" style={{ borderColor: "var(--border)", color: "#16a34a" }}>+</button>
            </div>
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Mua tối đa: <strong style={{ color: "var(--text-primary)" }}>{fmtNumber(maxBuy)}</strong>
          </div>
          <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Bán tối đa: <strong style={{ color: "var(--text-primary)" }}>{fmtNumber(maxSell)}</strong>
          </div>
          <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Gợi ý: <strong style={{ color: "var(--text-primary)" }}>{fmtNumber(sizing?.recommendedQuantity)}</strong>
          </div>
        </div>

        {(sizing?.target || sizing?.stoploss) ? (
          <div className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            Vùng tham chiếu: chốt lời {fmtMoney(sizing.target)} · cắt lỗ {fmtMoney(sizing.stoploss)}
          </div>
        ) : null}

        {sizing?.warnings?.length ? (
          <div className="mt-3 space-y-1">
            {sizing.warnings.slice(0, 3).map((item) => (
              <DirectStatus key={item} tone="warn">{item}</DirectStatus>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setSideAndClear("BUY");
              void checkOrder("BUY");
            }}
            disabled={checking || sending || !canTrade}
            className="rounded-xl px-4 py-3 text-lg font-black disabled:opacity-50"
            style={{ background: "#22c55e", color: "white" }}
          >
            MUA
            <span className="block text-xs font-semibold">Giá trị: {fmtMoney(side === "BUY" ? orderValue : 0)}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSideAndClear("SELL");
              void checkOrder("SELL");
            }}
            disabled={checking || sending || !canTrade}
            className="rounded-xl px-4 py-3 text-lg font-black disabled:opacity-50"
            style={{ background: "#ef4444", color: "white" }}
          >
            BÁN
            <span className="block text-xs font-semibold">Giá trị: {fmtMoney(side === "SELL" ? orderValue : 0)}</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void checkOrder()}
            disabled={checking || sending || !canTrade}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-2)" }}
          >
            <ShieldCheck className="h-4 w-4" />
            {checking ? "Đang kiểm tra..." : "Kiểm tra lệnh"}
          </button>
          <button
            type="button"
            onClick={() => void submitOrder()}
            disabled={sending || !preview}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            <CheckCircle2 className="h-4 w-4" />
            {sending ? "Đang gửi..." : "Xác nhận gửi lệnh"}
          </button>
        </div>

        {message ? <div className="mt-3"><DirectStatus tone={result?.status === "accepted" ? "good" : "warn"}>{message}</DirectStatus></div> : null}
        {error ? <div className="mt-3"><DirectStatus tone="bad">{error}</DirectStatus></div> : null}
        {result?.warnings?.length ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)", color: "#92400e" }}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Hệ thống đang giữ chế độ an toàn hoặc cần thêm điều kiện trước khi gửi lệnh thật.</span>
          </div>
        ) : null}
      </section>

      <AutoRadarConfigPanel />
    </div>
  );
}
