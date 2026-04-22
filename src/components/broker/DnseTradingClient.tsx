"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  LogIn,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { OrderTicketPanel } from "@/components/broker/OrderTicketPanel";
import { DnseAccountSelector } from "@/components/broker/DnseAccountSelector";
import { DnseLoginModal } from "@/components/broker/DnseLoginModal";
import { DnseAccountInfo } from "@/components/broker/DnseAccountInfo";
import { useTopics } from "@/hooks/useTopics";

type BrokerPosition = {
  ticker: string;
  entryPrice: number | null;
  currentPrice: number | null;
  pnlPercent: number | null;
  target: number | null;
  stoploss: number | null;
  navAllocation: number | null;
  type: string | null;
  tier: string | null;
  quantity?: number | null;
  marketValue?: number | null;
};

type BrokerBalanceTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  navAllocatedPct?: number;
  navRemainingPct?: number;
  maxActiveNavPct?: number;
  totalNav?: number | null;
  buyingPower?: number | null;
  cash?: number | null;
  debt?: number | null;
};

type BrokerHoldingsTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  holdings?: BrokerPosition[];
  positions?: BrokerPosition[];
};

type BrokerOrdersTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  orders?: Array<{
    ticker?: string;
    side?: string;
    quantity?: number;
    price?: number | null;
    status?: string;
    submittedAt?: string | null;
    brokerOrderId?: string | null;
  }>;
};

type BrokerAccountsTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  accounts?: Array<{
    accountNo: string;
    accountName: string | null;
    custodyCode: string | null;
    accountType: string;
    status: string;
  }>;
};

type BrokerLoanPackagesTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  loanPackages?: Array<{
    loanPackageId: string;
    loanPackageName: string;
    interestRate?: number | null;
    maxLoanRatio?: number | null;
    minAmount?: number | null;
    description?: string | null;
  }>;
};

type BrokerOrderHistoryTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  orderHistory?: Array<{
    ticker?: string | null;
    side?: string | null;
    quantity?: number | null;
    price?: number | null;
    status?: string | null;
    submittedAt?: string | null;
    brokerOrderId?: string | null;
  }>;
};

type BrokerPpseTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  ppse?: {
    symbol?: string | null;
    buyingPower?: number | null;
    sellingPower?: number | null;
    maxBuyQty?: number | null;
    maxSellQty?: number | null;
  } | null;
};

type DnseConnectionStatus = {
  dnseId: string | null;
  dnseVerified: boolean;
  dnseAppliedAt: string | null;
  auth?: {
    mode?: "api_key" | "unconfigured";
    configured?: boolean;
    hasApiKey?: boolean;
  };
  connection: {
    linked: boolean;
    accountId: string | null;
    accountName: string | null;
    subAccountId: string | null;
    status: string;
    scope: string | null;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
    updatedAt: string | null;
    source: string;
  };
};

function fmtPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("vi-VN");
}

