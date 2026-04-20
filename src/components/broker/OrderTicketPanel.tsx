"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type {
  DnseExecutionResult,
  OrderExecutionPreview,
  OrderIntent,
  OrderTicket,
  OrderValidationResult,
  OrderType,
} from "@/types/dnse-execution";

type Props = {
  ticker: string;
  recommendedNavPct?: number;
  totalNavValue?: number;
  defaultPrice?: number;
  defaultAccountId?: string;
};

type PreviewResponse = {
  mode: string;
  ticket: OrderTicket;
  deterministic: boolean;
  confirmationPhrase: string;
  previewOnly: boolean;
};

type SubmitResponse = {
  mode: string;
  result: DnseExecutionResult;
  deterministic: boolean;
};

const ORDER_TYPES: OrderType[] = ["LO", "ATO", "ATC", "MP", "MOK", "MAK", "MTL"];
const LOT_SIZE = 100;

function statusTone(status: string) {
  if (status === "valid" || status === "accepted") return "var(--success)";
  if (status === "needs_confirmation" || status === "degraded") return "#f59e0b";
  if (
    status === "approval_required" ||
    status === "blocked_not_enabled" ||
    status === "blocked"
  ) {
    return "#f59e0b";
  }
  return "var(--danger)";
}

function roundDownLot(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity / LOT_SIZE) * LOT_SIZE;
}

function fmtVnd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

