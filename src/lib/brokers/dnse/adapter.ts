import type {
  DnseExecutionRequest,
  DnseExecutionResult,
  OrderIntent,
  OrderValidationResult,
} from "@/types/dnse-execution";
import { prisma } from "@/lib/prisma";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { getDnseExecutionFlags } from "./flags";
import { decryptDnseToken } from "./crypto";

type JsonRecord = Record<string, unknown>;
const MANUAL_TEST_MODE_LOG_KEY = Symbol.for("__adn_dnse_manual_test_mode_logged__");

type UserTradingAuthorization =
  | {
      ok: true;
      tradingToken: string;
      userJwtToken: string | null;
      expiresIn: number;
    }
  | { ok: false; reason: string };

function extractBrokerOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as JsonRecord;
  const value =
    row.orderId ??
    row.order_id ??
    row.id ??
    row.clientOrderId ??
    row.client_order_id ??
    null;
  return value == null ? null : String(value);
}

function toErrorText(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as JsonRecord;
  const value = row.error ?? row.message ?? row.detail ?? fallback;
  return String(value);
}

function normalizeId(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function secondsUntil(date: Date) {
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
}

function toBrokerError(error: unknown) {
  const message = error instanceof Error ? error.message : "DNSE submit unexpected error";
  const normalized = message.toLowerCase();
  if (normalized.includes("trading token") || normalized.includes("otp")) {
    return "trading_authorization_required";
  }
  if (
    normalized.includes("buying power") ||
    normalized.includes("cash") ||
    normalized.includes("suc mua") ||
    normalized.includes("sức mua")
  ) {
    return "insufficient_buying_power";
  }
  return message;
}

async function loadUserTradingAuthorization(args: {
  userId: string;
  accountId: string;
}): Promise<UserTradingAuthorization> {
  const [connection, authorization] = await Promise.all([
    prisma.dnseConnection.findUnique({
      where: { userId: args.userId },
      select: {
        accountId: true,
        subAccountId: true,
        status: true,
        accessTokenEnc: true,
        accessTokenExpiresAt: true,
      },
    }),
    prisma.dnseRadarAutoAuthorization.findUnique({
      where: { userId: args.userId },
      select: {
        accountId: true,
        status: true,
        tradingTokenEnc: true,
        expiresAt: true,
      },
    }),
  ]);

  if (!connection || connection.status !== "ACTIVE") {
    return { ok: false, reason: "dnse_connection_required" };
  }

  const requestedAccount = normalizeId(args.accountId);
  const linkedAccounts = [connection.accountId, connection.subAccountId]
    .map(normalizeId)
    .filter(Boolean);
  if (!requestedAccount || !linkedAccounts.includes(requestedAccount)) {
    return { ok: false, reason: "account_binding_mismatch" };
  }

  if (
    authorization?.status !== "ACTIVE" ||
    !authorization.tradingTokenEnc ||
    !authorization.expiresAt ||
    authorization.expiresAt.getTime() <= Date.now() + 30_000
  ) {
    return { ok: false, reason: "trading_authorization_required" };
  }

  const authorizedAccount = normalizeId(authorization.accountId);
  if (authorizedAccount && authorizedAccount !== requestedAccount) {
    return { ok: false, reason: "trading_authorization_account_mismatch" };
  }

  try {
    const tradingToken = decryptDnseToken(authorization.tradingTokenEnc);
    let userJwtToken: string | null = null;
    if (
      connection.accessTokenEnc &&
      (!connection.accessTokenExpiresAt || connection.accessTokenExpiresAt.getTime() > Date.now())
    ) {
      userJwtToken = decryptDnseToken(connection.accessTokenEnc);
    }
    return {
      ok: true,
      tradingToken,
      userJwtToken,
      expiresIn: Math.max(60, secondsUntil(authorization.expiresAt)),
    };
  } catch {
    return { ok: false, reason: "trading_authorization_unreadable" };
  }
}

async function submitWithUserAuthorization(args: {
  userId: string;
  intent: OrderIntent;
  validation: OrderValidationResult;
  now: string;
}): Promise<DnseExecutionResult | UserTradingAuthorization> {
  const authorization = await loadUserTradingAuthorization({
    userId: args.userId,
    accountId: args.intent.accountId,
  });
  if (!authorization.ok) return authorization;

  try {
    const client = getDnseTradingClient({
      userJwtToken: authorization.userJwtToken,
      isolated: true,
    });
    client.setTradingToken(authorization.tradingToken, authorization.expiresIn);
    const order = await client.placeOrder({
      accountNo: args.intent.accountId,
      symbol: args.intent.ticker,
      side: args.intent.side,
      orderType: args.intent.orderType,
      price: args.intent.price ?? undefined,
      quantity: args.intent.quantity,
      loanPackageId: args.intent.loanPackageId ?? undefined,
    });

    return {
      status: "accepted",
      brokerOrderId: order.orderId || null,
      intentId: args.intent.intentId,
      submittedAt: args.now,
      result: { orderId: order.orderId || null },
      warnings: args.validation.warnings,
      errors: [],
      source: "dnse",
      deterministic: true,
    };
  } catch (error) {
    const brokerError = toBrokerError(error);
    const rejected =
      brokerError === "trading_authorization_required" ||
      brokerError === "insufficient_buying_power" ||
      /(^|\D)(400|401|403|409|422)(\D|$)/.test(brokerError);
    return {
      status: rejected ? "rejected" : "error",
      intentId: args.intent.intentId,
      submittedAt: args.now,
      result: null,
      warnings: args.validation.warnings,
      errors: [brokerError],
      source: rejected ? "dnse" : "fallback",
      deterministic: true,
    };
  }
}

export async function submitOrderToDnse(args: {
  userId: string;
  intent: OrderIntent;
  brokerPayload: DnseExecutionRequest;
  validation: OrderValidationResult;
}): Promise<DnseExecutionResult> {
  const flags = getDnseExecutionFlags();
  const now = new Date().toISOString();

  if (!flags.realOrderSubmitEnabled) {
    if (flags.configuredRealSubmitEnabled && !flags.complianceApprovedFlow) {
      return {
        status: "approval_required",
        intentId: args.intent.intentId,
        submittedAt: null,
        result: null,
        warnings: ["DNSE_COMPLIANCE_APPROVED_FLOW=false"],
        errors: ["approval_required"],
        source: "safe-adapter",
        deterministic: true,
      };
    }
    return {
      status: "blocked_not_enabled",
      intentId: args.intent.intentId,
      submittedAt: null,
      result: null,
      warnings: flags.blockedReasons.length > 0 ? flags.blockedReasons : ["DNSE_REAL_ORDER_SUBMIT_ENABLED=false"],
      errors: [],
      source: "safe-adapter",
      deterministic: true,
    };
  }

  const userAuthorizedResult = await submitWithUserAuthorization({
    userId: args.userId,
    intent: args.intent,
    validation: args.validation,
    now,
  });
  if ("status" in userAuthorizedResult) {
    return userAuthorizedResult;
  }

  if (!flags.manualTestTokenMode) {
    const approvalWarning =
      "reason" in userAuthorizedResult ? userAuthorizedResult.reason : "DNSE_MANUAL_TEST_TOKEN_MODE=false";
    return {
      status: "approval_required",
      intentId: args.intent.intentId,
      submittedAt: null,
      result: null,
      warnings: [approvalWarning],
      errors: ["approval_required"],
      source: "safe-adapter",
      deterministic: true,
    };
  }

  const root = globalThis as unknown as Record<string | symbol, unknown>;
  if (!root[MANUAL_TEST_MODE_LOG_KEY]) {
    root[MANUAL_TEST_MODE_LOG_KEY] = true;
    console.warn(
      "[DNSE_EXECUTION] Manual test token mode is active. This mode is staging-only and must remain OFF in production by default.",
    );
  }

  const submitUrl = process.env.DNSE_ORDER_SUBMIT_URL?.trim() || "";
  const jwtToken = process.env.DNSE_MANUAL_TEST_JWT_TOKEN?.trim() || "";
  const tradingToken = process.env.DNSE_MANUAL_TEST_TRADING_TOKEN?.trim() || "";
  if (!submitUrl || !jwtToken || !tradingToken) {
    return {
      status: "approval_required",
      intentId: args.intent.intentId,
      submittedAt: null,
      result: null,
      warnings: ["manual_test_token_mode_missing_env"],
      errors: ["approval_required"],
      source: "manual-test-token",
      deterministic: true,
    };
  }

  try {
    const response = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
        "Trading-Token": tradingToken,
      },
      body: JSON.stringify(args.brokerPayload),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (response.ok) {
      return {
        status: "accepted",
        brokerOrderId: extractBrokerOrderId(payload),
        intentId: args.intent.intentId,
        submittedAt: now,
        result: payload && typeof payload === "object" ? (payload as JsonRecord) : { ok: true },
        warnings: args.validation.warnings,
        errors: [],
        source: "dnse",
        deterministic: true,
      };
    }

    return {
      status: "rejected",
      brokerOrderId: extractBrokerOrderId(payload),
      intentId: args.intent.intentId,
      submittedAt: now,
      result: payload && typeof payload === "object" ? (payload as JsonRecord) : null,
      warnings: args.validation.warnings,
      errors: [toErrorText(payload, `DNSE submit failed with HTTP ${response.status}`)],
      source: "dnse",
      deterministic: true,
    };
  } catch (error) {
    return {
      status: "error",
      intentId: args.intent.intentId,
      submittedAt: now,
      result: null,
      warnings: args.validation.warnings,
      errors: [error instanceof Error ? error.message : "DNSE submit unexpected error"],
      source: "fallback",
      deterministic: true,
    };
  }
}

export type DnseOrderSnapshot = {
  intentId: string;
  previewId?: string | null;
  accountId: string;
  ticker: string;
  side: string;
  quantity: number;
  orderType: string;
  price: number | null;
  status: string;
  brokerOrderId: string | null;
  warnings: string[];
  errors: string[];
  submittedAt: string | null;
  source: string;
};

export function toOrderSnapshot(args: {
  intent: OrderIntent;
  result: DnseExecutionResult;
  previewId?: string | null;
}): DnseOrderSnapshot {
  return {
    intentId: args.intent.intentId,
    previewId: args.previewId ?? null,
    accountId: args.intent.accountId,
    ticker: args.intent.ticker,
    side: args.intent.side,
    quantity: args.intent.quantity,
    orderType: args.intent.orderType,
    price: args.intent.price ?? null,
    status: args.result.status,
    brokerOrderId: args.result.brokerOrderId ?? null,
    warnings: args.result.warnings,
    errors: args.result.errors,
    submittedAt: args.result.submittedAt ?? null,
    source: args.result.source,
  };
}
