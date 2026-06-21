"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LogIn, RefreshCw } from "lucide-react";
import { DirectOrderPanel, AutoRadarConfigPanel } from "@/components/broker/DirectOrderPanel";
import { DnseAccountSelector } from "@/components/broker/DnseAccountSelector";
import { DnseLoginModal } from "@/components/broker/DnseLoginModal";
import { useTopics } from "@/hooks/useTopics";
import s from "./adnx.module.css";

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
    mode?: "api_key" | "unconfigured" | "dnse_user_session";
    configured?: boolean;
    hasApiKey?: boolean;
    hasSession?: boolean;
    sessionExpiresAt?: string | null;
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

type DnseApiBalanceResponse = {
  success?: boolean;
  source?: string;
  balance?: {
    accountNo?: string | null;
    cashBalance?: number | null;
    cashAvailable?: number | null;
    cashWithdrawable?: number | null;
    totalAsset?: number | null;
    totalDebt?: number | null;
    netAssetValue?: number | null;
    buyingPower?: number | null;
  } | null;
  error?: string;
};

type DnseApiPositionsResponse = {
  success?: boolean;
  source?: string;
  positions?: Array<{
    symbol?: string | null;
    ticker?: string | null;
    quantity?: number | null;
    avgPrice?: number | null;
    lastPrice?: number | null;
    marketValue?: number | null;
    totalPLPct?: number | null;
  }>;
  error?: string;
};

type DnseApiOrdersResponse = {
  success?: boolean;
  source?: string;
  orders?: Array<{
    symbol?: string | null;
    ticker?: string | null;
    side?: string | null;
    quantity?: number | null;
    price?: number | null;
    status?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    orderId?: string | null;
  }>;
  error?: string;
};

type DnseApiAccountsResponse = {
  success?: boolean;
  source?: string;
  accounts?: Array<{
    accountNo: string;
    accountName: string | null;
    custodyCode: string | null;
    accountType: string;
    status: string;
  }>;
  error?: string;
};

type DnseApiLoanPackagesResponse = {
  success?: boolean;
  source?: string;
  packages?: Array<{
    id?: string | number | null;
    code?: string | null;
    name?: string | null;
    description?: string | null;
    maxLoanRatio?: number | null;
    interestRate?: number | null;
    minLoanRate?: number | null;
    maxLoanRate?: number | null;
    [key: string]: unknown;
  }>;
  error?: string;
};

type DirectDnseState = {
  loading: boolean;
  accounts: BrokerAccountsTopic | null;
  balance: BrokerBalanceTopic | null;
  holdings: BrokerHoldingsTopic | null;
  orders: BrokerOrdersTopic | null;
  loanPackages: BrokerLoanPackagesTopic | null;
  resolved: {
    accounts: boolean;
    balance: boolean;
    holdings: boolean;
    orders: boolean;
    loanPackages: boolean;
  };
  errors: {
    accounts: string | null;
    balance: string | null;
    holdings: string | null;
    orders: string | null;
    loanPackages?: string | null;
  };
};

function fmtPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("vi-VN");
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

