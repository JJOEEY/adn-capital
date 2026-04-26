"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { PRODUCT_NAMES } from "@/lib/brand/productNames";

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

function hasFutureDate(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function normalizeDnseReason(reason: string | null | undefined) {
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
    return "Phiên DNSE đã hết hạn. Vui lòng bấm “Đăng nhập lại DNSE” để làm mới NAV và danh mục.";
  }

  if (/api key not found in storage|oa-401|oa-400/.test(lower)) {
    return "Máy chủ chưa lấy được dữ liệu fallback từ DNSE OpenAPI. Cần kiểm tra lại API key/secret.";
  }

  if (
    /token expired|authorization|unauthorized|forbidden|jwt|dnse_login_required|dnse_login_expired/.test(
      lower,
    )
  ) {
    return "Phiên DNSE đã hết hạn. Vui lòng bấm “Đăng nhập lại DNSE” để làm mới NAV và danh mục.";
  }

  if (/api key not found in storage|oa-401|oa-400/.test(lower)) {
    return "Máy chủ chưa lấy được dữ liệu fallback từ DNSE OpenAPI. Cần kiểm tra lại API key/secret.";
  }

  return normalized;
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
    return "Phiên DNSE đã hết hạn. Vui lòng bấm “Đăng nhập lại DNSE” để làm mới NAV và danh mục.";
  }

  if (/api key not found in storage|oa-401|oa-400/.test(lower)) {
    return "Máy chủ chưa lấy được dữ liệu fallback từ DNSE OpenAPI. Cần kiểm tra lại API key/secret.";
  }

  return normalized;
}

function isDnseLiveSource(source: string | null | undefined) {
  if (!source) return false;
  return /dnse_api|dnse_openapi|dnse_user_session/i.test(source);
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
          balanceResult.status === "rejected" ? balanceResult.reason?.message ?? "Không thể đọc NAV DNSE." : null,
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
      (isDnseLiveSource(balanceTopic?.source) ? balanceTopic : null))
    : (directDnse.resolved.balance
      ? directDnse.balance
      : (directDnse.balance ?? balanceTopic));
  const effectiveHoldingsTopic = strictLinkedMode
    ? directDnse.holdings
    : (directDnse.resolved.holdings
      ? directDnse.holdings
      : (directDnse.holdings ?? holdingsTopic ?? positionsTopic));
  const effectiveOrdersTopic = strictLinkedMode
    ? directDnse.orders
    : (directDnse.resolved.orders
      ? directDnse.orders
      : (directDnse.orders ?? ordersTopic));
  const effectiveLoanPackagesTopic = strictLinkedMode
    ? directDnse.loanPackages
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
      ? "Phiên DNSE đã hết hạn. Vui lòng đăng nhập lại để đồng bộ NAV và danh mục."
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
      ? "Phiên DNSE đã hết hạn. Vui lòng đăng nhập lại để đồng bộ NAV và sức mua."
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
    ? "Đăng nhập lại DNSE thành công. Hệ thống đang làm mới NAV và danh mục."
    : "Đăng nhập DNSE thành công. Hãy bấm Liên kết tài khoản DNSE.";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            {PRODUCT_NAMES.brokerConnect}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Kết nối tài khoản DNSE thật để đồng bộ NAV, danh mục nắm giữ và đặt lệnh trong pilot an toàn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isLinkedAccount ? (
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

          {needsRelogin ? (
            <button
              onClick={() => setShowLoginModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
              style={{
                borderColor: "rgba(245,158,11,0.25)",
                color: "#b45309",
                background: "rgba(245,158,11,0.10)",
              }}
            >
              <LogIn className="h-3.5 w-3.5" />
              Đăng nhập lại DNSE
            </button>
          ) : null}

          <button
            onClick={() => {
              refreshDnseViews(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "var(--surface)",
            }}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                brokerTopics.isValidating || directDnse.loading ? "animate-spin" : ""
              }`}
            />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <DnseAccountInfo
            loading={statusLoading}
            linked={isLinkedAccount}
            hasActiveSession={hasActiveDnseSession}
            needsRelogin={needsRelogin}
            accountId={selectedAccountId}
            accountName={connectionStatus?.connection?.accountName ?? null}
            subAccountId={connectionStatus?.connection?.subAccountId ?? null}
            sessionExpiresAt={connectionStatus?.auth?.sessionExpiresAt ?? null}
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
              refreshDnseViews(true);
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
                  {effectiveBalanceTopic?.buyingPower != null
                    ? `${Math.round(effectiveBalanceTopic.buyingPower).toLocaleString("vi-VN")} VND`
                    : "--"}
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                NAV đã phân bổ:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {Number(effectiveBalanceTopic?.navAllocatedPct ?? 0).toFixed(2)}%
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                NAV còn lại:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {Number(effectiveBalanceTopic?.navRemainingPct ?? 0).toFixed(2)}%
                </span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                Trần NAV active:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {Number(effectiveBalanceTopic?.maxActiveNavPct ?? 90).toFixed(0)}%
                </span>
              </p>
              {effectiveBalanceTopic?.reason ? (
                <p className="text-xs" style={{ color: "#f59e0b" }}>
                  Ghi chú: {effectiveBalanceTopic.reason}
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

          {(!hasNavData || !hasBuyingPowerData) && balanceDisplayHint ? (
            <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
              {balanceDisplayHint}
            </p>
          ) : null}

          {queryNavPct ? (
            <div
              className="mt-3 rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Tỷ trọng từ thẻ NexPilot: {queryNavPct.toFixed(2)}%
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
              Chưa có vị thế nắm giữ từ tài khoản DNSE đã liên kết.
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
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {holdings.length === 0 && holdingsDisplayHint ? (
            <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
              {holdingsDisplayHint}
            </p>
          ) : null}
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
          {latestOrders.length > 0 ? (
            <div className="space-y-2">
              {latestOrders.slice(0, 6).map((order, index) => (
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
              Chưa có lịch sử lệnh từ DNSE.
            </p>
          )}
          {latestOrders.length === 0 && ordersDisplayHint ? (
            <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
              {ordersDisplayHint}
            </p>
          ) : null}

          <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <h3
              className="mb-2 text-xs font-black uppercase tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              Gói vay khả dụng
            </h3>
            {loanPackages.length > 0 ? (
              <div className="space-y-2">
                {loanPackages.slice(0, 4).map((pkg) => (
                  <div
                    key={pkg.loanPackageId}
                    className="rounded-xl border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <p style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {pkg.loanPackageName}
                    </p>
                    <p style={{ color: "var(--text-secondary)" }}>
                      Mã: {pkg.loanPackageId}
                      {pkg.maxLoanRatio != null
                        ? ` · Tỷ lệ vay tối đa: ${Number(pkg.maxLoanRatio).toFixed(0)}%`
                        : ""}
                      {pkg.interestRate != null
                        ? ` · Lãi suất: ${Number(pkg.interestRate).toFixed(2)}%`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Chưa có dữ liệu gói vay từ DNSE.
              </p>
            )}
            {loanPackages.length === 0 && loanPackagesDisplayHint ? (
              <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
                {loanPackagesDisplayHint}
              </p>
            ) : null}
          </div>
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

        {!canTrade ? (
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

        {!canTrade && needsRelogin ? (
          <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
            Phiên DNSE đã hết hạn. Vui lòng đăng nhập lại trước khi kiểm tra NAV hoặc đặt lệnh.
          </p>
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