function pnlTone(value: number | null | undefined) {
  const num = Number(value ?? 0);
  if (num >= 0) {
    return {
      color: "#16a34a",
      bg: "rgba(22,163,74,0.10)",
      border: "rgba(22,163,74,0.25)",
    };
  }
  return {
    color: "var(--danger)",
    bg: "rgba(192,57,43,0.10)",
    border: "rgba(192,57,43,0.25)",
  };
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

export function DnseTradingClient() {
  const searchParams = useSearchParams();
  const queryTicker = (searchParams.get("ticker") ?? "").trim().toUpperCase();
  const queryNavPctRaw = Number(searchParams.get("navPct") ?? "");
  const queryEntryRaw = Number(searchParams.get("entry") ?? "");

  const queryNavPct =
    Number.isFinite(queryNavPctRaw) && queryNavPctRaw > 0
      ? Math.min(100, queryNavPctRaw)
      : null;
  const queryEntryPrice =
    Number.isFinite(queryEntryRaw) && queryEntryRaw > 0 ? queryEntryRaw : null;
  const [ticker, setTicker] = useState(queryTicker || "HPG");
  const [connectionStatus, setConnectionStatus] = useState<DnseConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusReloadKey, setStatusReloadKey] = useState(0);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (queryTicker) setTicker(queryTicker);
  }, [queryTicker]);

  const normalizedTicker = (ticker || queryTicker || "HPG").trim().toUpperCase();
  const topicKeys = useMemo(
    () => [
      "broker:dnse:current-user:accounts",
      "broker:dnse:current-user:balance",
      "broker:dnse:current-user:holdings",
      "broker:dnse:current-user:positions",
      "broker:dnse:current-user:orders",
      "broker:dnse:current-user:loan-packages",
      "broker:dnse:current-user:order-history",
      `broker:dnse:current-user:ppse:${normalizedTicker}`,
    ],
    [normalizedTicker],
  );

  const brokerTopics = useTopics(topicKeys, {
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const balanceTopic = brokerTopics.byTopic.get("broker:dnse:current-user:balance")
    ?.value as BrokerBalanceTopic | null | undefined;
  const holdingsTopic = brokerTopics.byTopic.get("broker:dnse:current-user:holdings")
    ?.value as BrokerHoldingsTopic | null | undefined;
  const positionsTopic = brokerTopics.byTopic.get("broker:dnse:current-user:positions")
    ?.value as BrokerHoldingsTopic | null | undefined;
  const ordersTopic = brokerTopics.byTopic.get("broker:dnse:current-user:orders")
    ?.value as BrokerOrdersTopic | null | undefined;
  const accountsTopic = brokerTopics.byTopic.get("broker:dnse:current-user:accounts")
    ?.value as BrokerAccountsTopic | null | undefined;
  const loanPackagesTopic = brokerTopics.byTopic.get("broker:dnse:current-user:loan-packages")
    ?.value as BrokerLoanPackagesTopic | null | undefined;
  const orderHistoryTopic = brokerTopics.byTopic.get("broker:dnse:current-user:order-history")
    ?.value as BrokerOrderHistoryTopic | null | undefined;
  const ppseTopic = brokerTopics.byTopic.get(`broker:dnse:current-user:ppse:${normalizedTicker}`)
    ?.value as BrokerPpseTopic | null | undefined;

  const holdings = useMemo(() => {
    const fromHoldings = holdingsTopic?.holdings ?? [];
    if (fromHoldings.length > 0) return fromHoldings;
    return holdingsTopic?.positions ?? positionsTopic?.positions ?? [];
  }, [holdingsTopic?.holdings, holdingsTopic?.positions, positionsTopic?.positions]);

  const brokerAccounts = useMemo(
    () => accountsTopic?.accounts ?? [],
    [accountsTopic?.accounts],
  );
  const loanPackages = useMemo(
    () => loanPackagesTopic?.loanPackages ?? [],
    [loanPackagesTopic?.loanPackages],
  );
  const orderHistory = useMemo(
    () => orderHistoryTopic?.orderHistory ?? [],
    [orderHistoryTopic?.orderHistory],
  );

  const primaryBrokerAccountId = useMemo(
    () => brokerAccounts.find((item) => item.accountNo?.trim())?.accountNo?.trim() ?? null,
    [brokerAccounts],
  );

  const fallbackAccountId = useMemo(
    () => connectionStatus?.connection?.accountId?.trim() || null,
    [connectionStatus?.connection?.accountId],
  );

  const selectedAccountId = useMemo(() => {
    if (primaryBrokerAccountId) return primaryBrokerAccountId;
    if (fallbackAccountId && /^\d+$/.test(fallbackAccountId)) return fallbackAccountId;
    return null;
  }, [fallbackAccountId, primaryBrokerAccountId]);
  const hasApiKeyConfigured = Boolean(
    connectionStatus?.auth?.hasApiKey ??
      connectionStatus?.auth?.configured,
  );

  const totalNavValue = useMemo(() => {
    const brokerNav = Number(balanceTopic?.totalNav);
    return Number.isFinite(brokerNav) && brokerNav > 0 ? brokerNav : null;
  }, [balanceTopic?.totalNav]);

  const suggestedNotional = useMemo(() => {
    if (!queryNavPct || !totalNavValue) return null;
    return Number(((totalNavValue * queryNavPct) / 100).toFixed(0));
  }, [queryNavPct, totalNavValue]);

  useEffect(() => {
    if (!queryTicker && holdings.length > 0) {
      setTicker((prev) => (prev ? prev : holdings[0].ticker));
    }
  }, [holdings, queryTicker]);

  useEffect(() => {
    let cancelled = false;
    async function loadConnectionStatus() {
      setStatusLoading(true);
      try {
        const response = await fetch("/api/user/dnse", { cache: "no-store" });
        const payload = (await response.json()) as DnseConnectionStatus & { error?: string };
        if (!cancelled && response.ok) {
          setConnectionStatus(payload);
        } else if (!cancelled) {
          setConnectionStatus(null);
          setSubmitError(payload.error ?? "Không thể tải trạng thái DNSE");
        }
      } catch {
        if (!cancelled) {
          setConnectionStatus(null);
          setSubmitError("Không thể tải trạng thái DNSE");
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    void loadConnectionStatus();
    return () => {
      cancelled = true;
    };
  }, [statusReloadKey]);

  const isConnected = Boolean(
    hasApiKeyConfigured &&
      connectionStatus?.connection?.linked &&
      connectionStatus.dnseVerified &&
      selectedAccountId,
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            DNSE Trading
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Kết nối tài khoản DNSE thật để đồng bộ NAV, danh mục nắm giữ và đặt lệnh trong pilot an toàn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isConnected ? (
            <>
              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                style={{
                  borderColor: "rgba(37,99,235,0.25)",
                  color: "#1d4ed8",
                  background: "rgba(37,99,235,0.10)",
                }}
              >
                <LogIn className="h-3.5 w-3.5" />
                Đăng nhập DNSE
              </button>
              <button
                onClick={() => setShowAccountSelector(true)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                style={{
                  borderColor: "rgba(22,163,74,0.25)",
                  color: "#15803d",
                  background: "rgba(22,163,74,0.10)",
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Liên kết tài khoản DNSE
              </button>
            </>
          ) : null}

          <button
            onClick={() => void brokerTopics.refresh(true)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "var(--surface)",
            }}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${brokerTopics.isValidating ? "animate-spin" : ""}`}
            />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <DnseAccountInfo
            loading={statusLoading}
            linked={isConnected}
            accountId={selectedAccountId}
            accountName={connectionStatus?.connection?.accountName ?? null}
            subAccountId={connectionStatus?.connection?.subAccountId ?? null}
            accessTokenExpiresAt={connectionStatus?.connection?.accessTokenExpiresAt ?? null}
            lastSyncedAt={connectionStatus?.connection?.lastSyncedAt ?? null}
            lastError={connectionStatus?.connection?.lastError ?? null}
            hasApiKeyConfigured={hasApiKeyConfigured}
            accounts={brokerAccounts}
            onOpenLogin={() => setShowLoginModal(true)}
            onOpenLinkSelector={() => setShowAccountSelector(true)}
            onChangedAccount={() => {
              setSubmitError(null);
              setSubmitMessage("Đã đổi tài khoản. Vui lòng chọn tài khoản DNSE mới để liên kết lại.");
              setStatusReloadKey((prev) => prev + 1);
              void brokerTopics.refresh(true);
              setShowAccountSelector(true);
            }}
          />

          {submitMessage ? (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(22,163,74,0.25)",
                color: "#16a34a",
                background: "rgba(22,163,74,0.10)",
              }}
            >
              {submitMessage}
            </div>
          ) : null}
          {submitError ? (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(192,57,43,0.25)",
                color: "var(--danger)",
                background: "rgba(192,57,43,0.10)",
              }}
            >
              {submitError}
            </div>
          ) : null}
        </div>

        <div
          className="hidden rounded-2xl border p-4 md:col-span-2"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h2
              className="text-sm font-black uppercase tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              Tài khoản DNSE chính
            </h2>
          </div>

          {statusLoading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Đang tải thông tin kết nối DNSE...
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border px-2 py-1 text-xs font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  ID: {selectedAccountId ?? "--"}
                </span>
                {isConnected ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
                    style={{
                      borderColor: "rgba(22,163,74,0.25)",
                      color: "#16a34a",
                      background: "rgba(22,163,74,0.10)",
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Đã liên kết tài khoản
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
                    style={{
                      borderColor: "rgba(245,158,11,0.25)",
                      color: "#f59e0b",
                      background: "rgba(245,158,11,0.10)",
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Chưa liên kết tài khoản
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
                  style={{
                    borderColor: "rgba(37,99,235,0.25)",
                    color: "#1d4ed8",
                    background: "rgba(37,99,235,0.10)",
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Pilot Guard bật
                </span>
              </div>

              {isConnected ? (
                <div className="grid gap-2 text-xs md:grid-cols-2" style={{ color: "var(--text-secondary)" }}>
                  <p>
                    Chủ tài khoản:{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {connectionStatus?.connection?.accountName || "--"}
                    </span>
                  </p>
                  <p>
                    Tiểu khoản:{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {connectionStatus?.connection?.subAccountId || "--"}
                    </span>
                  </p>
                  <p>
                    Access token hết hạn:{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {fmtDateTime(connectionStatus?.connection?.accessTokenExpiresAt)}
                    </span>
                  </p>
                  <p>
                    Đồng bộ gần nhất:{" "}
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {fmtDateTime(connectionStatus?.connection?.lastSyncedAt)}
                    </span>
                  </p>
                  {connectionStatus?.connection?.lastError ? (
                    <p className="md:col-span-2" style={{ color: "var(--danger)" }}>
                      Lỗi gần nhất: {connectionStatus.connection.lastError}
                    </p>
                  ) : null}
                  {brokerAccounts.length > 0 ? (
                    <div className="md:col-span-2">
                      <p
                        className="mb-1 text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Danh sách tài khoản giao dịch
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {brokerAccounts.map((account) => (
                          <span
                            key={account.accountNo}
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              borderColor:
                                account.accountNo === selectedAccountId
                                  ? "rgba(22,163,74,0.35)"
                                  : "var(--border)",
                              color:
                                account.accountNo === selectedAccountId
                                  ? "#15803d"
                                  : "var(--text-secondary)",
                              background:
                                account.accountNo === selectedAccountId
                                  ? "rgba(22,163,74,0.10)"
                                  : "var(--surface-2)",
                            }}
                          >
                            {account.accountNo}
                            {account.accountType ? ` · ${account.accountType}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        borderColor: "rgba(37,99,235,0.25)",
                        color: "#1d4ed8",
                        background: "rgba(37,99,235,0.10)",
                      }}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Đăng nhập DNSE
                    </button>
                    <button
                      onClick={() => setShowAccountSelector(true)}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        borderColor: "rgba(22,163,74,0.25)",
                        color: "#15803d",
                        background: "rgba(22,163,74,0.10)",
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Liên kết tài khoản DNSE
                    </button>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Đăng nhập trên DNSE trước, sau đó quay lại để đồng bộ tài khoản.
                    </span>
                  </div>

                  <div
                    className="grid gap-2 rounded-xl border p-3 text-xs"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      Trạng thái kết nối DNSE
                    </p>
                    <p>1. Hệ thống đang chạy theo chế độ API key + tài khoản DNSE đã liên kết.</p>
                    <p>2. Khi DNSE ID được xác minh, dữ liệu NAV/holdings sẽ tự đồng bộ qua broker topics.</p>
                    <p>3. Nếu chưa có dữ liệu realtime, kiểm tra lại account DNSE đã liên kết và trạng thái sync.</p>
                  </div>

                  {!hasApiKeyConfigured ? (
                    <div
                      className="rounded-xl border px-3 py-2 text-xs"
                      style={{
                        borderColor: "rgba(192,57,43,0.25)",
                        color: "var(--danger)",
                        background: "rgba(192,57,43,0.08)",
                      }}
                    >
                      DNSE API chưa cấu hình đủ: thiếu DNSE_API_KEY.
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {submitMessage ? (
            <div
              className="mt-3 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(22,163,74,0.25)",
                color: "#16a34a",
                background: "rgba(22,163,74,0.10)",
              }}
            >
              {submitMessage}
            </div>
          ) : null}
          {submitError ? (
            <div
              className="mt-3 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(192,57,43,0.25)",
                color: "var(--danger)",
                background: "rgba(192,57,43,0.10)",
              }}
            >
              {submitError}
            </div>
          ) : null}
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h2
              className="text-sm font-black uppercase tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              NAV & sức mua
            </h2>
          </div>
          {isConnected ? (
            <div className="space-y-2 text-sm">
              <p style={{ color: "var(--text-secondary)" }}>
                NAV tổng:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {totalNavValue
                    ? `${Math.round(totalNavValue).toLocaleString("vi-VN")} VND`
                    : "--"}
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                Sức mua khả dụng:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {balanceTopic?.buyingPower != null
                    ? `${Math.round(balanceTopic.buyingPower).toLocaleString("vi-VN")} VND`
                    : "--"}
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                NAV đã phân bổ:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {Number(balanceTopic?.navAllocatedPct ?? 0).toFixed(2)}%
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                NAV còn lại:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {Number(balanceTopic?.navRemainingPct ?? 0).toFixed(2)}%
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                Trần NAV active:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {Number(balanceTopic?.maxActiveNavPct ?? 90).toFixed(0)}%
                </span>
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Nguồn: {balanceTopic?.source ?? "N/A"}
              </p>
              {balanceTopic?.reason ? (
                <p className="text-xs" style={{ color: "#f59e0b" }}>
                  Ghi chú: {balanceTopic.reason}
                </p>
              ) : null}
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <CircleOff className="h-3.5 w-3.5" /> Chưa có dữ liệu NAV realtime do tài khoản DNSE chưa liên kết hoặc chưa đồng bộ.
            </div>
          )}

          {queryNavPct ? (
            <div
              className="mt-3 rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Tỷ trọng từ thẻ AI Broker: {queryNavPct.toFixed(2)}%
              </p>
              {suggestedNotional ? (
                <p className="mt-2 text-xs font-semibold" style={{ color: "var(--primary)" }}>
                  Giá trị lệnh gợi ý: {Math.round(suggestedNotional).toLocaleString("vi-VN")} VND
                </p>
              ) : (
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  Chưa tính được giá trị lệnh vì chưa có NAV realtime từ DNSE.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr,1fr]">
        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2
            className="mb-3 text-sm font-black uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Danh mục đang nắm giữ
          </h2>
          {holdings.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có vị thế nắm giữ. Bạn có thể chọn mã từ{" "}
              <Link href="/dashboard/signal-map" style={{ color: "var(--primary)", fontWeight: 700 }}>
                ADN AI Broker
              </Link>{" "}
              để đặt lệnh.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {holdings.map((row) => {
                const pnl = Number(row.pnlPercent ?? 0);
                const tone = pnlTone(pnl);
                return (
                  <button
                    key={`${row.ticker}-${row.entryPrice ?? 0}`}
                    onClick={() => setTicker(row.ticker)}
                    className="rounded-xl border p-3 text-left transition-all hover:translate-y-[-1px]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                        {row.ticker}
                      </p>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          color: tone.color,
                          background: tone.bg,
                          borderColor: tone.border,
                        }}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(2)}%
                      </span>
                    </div>
                    <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <p>
                        Entry: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(row.entryPrice)}</span>
                      </p>
                      <p>
                        Hiện tại: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(row.currentPrice)}</span>
                      </p>
                      <p>
                        Số lượng:{" "}
                        <span style={{ color: "var(--text-primary)" }}>
                          {row.quantity != null ? Number(row.quantity).toLocaleString("vi-VN") : "--"}
                        </span>
                      </p>
                      <p>
                        Giá trị:{" "}
                        <span style={{ color: "var(--text-primary)" }}>
                          {row.marketValue != null
                            ? `${Math.round(row.marketValue).toLocaleString("vi-VN")} VND`
                            : "--"}
                        </span>
                      </p>
                      <p>
                        Target / SL:{" "}
                        <span style={{ color: "var(--text-primary)" }}>
                          {fmtPrice(row.target)} / {fmtPrice(row.stoploss)}
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2
            className="mb-3 text-sm font-black uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Lệnh gần nhất
          </h2>
          {Array.isArray(ordersTopic?.orders) && ordersTopic.orders.length > 0 ? (
            <div className="space-y-2">
              {ordersTopic.orders.slice(0, 6).map((order, index) => (
                <div
                  key={`${order.brokerOrderId ?? order.ticker ?? "order"}-${index}`}
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {order.side ?? "--"} {order.ticker ?? "--"}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{order.status ?? "--"}</span>
                  </div>
                  <p style={{ color: "var(--text-muted)" }}>
                    KL: {order.quantity ?? 0} · Giá: {fmtPrice(order.price ?? null)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có lịch sử lệnh từ DNSE execution audit.
            </p>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border p-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            Đặt lệnh chủ động
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="Nhập mã cổ phiếu"
              className="w-36 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {!isConnected ? (
          <div
            className="rounded-xl border px-3 py-2 text-sm"
            style={{
              borderColor: "rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.10)",
              color: "#92400e",
            }}
          >
            Bạn cần liên kết tài khoản DNSE hợp lệ trước khi đặt lệnh.
          </div>
        ) : null}

        <OrderTicketPanel
          ticker={(ticker || "HPG").trim().toUpperCase()}
          recommendedNavPct={queryNavPct ?? undefined}
          totalNavValue={totalNavValue ?? undefined}
          defaultPrice={queryEntryPrice ?? undefined}
          defaultAccountId={selectedAccountId ?? undefined}
        />
      </div>

      <DnseAccountSelector
        open={showAccountSelector}
        defaultAccountNo={selectedAccountId}
        onCancel={() => setShowAccountSelector(false)}
        onSuccess={(accountNo) => {
          setShowAccountSelector(false);
          setSubmitError(null);
          setSubmitMessage(`Đã liên kết tài khoản DNSE: ${accountNo}`);
          setStatusReloadKey((prev) => prev + 1);
          void brokerTopics.refresh(true);
        }}
      />

      <DnseLoginModal
        open={showLoginModal}
        onCancel={() => setShowLoginModal(false)}
        onSuccess={() => {
          setShowLoginModal(false);
          setSubmitError(null);
          setSubmitMessage("Đăng nhập DNSE thành công. Hãy bấm Liên kết tài khoản DNSE.");
          setStatusReloadKey((prev) => prev + 1);
          void brokerTopics.refresh(true);
        }}
      />
    </div>
  );
}