export function OrderTicketPanel({
  ticker,
  recommendedNavPct,
  totalNavValue,
  defaultPrice,
  defaultAccountId,
}: Props) {
  const { data: session } = useSession();
  const [accountId, setAccountId] = useState(defaultAccountId?.trim() ?? "");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState(100);
  const [orderType, setOrderType] = useState<OrderType>("LO");
  const [price, setPrice] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [naturalText, setNaturalText] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [roundingHint, setRoundingHint] = useState<string | null>(null);

  const [validation, setValidation] = useState<OrderValidationResult | null>(null);
  const [preview, setPreview] = useState<OrderExecutionPreview | null>(null);
  const [previewMode, setPreviewMode] = useState("SAFE_EXECUTION_ADAPTER_MODE");
  const [submitResult, setSubmitResult] = useState<DnseExecutionResult | null>(null);
  const [loading, setLoading] = useState<"parse" | "preview" | "submit" | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const accountLocked = Boolean(defaultAccountId?.trim());

  useEffect(() => {
    if (defaultAccountId?.trim()) {
      setAccountId(defaultAccountId.trim());
    }
  }, [defaultAccountId]);

  useEffect(() => {
    if (accountLocked) return;
    let cancelled = false;
    const hydrate = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const payload = (await res.json()) as { user?: { dnseId?: string | null } };
        if (!cancelled) {
          const dnseId = payload.user?.dnseId?.trim() || "";
          if (dnseId) setAccountId(dnseId);
        }
      } catch {
        // ignore
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [accountLocked]);

  useEffect(() => {
    setQuantityTouched(false);
    setPriceTouched(false);
    setRoundingHint(null);
  }, [ticker]);

  const normalizedPrice = useMemo(() => {
    const parsed = Number(String(price).replace(/,/g, ".").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }, [price]);

  const navSuggestedNotional = useMemo(() => {
    if (!recommendedNavPct || !totalNavValue) return null;
    return Number(((totalNavValue * recommendedNavPct) / 100).toFixed(0));
  }, [recommendedNavPct, totalNavValue]);

  const calcPrice = useMemo(() => {
    if (normalizedPrice && normalizedPrice > 0) return normalizedPrice;
    if (defaultPrice && defaultPrice > 0) return defaultPrice;
    return null;
  }, [normalizedPrice, defaultPrice]);

  const suggestedRawQuantity = useMemo(() => {
    if (!navSuggestedNotional || !calcPrice) return null;
    const raw = Math.floor(navSuggestedNotional / calcPrice);
    return raw > 0 ? raw : 0;
  }, [navSuggestedNotional, calcPrice]);

  const suggestedLotQuantity = useMemo(() => {
    if (suggestedRawQuantity == null) return null;
    return roundDownLot(suggestedRawQuantity);
  }, [suggestedRawQuantity]);

  useEffect(() => {
    if (defaultPrice && defaultPrice > 0 && !priceTouched) {
      setPrice(String(defaultPrice));
    }
  }, [defaultPrice, priceTouched, ticker]);

  useEffect(() => {
    if (!quantityTouched && suggestedLotQuantity != null && suggestedLotQuantity > 0) {
      setQuantity(suggestedLotQuantity);
      setRoundingHint("Khối lượng đã được làm tròn theo lô 100.");
    }
  }, [quantityTouched, suggestedLotQuantity, ticker]);

  const intentPayload = useMemo((): Partial<OrderIntent> => {
    return {
      ticker: ticker.toUpperCase(),
      accountId: accountId.trim(),
      side,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      orderType,
      price: orderType === "LO" ? normalizedPrice : null,
      rationale: rationale.trim() || null,
      source: "manual",
    };
  }, [ticker, accountId, side, quantity, orderType, normalizedPrice, rationale]);

  const validateManualInputs = (forParse: boolean) => {
    if (!accountId.trim()) {
      return "Vui lòng liên kết tài khoản DNSE trước khi đặt lệnh.";
    }
    if (!ticker.trim()) {
      return "Vui lòng chọn mã cổ phiếu.";
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Khối lượng phải lớn hơn 0.";
    }
    if (!forParse && orderType === "LO" && normalizedPrice == null) {
      return "Lệnh LO cần nhập giá đặt.";
    }
    if (forParse && !naturalText.trim() && orderType === "LO" && normalizedPrice == null) {
      return "Lệnh LO cần nhập giá đặt hoặc nhập câu lệnh tự nhiên đầy đủ.";
    }
    return null;
  };

  const runParse = async () => {
    const manualError = validateManualInputs(true);
    if (manualError) {
      setErrorText(manualError);
      return;
    }

    setLoading("parse");
    setErrorText(null);
    setSubmitResult(null);
    try {
      const payload =
        naturalText.trim().length > 0
          ? {
              text: naturalText.trim(),
              intent: { accountId: accountId.trim(), ticker: ticker.toUpperCase() },
              source: "ai",
            }
          : { intent: intentPayload, source: "manual" };

      const res = await fetch("/api/v1/brokers/dnse/order-intents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        mode?: string;
        validation?: OrderValidationResult;
        intent?: Partial<OrderIntent>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "parse_failed");
      setPreviewMode(data.mode ?? "SAFE_EXECUTION_ADAPTER_MODE");
      if (data.intent) {
        if (typeof data.intent.accountId === "string" && !accountLocked) {
          setAccountId(data.intent.accountId);
        }
        if (data.intent.side === "BUY" || data.intent.side === "SELL") {
          setSide(data.intent.side);
        }
        if (typeof data.intent.quantity === "number") {
          const rounded = roundDownLot(data.intent.quantity);
          setQuantity(rounded > 0 ? rounded : data.intent.quantity);
          setQuantityTouched(true);
        }
        if (
          typeof data.intent.orderType === "string" &&
          ORDER_TYPES.includes(data.intent.orderType as OrderType)
        ) {
          setOrderType(data.intent.orderType as OrderType);
        }
        if (typeof data.intent.price === "number") {
          setPrice(String(data.intent.price));
          setPriceTouched(true);
        }
      }
      setValidation(data.validation ?? null);
      setPreview(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "parse_failed");
    } finally {
      setLoading(null);
    }
  };

  const runPreview = async () => {
    const manualError = validateManualInputs(false);
    if (manualError) {
      setErrorText(manualError);
      return;
    }

    setLoading("preview");
    setErrorText(null);
    setSubmitResult(null);
    setPreview(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: intentPayload,
          source: naturalText.trim() ? "hybrid" : "manual",
        }),
      });
      const data = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok || !data.ticket) throw new Error(data.error ?? "preview_failed");
      setPreviewMode(data.mode ?? "SAFE_EXECUTION_ADAPTER_MODE");
      setValidation(data.ticket.validation);
      setPreview(data.ticket.preview);
      setConfirmChecked(false);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "preview_failed");
    } finally {
      setLoading(null);
    }
  };

  const runSubmit = async () => {
    if (!preview?.previewId) return;
    setLoading("submit");
    setErrorText(null);
    try {
      const res = await fetch("/api/v1/brokers/dnse/orders/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: preview.previewId,
          confirm: true,
          confirmationText: "CONFIRM",
        }),
      });
      const data = (await res.json()) as SubmitResponse & { error?: string };
      if (!res.ok && !data.result) throw new Error(data.error ?? "submit_failed");
      setSubmitResult(data.result ?? null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "submit_failed");
    } finally {
      setLoading(null);
    }
  };

  const applySuggestedSizing = () => {
    if (defaultPrice && defaultPrice > 0) {
      setPrice(String(defaultPrice));
      setPriceTouched(true);
    }
    if (suggestedLotQuantity && suggestedLotQuantity > 0) {
      setQuantity(suggestedLotQuantity);
      setQuantityTouched(true);
      setRoundingHint("Đã áp dụng khối lượng theo tỷ trọng NAV và làm tròn lô 100.");
    }
  };

  const handleQuantityBlur = () => {
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const rounded = roundDownLot(quantity);
    if (rounded !== quantity) {
      setQuantity(rounded);
      setRoundingHint(
        rounded > 0
          ? `Khối lượng đã được làm tròn xuống ${rounded.toLocaleString("vi-VN")} cổ phiếu (bội số 100).`
          : "Khối lượng chưa đủ 1 lô 100.",
      );
    }
  };

  return (
    <section
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3
            className="text-sm font-black uppercase tracking-wider"
            style={{ color: "var(--text-primary)" }}
          >
            Phiếu lệnh DNSE
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Chế độ: <span className="font-semibold">{previewMode}</span> · Kiểm soát deterministic phía server
          </p>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Bắt buộc xác nhận thủ công
        </span>
      </div>

      {!session?.user?.id ? (
        <div
          className="rounded-xl border p-3 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Đăng nhập để sử dụng phiếu lệnh DNSE.
        </div>
      ) : (
        <div className="space-y-3">
          {recommendedNavPct ? (
            <div
              className="rounded-xl border p-3 text-xs"
              style={{
                borderColor: "rgba(22,163,74,0.25)",
                background: "rgba(22,163,74,0.08)",
                color: "var(--text-secondary)",
              }}
            >
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Khuyến nghị từ thẻ ADN AI Broker
              </p>
              <p className="mt-1">
                Tỷ trọng NAV:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {recommendedNavPct.toFixed(2)}%
                </span>
              </p>
              <p>
                NAV tổng:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {fmtVnd(totalNavValue)}
                </span>
              </p>
              <p>
                Giá trị lệnh mục tiêu:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {fmtVnd(navSuggestedNotional)}
                </span>
              </p>
              <p>
                Khối lượng sau làm tròn lô 100:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {suggestedLotQuantity == null ? "--" : suggestedLotQuantity.toLocaleString("vi-VN")}
                </span>
              </p>
              {suggestedLotQuantity === 0 ? (
                <p className="mt-1" style={{ color: "#f59e0b" }}>
                  NAV/giá hiện tại chưa đủ 1 lô 100. Vui lòng tăng NAV hoặc điều chỉnh giá đặt.
                </p>
              ) : null}
              <div className="mt-2">
                <button
                  onClick={applySuggestedSizing}
                  className="rounded-xl border px-3 py-2 text-[11px] font-bold"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                    background: "var(--surface)",
                  }}
                >
                  Áp dụng số lượng theo tỷ trọng NAV
                </button>
              </div>
            </div>
          ) : null}

          <textarea
            value={naturalText}
            onChange={(event) => setNaturalText(event.target.value)}
            placeholder="Nhập lệnh tự nhiên (VD: Mua HPG 1000 giá 25.4)..."
            className="min-h-[72px] w-full rounded-xl border p-3 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              readOnly={accountLocked}
              placeholder="Tài khoản DNSE"
              className="rounded-xl border px-3 py-2 text-sm read-only:opacity-80"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
            <input
              value={ticker.toUpperCase()}
              readOnly
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
            <select
              value={side}
              onChange={(event) => setSide(event.target.value === "SELL" ? "SELL" : "BUY")}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            >
              <option value="BUY">MUA</option>
              <option value="SELL">BÁN</option>
            </select>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => {
                setQuantity(Number(event.target.value));
                setQuantityTouched(true);
                setRoundingHint(null);
              }}
              onBlur={handleQuantityBlur}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
            <select
              value={orderType}
              onChange={(event) => setOrderType(event.target.value as OrderType)}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            >
              {ORDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={price}
              disabled={orderType !== "LO"}
              onChange={(event) => {
                setPrice(event.target.value);
                setPriceTouched(true);
              }}
              placeholder="Giá đặt"
              className="rounded-xl border px-3 py-2 text-sm disabled:opacity-60"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {roundingHint ? (
            <p className="text-xs" style={{ color: "#f59e0b" }}>
              {roundingHint}
            </p>
          ) : null}

          <textarea
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Ghi chú lý do vào lệnh (tuỳ chọn)"
            className="min-h-[62px] w-full rounded-xl border p-3 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void runParse()}
              disabled={loading !== null}
              className="rounded-xl border px-3 py-2 text-xs font-bold"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {loading === "parse" ? "Đang phân tích..." : "Phân tích lệnh"}
            </button>
            <button
              onClick={() => void runPreview()}
              disabled={loading !== null}
              className="rounded-xl px-3 py-2 text-xs font-bold"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              {loading === "preview" ? "Đang kiểm tra..." : "Kiểm tra + Preview"}
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Mẹo: có thể bỏ qua bước “Phân tích lệnh” và bấm thẳng “Kiểm tra + Preview”.
          </p>

          {validation ? (
            <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)" }}>
              <p className="font-semibold" style={{ color: statusTone(validation.status) }}>
                Trạng thái kiểm tra: {validation.status}
              </p>
              {validation.issues.length > 0 ? (
                <p style={{ color: "var(--danger)" }}>Vấn đề: {validation.issues.join(", ")}</p>
              ) : null}
              {validation.warnings.length > 0 ? (
                <p style={{ color: "#f59e0b" }}>Cảnh báo: {validation.warnings.join(", ")}</p>
              ) : null}
              <p style={{ color: "var(--text-muted)" }}>
                Giá trị lệnh: {validation.estimatedNotional?.toLocaleString("vi-VN") ?? "--"} ·
                Phí ước tính: {validation.estimatedFees?.toLocaleString("vi-VN") ?? "--"}
              </p>
            </div>
          ) : null}

          {preview?.previewId ? (
            <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Mã preview: {preview.previewId}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Hết hạn: {new Date(preview.expiresAt).toLocaleString("vi-VN")}
              </p>
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => setConfirmChecked(event.target.checked)}
                />
                Tôi xác nhận gửi lệnh này (CONFIRM)
              </label>
              <button
                onClick={() => void runSubmit()}
                disabled={!confirmChecked || loading !== null}
                className="rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60"
                style={{ background: "var(--danger)", color: "white" }}
              >
                {loading === "submit" ? "Đang gửi lệnh..." : "Xác nhận gửi lệnh"}
              </button>
            </div>
          ) : null}

          {submitResult ? (
            <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)" }}>
              <p className="font-semibold" style={{ color: statusTone(submitResult.status) }}>
                Kết quả gửi lệnh: {submitResult.status}
              </p>
              {submitResult.brokerOrderId ? (
                <p style={{ color: "var(--text-secondary)" }}>
                  Mã lệnh môi giới: {submitResult.brokerOrderId}
                </p>
              ) : null}
              {submitResult.warnings.length > 0 ? (
                <p style={{ color: "#f59e0b" }}>
                  Cảnh báo: {submitResult.warnings.join(", ")}
                </p>
              ) : null}
              {submitResult.errors.length > 0 ? (
                <p style={{ color: "var(--danger)" }}>
                  Lỗi: {submitResult.errors.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {errorText ? (
            <div
              className="rounded-xl border p-3 text-xs"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              {errorText}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
