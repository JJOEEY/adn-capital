import type {
  DnseExecutionRequest,
  DnseExecutionResult,
  OrderIntent,
  OrderValidationResult,
} from "@/types/dnse-execution";
import { getDnseExecutionFlags } from "./flags";

type JsonRecord = Record<string, unknown>;
const MANUAL_TEST_MODE_LOG_KEY = Symbol.for("__adn_dnse_manual_test_mode_logged__");

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

export async function submitOrderToDnse(args: {
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

  if (!flags.manualTestTokenMode) {
    return {
      status: "approval_required",
      intentId: args.intent.intentId,
      submittedAt: null,
      result: null,
      warnings: ["submit_disabled_until_compliance_approved_partner_flow"],
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