function hasFutureDate(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function normalizeDnseReasonVi(reason: string | null | undefined) {
  if (!reason) return null;
  const normalized = reason.trim();
  const lower = normalized.toLowerCase();

  if (/session-only mode|session api failed/.test(lower)) {
    return "DNSE chưa trả về dữ liệu cho phiên hiện tại. Vui lòng làm mới dữ liệu hoặc đăng nhập lại DNSE.";
  }

  if (/broker connection not found for current user/.test(lower)) {
    return "Hệ thống chưa đọc được kết nối DNSE của phiên hiện tại. Vui lòng làm mới dữ liệu hoặc đăng nhập lại DNSE.";
  }

  if (/dnse connection is not verified for current user/.test(lower)) {
    return "Tài khoản DNSE hiện chưa ở trạng thái xác minh hợp lệ cho phiên này.";
  }

  if (
    /token expired|authorization|unauthorized|forbidden|jwt|dnse_login_required|dnse_login_expired/.test(
      lower,
    )
  ) {
    return "Phiên DNSE đã hết hạn. Vui lòng bấm “Đăng nhập lại DNSE” để làm mới tổng tài sản ròng và danh mục.";
  }

  if (/api key not found in storage|oa-401|oa-400/.test(lower)) {
    return "Máy chủ chưa lấy được dữ liệu fallback từ DNSE OpenAPI. Cần kiểm tra lại API key/secret.";
  }

  return normalized;
}

function isDnseLiveSource(source: string | null | undefined) {
  if (!source) return false;
  return /dnse_api|dnse_openapi|dnse_user_session|broker-sync/i.test(source);
}

function liveDnseTopic<T extends { source?: string }>(topic: T | null | undefined): T | null {
  return isDnseLiveSource(topic?.source) ? topic ?? null : null;
}

function toDirectAccountsTopic(
  payload: DnseApiAccountsResponse | null,
): BrokerAccountsTopic | null {
  if (!payload?.success || !Array.isArray(payload.accounts)) return null;
  return {
    connected: true,
    source: payload.source ?? "dnse_api",
    accounts: payload.accounts,
  };
}

function toDirectHoldingsTopic(
  payload: DnseApiPositionsResponse | null,
  totalNav: number | null,
): BrokerHoldingsTopic | null {
  if (!payload?.success || !Array.isArray(payload.positions)) return null;

  const positions: BrokerPosition[] = payload.positions.map((row) => {
    const marketValue = Number(row.marketValue ?? 0);
    const entryPrice = Number(row.avgPrice ?? 0);
    const currentPrice = Number(row.lastPrice ?? 0);
    const navAllocation =
      totalNav && totalNav > 0 && marketValue > 0 ? (marketValue / totalNav) * 100 : null;

    return {
      ticker: String(row.ticker ?? row.symbol ?? "").trim().toUpperCase(),
      entryPrice: Number.isFinite(entryPrice) && entryPrice > 0 ? entryPrice : null,
      currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
      pnlPercent: Number.isFinite(Number(row.totalPLPct)) ? Number(row.totalPLPct) : null,
      target: null,
      stoploss: null,
      navAllocation,
      type: null,
      tier: null,
      quantity: Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : null,
      marketValue: Number.isFinite(marketValue) ? marketValue : null,
    };
  });

  return {
    connected: true,
    source: payload.source ?? "dnse_api",
    holdings: positions,
    positions,
  };
}

function toDirectOrdersTopic(payload: DnseApiOrdersResponse | null): BrokerOrdersTopic | null {
  if (!payload?.success || !Array.isArray(payload.orders)) return null;
  return {
    connected: true,
    source: payload.source ?? "dnse_api",
    orders: payload.orders.map((order) => ({
      ticker: String(order.ticker ?? order.symbol ?? "").trim().toUpperCase() || undefined,
      side: order.side ?? undefined,
      quantity: Number.isFinite(Number(order.quantity)) ? Number(order.quantity) : undefined,
      price: Number.isFinite(Number(order.price)) ? Number(order.price) : null,
      status: order.status ?? undefined,
      submittedAt: order.createdAt ?? order.updatedAt ?? null,
      brokerOrderId: order.orderId ?? null,
    })),
  };
}

function toDirectLoanPackagesTopic(
  payload: DnseApiLoanPackagesResponse | null,
): BrokerLoanPackagesTopic | null {
  if (!payload?.success || !Array.isArray(payload.packages)) return null;
  return {
    connected: true,
    source: payload.source ?? "dnse_api",
    loanPackages: payload.packages.map((pkg, index) => ({
      loanPackageId:
        String(pkg.id ?? pkg.code ?? pkg.name ?? `loan-package-${index}`).trim() ||
        `loan-package-${index}`,
      loanPackageName:
        String(pkg.name ?? pkg.code ?? `Gói vay ${index + 1}`).trim() ||
        `Gói vay ${index + 1}`,
      interestRate:
        Number.isFinite(Number(pkg.interestRate)) ? Number(pkg.interestRate) : null,
      maxLoanRatio:
        Number.isFinite(Number(pkg.maxLoanRatio)) ? Number(pkg.maxLoanRatio) : null,
      minAmount:
        Number.isFinite(Number(pkg.minLoanRate)) ? Number(pkg.minLoanRate) : null,
      description:
        typeof pkg.description === "string" && pkg.description.trim()
          ? pkg.description.trim()
          : null,
    })),
  };
}

function HoldingsTable({ holdings, hint, limit }: { holdings: BrokerPosition[]; hint: string | null; limit?: number }) {
  const rows = limit ? holdings.slice(0, limit) : holdings;
  return (
    <section className={s.card}>
      <div className={s.secH}><div><div className={s.eyebrow}>Danh mục</div><div className={s.secTitle}>Vị thế nắm giữ</div></div></div>
      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table className={s.table}>
            <thead><tr>{["Mã", "KL", "Giá vốn", "Giá hiện", "Lời/Lỗ", "Tỷ trọng"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => {
                const up = Number(row.pnlPercent ?? 0) >= 0;
                return (
                  <tr key={row.ticker}>
                    <td><span className={s.serif} style={{ fontWeight: 600, fontSize: 14 }}>{row.ticker}</span></td>
                    <td className={s.tnum}>{fmtPrice(row.quantity)}</td>
                    <td className={s.tnum}>{fmtPrice(row.entryPrice)}</td>
                    <td className={s.tnum}>{fmtPrice(row.currentPrice)}</td>
                    <td className={s.tnum} style={{ color: up ? "var(--accent-fa)" : "var(--danger)" }}>{row.pnlPercent != null ? `${up ? "+" : ""}${row.pnlPercent.toFixed(2)}%` : "--"}</td>
                    <td className={s.tnum}>{row.navAllocation != null ? `${row.navAllocation.toFixed(1)}%` : "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{hint ?? "Chưa có vị thế nắm giữ."}</p>
      )}
    </section>
  );
}

function OrdersTable({
  title,
  orders,
  hint,
  limit,
}: {
  title: string;
  orders: Array<{ ticker?: string | null; side?: string | null; quantity?: number | null; price?: number | null; status?: string | null; submittedAt?: string | null; brokerOrderId?: string | null }>;
  hint: string | null;
  limit?: number;
}) {
  const rows = limit ? orders.slice(0, limit) : orders;
  return (
    <section className={s.card}>
      <div className={s.secH}><div><div className={s.eyebrow}>Sổ lệnh</div><div className={s.secTitle}>{title}</div></div></div>
      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table className={s.table}>
            <thead><tr>{["Mã", "Chiều", "KL", "Giá", "Trạng thái", "Thời gian"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const sv = String(row.side ?? "").toUpperCase();
                const isBuy = sv.includes("B") || sv === "NB";
                return (
                  <tr key={row.brokerOrderId ?? `${row.ticker}-${index}`}>
                    <td><span className={s.serif} style={{ fontWeight: 600, fontSize: 14 }}>{row.ticker ?? "--"}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: isBuy ? "var(--accent-fa)" : "var(--danger)" }}>{isBuy ? "Mua" : "Bán"}</td>
                    <td className={s.tnum}>{fmtPrice(row.quantity)}</td>
                    <td className={s.tnum}>{fmtPrice(row.price)}</td>
                    <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{row.status ?? "--"}</td>
                    <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>{fmtDateTime(row.submittedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{hint ?? "Chưa có lệnh nào."}</p>
      )}
    </section>
  );
}

export function DnseTradingClient() {
  const searchParams = useSearchParams();
  const queryTicker = (searchParams.get("ticker") ?? "").trim().toUpperCase();
  const queryNavPctRaw = Number(searchParams.get("navPct") ?? "");
  const queryEntryRaw = Number(searchParams.get("entry") ?? "");
  const querySideRaw = (searchParams.get("side") ?? "BUY").trim().toUpperCase();
  const querySource = (searchParams.get("source") ?? "").trim().toLowerCase() || null;
  const querySignalId = (searchParams.get("signalId") ?? "").trim() || null;

  const queryNavPct =
    Number.isFinite(queryNavPctRaw) && queryNavPctRaw > 0
      ? Math.min(100, queryNavPctRaw)
      : null;
  const queryEntryPrice =
    Number.isFinite(queryEntryRaw) && queryEntryRaw > 0 ? queryEntryRaw : null;
  const querySide = querySideRaw === "SELL" ? "SELL" : "BUY";
  const [ticker, setTicker] = useState(queryTicker || "HPG");
  const [connectionStatus, setConnectionStatus] = useState<DnseConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusReloadKey, setStatusReloadKey] = useState(0);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"order" | "portfolio" | "orders" | "auto">("order");
  const [directDnse, setDirectDnse] = useState<DirectDnseState>({
    loading: false,
    accounts: null,
    balance: null,
    holdings: null,
    orders: null,
    loanPackages: null,
    resolved: {
      accounts: false,
      balance: false,
      holdings: false,
      orders: false,
      loanPackages: false,
    },
    errors: {
      accounts: null,
      balance: null,
      holdings: null,
      orders: null,
      loanPackages: null,
    },
  });

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
    enabled: !statusLoading && Boolean(connectionStatus?.connection?.linked),
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const balanceEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:balance");
  const holdingsEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:holdings");
  const positionsEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:positions");
  const ordersEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:orders");
  const accountsEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:accounts");
  const loanPackagesEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:loan-packages");
  const orderHistoryEnvelope = brokerTopics.byTopic.get("broker:dnse:current-user:order-history");
  const ppseEnvelope = brokerTopics.byTopic.get(`broker:dnse:current-user:ppse:${normalizedTicker}`);

  const balanceTopic = balanceEnvelope?.value as BrokerBalanceTopic | null | undefined;
  const holdingsTopic = holdingsEnvelope?.value as BrokerHoldingsTopic | null | undefined;
  const positionsTopic = positionsEnvelope?.value as BrokerHoldingsTopic | null | undefined;
  const ordersTopic = ordersEnvelope?.value as BrokerOrdersTopic | null | undefined;
  const accountsTopic = accountsEnvelope?.value as BrokerAccountsTopic | null | undefined;
  const loanPackagesTopic = loanPackagesEnvelope?.value as BrokerLoanPackagesTopic | null | undefined;
  const orderHistoryTopic = orderHistoryEnvelope?.value as BrokerOrderHistoryTopic | null | undefined;
  const ppseTopic = ppseEnvelope?.value as BrokerPpseTopic | null | undefined;

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "error" in payload && payload.error
          ? payload.error
          : `Request failed: ${response.status}`;
      throw new Error(errorMessage);
    }
    return payload as T;
  }

  async function refreshDirectDnseData() {
    if (!connectionStatus?.connection?.linked) {
      setDirectDnse((prev) => ({
        ...prev,
        loading: false,
        accounts: null,
        balance: null,
        holdings: null,
        orders: null,
        loanPackages: null,
        resolved: {
          accounts: false,
          balance: false,
          holdings: false,
          orders: false,
          loanPackages: false,
        },
        errors: {
          accounts: null,
          balance: null,
          holdings: null,
          orders: null,
          loanPackages: null,
        },
      }));
      return;
    }

    setDirectDnse((prev) => ({ ...prev, loading: true }));

    const results = await Promise.allSettled([
      fetchJson<DnseApiAccountsResponse>("/api/dnse/accounts"),
      fetchJson<DnseApiBalanceResponse>("/api/dnse/balance"),
      fetchJson<DnseApiPositionsResponse>("/api/dnse/positions"),
      fetchJson<DnseApiOrdersResponse>("/api/dnse/orders"),
      fetchJson<DnseApiLoanPackagesResponse>(
        `/api/dnse/loan-packages?symbol=${encodeURIComponent(normalizedTicker || "HPG")}`,
      ),
    ]);

    const accountsResult = results[0];
    const balanceResult = results[1];
    const positionsResult = results[2];
    const ordersResult = results[3];
    const loanPackagesResult = results[4];

    const accountsPayload =
      accountsResult.status === "fulfilled" ? accountsResult.value : null;
    const balancePayload =
      balanceResult.status === "fulfilled" ? balanceResult.value : null;
    const positionsPayload =
      positionsResult.status === "fulfilled" ? positionsResult.value : null;
    const ordersPayload =
      ordersResult.status === "fulfilled" ? ordersResult.value : null;
    const loanPackagesPayload =
      loanPackagesResult.status === "fulfilled" ? loanPackagesResult.value : null;

    const totalNavRaw = Number(
      balancePayload?.balance?.totalAsset ??
        balancePayload?.balance?.netAssetValue ??
        0,
    );
    const totalNav =
      Number.isFinite(totalNavRaw) && totalNavRaw > 0 ? totalNavRaw : null;

    const directHoldingsTopic = toDirectHoldingsTopic(positionsPayload, totalNav);
    const allocatedValue =
      directHoldingsTopic?.holdings?.reduce(
        (sum, item) => sum + Number(item.marketValue ?? 0),
        0,
      ) ?? 0;
    const allocatedPct =
      totalNav && totalNav > 0 ? Math.min(100, (allocatedValue / totalNav) * 100) : 0;
    const remainingPct = Math.max(0, 100 - allocatedPct);

    const directBalanceTopic: BrokerBalanceTopic | null =
      balancePayload?.success && balancePayload.balance
        ? {
            connected: true,
            source: balancePayload.source ?? "dnse_api",
            totalNav,
            buyingPower: Number(
              balancePayload.balance.buyingPower ??
                balancePayload.balance.cashAvailable ??
                0,
            ),
            cash: Number(
              balancePayload.balance.cashBalance ??
                balancePayload.balance.cashWithdrawable ??
                0,
            ),
            debt: Number(balancePayload.balance.totalDebt ?? 0),
            navAllocatedPct: allocatedPct,
            navRemainingPct: remainingPct,
            maxActiveNavPct: Number(balanceTopic?.maxActiveNavPct ?? 90),
          }
        : null;

    setDirectDnse({
      loading: false,
      accounts: toDirectAccountsTopic(accountsPayload),
      balance: directBalanceTopic,
      holdings: directHoldingsTopic,
      orders: toDirectOrdersTopic(ordersPayload),
      loanPackages: toDirectLoanPackagesTopic(loanPackagesPayload),
      resolved: {
        accounts: accountsResult.status === "fulfilled",
        balance: balanceResult.status === "fulfilled",
        holdings: positionsResult.status === "fulfilled",
        orders: ordersResult.status === "fulfilled",
        loanPackages: loanPackagesResult.status === "fulfilled",
      },
      errors: {
        accounts:
          accountsResult.status === "rejected" ? accountsResult.reason?.message ?? "Không thể đọc tài khoản DNSE." : null,
        balance:
          balanceResult.status === "rejected" ? balanceResult.reason?.message ?? "Không thể đọc tổng tài sản ròng DNSE." : null,
        holdings:
          positionsResult.status === "rejected" ? positionsResult.reason?.message ?? "Không thể đọc danh mục DNSE." : null,
        orders:
          ordersResult.status === "rejected" ? ordersResult.reason?.message ?? "Không thể đọc lịch sử lệnh DNSE." : null,
        loanPackages:
          loanPackagesResult.status === "rejected"
            ? loanPackagesResult.reason?.message ?? "Không thể đọc danh sách gói vay DNSE."
            : null,
      },
    });
  }

  function refreshDnseViews(forceTopics = true) {
    if (connectionStatus?.connection?.linked) {
      void brokerTopics.refresh(forceTopics);
    }
    void refreshDirectDnseData();
  }

  const strictLinkedMode = Boolean(connectionStatus?.connection?.linked);

  const effectiveAccountsTopic = directDnse.resolved.accounts
    ? directDnse.accounts
    : (directDnse.accounts ?? accountsTopic);
  const effectiveBalanceTopic = strictLinkedMode
    ? (directDnse.balance ??
      liveDnseTopic(balanceTopic))
    : (directDnse.resolved.balance
      ? directDnse.balance
      : (directDnse.balance ?? balanceTopic));
  const effectiveHoldingsTopic = strictLinkedMode
    ? (directDnse.holdings ?? liveDnseTopic(holdingsTopic) ?? liveDnseTopic(positionsTopic))
    : (directDnse.resolved.holdings
      ? directDnse.holdings
      : (directDnse.holdings ?? holdingsTopic ?? positionsTopic));
  const effectiveOrdersTopic = strictLinkedMode
    ? (directDnse.orders ?? liveDnseTopic(ordersTopic))
    : (directDnse.resolved.orders
      ? directDnse.orders
      : (directDnse.orders ?? ordersTopic));
  const effectiveLoanPackagesTopic = strictLinkedMode
    ? (directDnse.loanPackages ?? liveDnseTopic(loanPackagesTopic))
    : (directDnse.resolved.loanPackages
      ? directDnse.loanPackages
      : (directDnse.loanPackages ?? loanPackagesTopic));

  const holdings = useMemo(() => {
    const fromHoldings = effectiveHoldingsTopic?.holdings ?? [];
    if (fromHoldings.length > 0) return fromHoldings;
    return effectiveHoldingsTopic?.positions ?? [];
  }, [effectiveHoldingsTopic?.holdings, effectiveHoldingsTopic?.positions]);

  const orderHistory = useMemo(
    () => orderHistoryTopic?.orderHistory ?? [],
    [orderHistoryTopic?.orderHistory],
  );

  const latestOrders = useMemo(() => {
    const topicOrders = Array.isArray(effectiveOrdersTopic?.orders)
      ? effectiveOrdersTopic.orders
      : [];
    if (topicOrders.length > 0) return topicOrders;

    if (strictLinkedMode) {
      return [];
    }

    return Array.isArray(orderHistory)
      ? orderHistory.map((row) => ({
          ticker: row.ticker ?? undefined,
          side: row.side ?? undefined,
          quantity: row.quantity ?? undefined,
          price: row.price ?? null,
          status: row.status ?? undefined,
          submittedAt: row.submittedAt ?? null,
          brokerOrderId: row.brokerOrderId ?? null,
        }))
      : [];
  }, [effectiveOrdersTopic?.orders, orderHistory, orderHistoryTopic?.source, strictLinkedMode]);

  const brokerAccounts = useMemo(
    () => effectiveAccountsTopic?.accounts ?? [],
    [effectiveAccountsTopic?.accounts],
  );
  const loanPackages = useMemo(
    () => effectiveLoanPackagesTopic?.loanPackages ?? [],
    [effectiveLoanPackagesTopic?.loanPackages],
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
  const isLinkedAccount = Boolean(
    connectionStatus?.connection?.linked &&
      connectionStatus?.dnseVerified &&
      selectedAccountId,
  );
  const hasActiveDnseSession = Boolean(connectionStatus?.auth?.hasSession) ||
    hasFutureDate(connectionStatus?.connection?.accessTokenExpiresAt);
  const needsRelogin = isLinkedAccount && !hasActiveDnseSession;
  const hasNavData =
    Number.isFinite(Number(effectiveBalanceTopic?.totalNav)) &&
    Number(effectiveBalanceTopic?.totalNav) > 0;
  const hasBuyingPowerData =
    Number.isFinite(Number(effectiveBalanceTopic?.buyingPower)) &&
    Number(effectiveBalanceTopic?.buyingPower) >= 0;
  const hasHoldingsData = holdings.length > 0;
  const hasOrdersData = latestOrders.length > 0;
  const hasBrokerData = hasNavData || hasBuyingPowerData || hasHoldingsData || hasOrdersData;
  const canUseTopicBalanceHint =
    !connectionStatus?.connection?.linked && !directDnse.resolved.balance;
  const canUseTopicHoldingsHint =
    !connectionStatus?.connection?.linked && !directDnse.resolved.holdings;
  const canUseTopicOrdersHint =
    !connectionStatus?.connection?.linked && !directDnse.resolved.orders;
  const balanceHint =
    normalizeDnseReasonVi(directDnse.errors.balance) ??
    (canUseTopicBalanceHint ? normalizeDnseReasonVi(effectiveBalanceTopic?.reason) : null) ??
    (canUseTopicBalanceHint ? normalizeDnseReasonVi(balanceEnvelope?.error?.message) : null) ??
    (needsRelogin
      ? "Phiên DNSE đã hết hạn. Vui lòng đăng nhập lại để đồng bộ tổng tài sản ròng và danh mục."
      : null);
  const holdingsHint =
    normalizeDnseReasonVi(directDnse.errors.holdings) ??
    (canUseTopicHoldingsHint ? normalizeDnseReasonVi(effectiveHoldingsTopic?.reason) : null) ??
    (canUseTopicHoldingsHint ? normalizeDnseReasonVi(holdingsEnvelope?.error?.message) : null) ??
    (canUseTopicHoldingsHint ? normalizeDnseReasonVi(positionsEnvelope?.error?.message) : null) ??
    (needsRelogin
      ? "Phiên DNSE đã hết hạn nên chưa đọc được danh mục nắm giữ."
      : null);
  const ordersHint =
    normalizeDnseReasonVi(directDnse.errors.orders) ??
    (canUseTopicOrdersHint ? normalizeDnseReasonVi(effectiveOrdersTopic?.reason) : null) ??
    (canUseTopicOrdersHint ? normalizeDnseReasonVi(ordersEnvelope?.error?.message) : null) ??
    (needsRelogin
      ? "Phiên DNSE đã hết hạn nên chưa đọc được lệnh gần nhất."
      : null);

  const balanceDisplayHint =
    needsRelogin && !effectiveBalanceTopic?.totalNav
      ? "Phiên DNSE đã hết hạn. Vui lòng đăng nhập lại để đồng bộ tổng tài sản ròng và sức mua."
      : balanceHint;
  const holdingsDisplayHint =
    needsRelogin && holdings.length === 0
      ? "Phiên DNSE đã hết hạn nên hệ thống chưa thể đọc danh mục nắm giữ."
      : holdingsHint;
  const ordersDisplayHint =
    needsRelogin && !effectiveOrdersTopic?.orders?.length
      ? "Phiên DNSE đã hết hạn nên hệ thống chưa thể đọc lệnh gần nhất."
      : ordersHint;
  const loanPackagesDisplayHint = normalizeDnseReasonVi(directDnse.errors.loanPackages);

  const totalNavValue = useMemo(() => {
    const brokerNav = Number(effectiveBalanceTopic?.totalNav);
    return Number.isFinite(brokerNav) && brokerNav > 0 ? brokerNav : null;
  }, [effectiveBalanceTopic?.totalNav]);

  const buyingPowerValue = useMemo(() => {
    const brokerBuyingPower = Number(effectiveBalanceTopic?.buyingPower);
    return Number.isFinite(brokerBuyingPower) && brokerBuyingPower >= 0 ? brokerBuyingPower : null;
  }, [effectiveBalanceTopic?.buyingPower]);

  const directOrderLoanPackages = useMemo(
    () =>
      loanPackages.map((pkg) => ({
        loanPackageId: pkg.loanPackageId,
        loanPackageName: pkg.loanPackageName,
        interestRate: pkg.interestRate ?? null,
        maxLoanRatio: pkg.maxLoanRatio ?? null,
        isCash: false,
      })),
    [loanPackages],
  );

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
        const response = await fetch("/api/user/dnse", {
          cache: "no-store",
          credentials: "include",
        });
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

  useEffect(() => {
    if (statusLoading) return;
    void refreshDirectDnseData();
  }, [
    statusLoading,
    statusReloadKey,
    connectionStatus?.connection?.linked,
    connectionStatus?.connection?.accountId,
    connectionStatus?.connection?.accessTokenExpiresAt,
    normalizedTicker,
  ]);

  const isConnected = isLinkedAccount && (hasActiveDnseSession || hasBrokerData);
  const canTrade = isLinkedAccount && hasActiveDnseSession;
  const loginSuccessMessage = isLinkedAccount
    ? "Đăng nhập lại DNSE thành công. Hệ thống đang làm mới tổng tài sản ròng và danh mục."
    : "Đăng nhập DNSE thành công. Hãy bấm Liên kết tài khoản DNSE.";

  return (
    <div className={s.root}>
      <div className={s.shell}>
        <header className={s.header}>
          <div className={s.wordmark}>ADN <b>×</b> DNSE</div>
          <div className={s.headActions}>
            {!isLinkedAccount ? (
              <>
                <button type="button" onClick={() => setShowLoginModal(true)} className={s.pill} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LogIn className="h-3.5 w-3.5" /> Đăng nhập DNSE</button>
                <button type="button" onClick={() => setShowAccountSelector(true)} className={s.pill} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--primary-light)", color: "var(--primary)" }}><CheckCircle2 className="h-3.5 w-3.5" /> Liên kết</button>
              </>
            ) : null}
            {needsRelogin ? (
              <button type="button" onClick={() => setShowLoginModal(true)} className={s.pill} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--danger)" }}><LogIn className="h-3.5 w-3.5" /> Đăng nhập lại</button>
            ) : null}
            <button type="button" onClick={() => refreshDnseViews(true)} className={s.pill} aria-label="Làm mới dữ liệu"><RefreshCw className={`h-3.5 w-3.5 ${brokerTopics.isValidating || directDnse.loading ? "animate-spin" : ""}`} /></button>
          </div>
        </header>

        <div className={s.tabbar}>
          {[
            { key: "order" as const, label: "Đặt lệnh", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 17l5-5 4 4 8-8M21 8v5M21 8h-5" /></svg>) },
            { key: "portfolio" as const, label: "Danh mục", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="11" height="6" rx="1.5" /></svg>) },
            { key: "orders" as const, label: "Sổ lệnh & lịch sử", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h14M5 9h14M5 14h9M5 19h9" /></svg>) },
            { key: "auto" as const, label: "Tự động hóa", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6 6l1.5 1.5M16.5 16.5L18 18" /></svg>) },
          ].map((t) => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)} className={`${s.tab} ${activeTab === t.key ? s.tabOn : ""}`}>{t.icon}<span>{t.label}</span></button>
          ))}
        </div>

        <main className={s.work}>
          {activeTab === "order" ? (
            <>
              <div className={s.watch}>
                {holdings.slice(0, 14).map((h) => (
                  <button key={h.ticker} type="button" className={`${s.wchip} ${h.ticker === ticker ? s.wchipSel : ""}`} onClick={() => setTicker(h.ticker)}>
                    <span className={s.t}>{h.ticker}</span>
                    <span className={s.num} style={{ fontSize: 12, color: Number(h.pnlPercent ?? 0) >= 0 ? "var(--accent-fa)" : "var(--danger)" }}>{fmtPrice(h.currentPrice)}</span>
                  </button>
                ))}
                {holdings.length === 0 ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Nhập mã ở phiếu lệnh để bắt đầu.</span> : null}
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div className={s.eyebrow} style={{ marginBottom: 4 }}>Phiếu lệnh</div>
                <DirectOrderPanel
                  ticker={(ticker || "HPG").trim().toUpperCase()}
                  defaultPrice={queryEntryPrice ?? undefined}
                  defaultAccountId={selectedAccountId ?? undefined}
                  defaultSide={querySide}
                  source={querySource}
                  signalId={querySignalId}
                  navPct={queryNavPct ?? undefined}
                  initialTotalAsset={totalNavValue}
                  initialBuyingPower={buyingPowerValue}
                  initialLoanPackages={directOrderLoanPackages}
                  canTrade={canTrade}
                  onTickerChange={setTicker}
                  renderAuto={false}
                  onOrderSettled={() => refreshDnseViews(true)}
                />
              </div>
            </>
          ) : null}

          {activeTab === "portfolio" ? <div style={{ padding: "16px 18px" }}><HoldingsTable holdings={holdings} hint={holdingsDisplayHint} /></div> : null}

          {activeTab === "orders" ? (
            <div style={{ padding: "16px 18px", display: "grid", gap: 16 }}>
              <OrdersTable title="Lệnh trong ngày" orders={latestOrders} hint={ordersDisplayHint} />
              <OrdersTable title="Lịch sử lệnh" orders={orderHistory} hint={null} />
            </div>
          ) : null}

          {activeTab === "auto" ? <div style={{ padding: "16px 18px" }}><AutoRadarConfigPanel loanPackages={directOrderLoanPackages} /></div> : null}
        </main>

        <aside className={s.ctx}>
          <div className={s.cblock}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div className={s.eyebrow}>Tài khoản DNSE</div>
              <button type="button" onClick={() => setShowAccountSelector(true)} style={{ border: 0, background: "transparent", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Đổi tài khoản</button>
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span className={s.num} style={{ fontWeight: 700, fontSize: 15 }}>{selectedAccountId ?? "Chưa liên kết"}</span>
              <span className={s.chip} style={{ background: isConnected ? "var(--primary-light)" : "var(--surface-3)", color: isConnected ? "var(--primary)" : "var(--text-muted)" }}>{isConnected ? "Đã liên kết" : needsRelogin ? "Hết phiên" : "Chưa liên kết"}</span>
            </div>
            {connectionStatus?.connection?.accountName ? <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{connectionStatus.connection.accountName}</div> : null}
            {needsRelogin ? <button type="button" onClick={() => setShowLoginModal(true)} className={s.pill} style={{ marginTop: 10, color: "var(--danger)" }}>Đăng nhập lại DNSE</button> : null}
            {!isLinkedAccount && !statusLoading ? <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>Đăng nhập DNSE rồi liên kết tiểu khoản để đồng bộ tài sản và đặt lệnh.</p> : null}
          </div>

          <div className={s.cblock}>
            <div className={s.eyebrow}>Sức mua khả dụng</div>
            <div className={s.bpNum}>{buyingPowerValue != null ? `${Math.round(buyingPowerValue).toLocaleString("vi-VN")} ` : "-- "}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>đ</span></div>
            <div className={s.meter}><div className={s.meterFill} style={{ width: `${Math.min(100, Number(effectiveBalanceTopic?.navAllocatedPct ?? 0))}%` }} /><div className={s.meterNeedle} style={{ left: `${Math.min(100, Number(effectiveBalanceTopic?.navAllocatedPct ?? 0))}%` }} /></div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Đã dùng <b style={{ color: "var(--primary)" }}>{Number(effectiveBalanceTopic?.navAllocatedPct ?? 0).toFixed(1)}%</b> tỷ trọng · trần {Number(effectiveBalanceTopic?.maxActiveNavPct ?? 90).toFixed(0)}%</div>
            <div style={{ marginTop: 10 }}>
              <div className={s.kv}><span className={s.l}>Tài sản ròng</span><span className={s.v}>{totalNavValue != null ? Math.round(totalNavValue).toLocaleString("vi-VN") : "--"}</span></div>
              <div className={s.kv}><span className={s.l}>Tiền mặt</span><span className={s.v}>{effectiveBalanceTopic?.cash != null ? Math.round(Number(effectiveBalanceTopic.cash)).toLocaleString("vi-VN") : "--"}</span></div>
              <div className={s.kv}><span className={s.l}>Tỷ trọng còn lại</span><span className={s.v}>{Number(effectiveBalanceTopic?.navRemainingPct ?? 0).toFixed(1)}%</span></div>
            </div>
            {(!totalNavValue || !buyingPowerValue) && balanceDisplayHint ? <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 8, lineHeight: 1.5 }}>{balanceDisplayHint}</p> : null}
          </div>

          <div className={s.cblock}>
            <div className={s.eyebrow}>Phân bổ danh mục</div>
            {holdings.length ? (
              <>
                <div className={s.alloc}>
                  {holdings.slice(0, 6).map((h, idx) => (
                    <div key={h.ticker} style={{ width: `${Math.max(2, Number(h.navAllocation ?? 0))}%`, background: idx === 0 ? "var(--primary)" : idx === 1 ? "var(--accent-fa)" : "color-mix(in srgb,var(--accent-fa) 50%,var(--surface-3))" }} />
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  {holdings.slice(0, 5).map((h) => (
                    <div key={h.ticker} className={s.kv}><span className={s.l}>{h.ticker}</span><span className={s.v}>{h.navAllocation != null ? `${h.navAllocation.toFixed(1)}%` : "--"}</span></div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Chưa có dữ liệu danh mục.</p>
            )}
          </div>
        </aside>
      </div>

      {submitMessage || submitError ? (
        <div style={{ position: "fixed", left: 18, bottom: 16, zIndex: 60, maxWidth: 360 }}>
          {submitMessage ? <div className={s.card} style={{ padding: "10px 14px", fontSize: 12, color: "var(--primary)" }}>{submitMessage}</div> : null}
          {submitError ? <div className={s.card} style={{ padding: "10px 14px", fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{submitError}</div> : null}
        </div>
      ) : null}

      <DnseAccountSelector
        open={showAccountSelector}
        defaultAccountNo={selectedAccountId}
        onCancel={() => setShowAccountSelector(false)}
        onSuccess={(accountNo) => {
          setShowAccountSelector(false);
          setSubmitError(null);
          setSubmitMessage(`Đã liên kết tài khoản DNSE: ${accountNo}`);
          setStatusReloadKey((prev) => prev + 1);
          refreshDnseViews(true);
        }}
      />

      <DnseLoginModal
        open={showLoginModal}
        onCancel={() => setShowLoginModal(false)}
        onSuccess={() => {
          setShowLoginModal(false);
          setSubmitError(null);
          setSubmitMessage(loginSuccessMessage);
          setStatusReloadKey((prev) => prev + 1);
          refreshDnseViews(true);
        }}
      />
    </div>
  );
}
