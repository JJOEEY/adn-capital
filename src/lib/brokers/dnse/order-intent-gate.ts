import { isVnTradingDay, isWithinVnTradingSession } from "@/lib/time";
import { normalizeTickerInput, resolveMarketTicker } from "@/lib/ticker-resolver";
import type {
  DnseExecutionRequest,
  OrderIntent,
  OrderIntentSource,
  OrderType,
  OrderValidationResult,
} from "@/types/dnse-execution";

const DEFAULT_ORDER_TYPE: OrderType = "LO";
const SUPPORTED_ORDER_TYPES = new Set<OrderType>(["LO", "ATO", "ATC", "MP", "MOK", "MAK", "MTL"]);
const SIDE_MAP: Array<{ regex: RegExp; side: "BUY" | "SELL" }> = [
  { regex: /\b(BUY|MUA|LONG)\b/i, side: "BUY" },
  { regex: /\b(SELL|BAN|SHORT)\b/i, side: "SELL" },
];

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function inferSide(text: string): "BUY" | "SELL" | null {
  for (const item of SIDE_MAP) {
    if (item.regex.test(text)) return item.side;
  }
  return null;
}

function inferQuantity(text: string): number | null {
  const match =
    text.match(/\b(?:qty|quantity|kl|khoi luong|so luong)\s*[:=]?\s*(\d{1,8})\b/i) ??
    text.match(/\b(\d{1,8})\s*(?:cp|shares?)\b/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function inferPrice(text: string): number | null {
  const explicit =
    text.match(/\b(?:price|gia|entry)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\b/i) ??
    text.match(/@\s*(\d+(?:[.,]\d+)?)/);
  if (!explicit) return null;
  const normalized = explicit[1].replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inferOrderType(text: string): OrderType | null {
  const match = text.match(/\b(LO|ATO|ATC|MP|MOK|MAK|MTL)\b/i);
  if (!match) return null;
  const orderType = match[1].toUpperCase() as OrderType;
  return SUPPORTED_ORDER_TYPES.has(orderType) ? orderType : null;
}

function inferTicker(text: string): string | null {
  const all = text.toUpperCase().match(/\b[A-Z]{2,5}\b/g) ?? [];
  if (all.length === 0) return null;
  const blacklist = new Set(["MUA", "BAN", "BUY", "SELL", "LONG", "SHORT", "ATO", "ATC", "LO", "MP"]);
  const candidate = all.find((token) => !blacklist.has(token)) ?? null;
  return candidate;
}

export type ParseIntentInput = {
  text?: string;
  partial?: Partial<OrderIntent>;
  source?: OrderIntentSource;
  userId: string;
  accountId?: string | null;
  requestInsight?: boolean;
  metadata?: Record<string, unknown>;
};

export function parseOrderIntentDraft(input: ParseIntentInput): OrderIntent {
  const text = (input.text ?? "").trim();
  const partial = input.partial ?? {};
  const ticker = normalizeTickerInput(
    String(partial.ticker ?? inferTicker(text) ?? ""),
  );
  const side =
    (typeof partial.side === "string" ? partial.side.toUpperCase() : inferSide(text)) === "SELL"
      ? "SELL"
      : "BUY";
  const quantity = Math.max(
    0,
    Math.trunc(
      toFiniteNumber(partial.quantity) ??
        inferQuantity(text) ??
        0,
    ),
  );
  const orderTypeRaw =
    typeof partial.orderType === "string"
      ? partial.orderType.toUpperCase()
      : inferOrderType(text) ?? DEFAULT_ORDER_TYPE;
  const orderType = (SUPPORTED_ORDER_TYPES.has(orderTypeRaw as OrderType)
    ? (orderTypeRaw as OrderType)
    : DEFAULT_ORDER_TYPE);
  const price = toFiniteNumber(partial.price) ?? inferPrice(text);
  const accountId = (partial.accountId ?? input.accountId ?? "").toString().trim();

  return {
    intentId: `intent_${crypto.randomUUID()}`,
    userId: input.userId,
    accountId,
    ticker,
    side,
    quantity,
    orderType,
    price,
    timeInForce:
      partial.timeInForce && ["DAY", "GTC", "IOC", "FOK"].includes(String(partial.timeInForce))
        ? (partial.timeInForce as OrderIntent["timeInForce"])
        : "DAY",
    loanPackageId: partial.loanPackageId?.toString().trim() || null,
    source: input.source ?? (text ? "ai" : "manual"),
    rationale: partial.rationale?.toString().trim() || text || null,
    requestInsight: Boolean(partial.requestInsight ?? input.requestInsight ?? false),
    metadata: { ...(partial.metadata ?? {}), ...(input.metadata ?? {}) },
  };
}

export type ValidationContext = {
  approvedAccountId?: string | null;
  dnseVerified?: boolean;
  maxOrderNotional?: number | null;
  enforceTradingSession?: boolean;
};

function estimateFees(notional: number | null) {
  if (notional == null) return null;
  const brokerageFee = notional * 0.0015;
  return Number(brokerageFee.toFixed(2));
}

export async function validateOrderIntent(
  intentDraft: OrderIntent,
  context: ValidationContext = {},
): Promise<OrderValidationResult> {
  const issues: string[] = [];
  const warnings: string[] = [];
  const normalizedIntent: OrderIntent = {
    ...intentDraft,
    ticker: normalizeTickerInput(intentDraft.ticker),
    accountId: intentDraft.accountId.trim(),
    quantity: Math.trunc(intentDraft.quantity),
    orderType: SUPPORTED_ORDER_TYPES.has(intentDraft.orderType) ? intentDraft.orderType : DEFAULT_ORDER_TYPE,
    price: intentDraft.price == null ? null : Number(intentDraft.price),
  };

  if (!normalizedIntent.accountId) issues.push("missing_account_id");
  if (!normalizedIntent.ticker) issues.push("missing_ticker");
  if (!Number.isInteger(normalizedIntent.quantity) || normalizedIntent.quantity <= 0) {
    issues.push("invalid_quantity");
  }
  if (!SUPPORTED_ORDER_TYPES.has(normalizedIntent.orderType)) issues.push("invalid_order_type");
  if (normalizedIntent.orderType === "LO" && (!normalizedIntent.price || normalizedIntent.price <= 0)) {
    issues.push("price_required_for_lo");
  }
  if (normalizedIntent.price != null && normalizedIntent.price <= 0) issues.push("invalid_price");

  if (context.approvedAccountId && normalizedIntent.accountId !== context.approvedAccountId) {
    issues.push("account_not_allowed");
  }
  if (context.dnseVerified === false) {
    issues.push("dnse_connection_not_verified");
  }

  if (normalizedIntent.ticker) {
    try {
      const resolved = await resolveMarketTicker(normalizedIntent.ticker);
      if (!resolved.valid) issues.push("ticker_not_in_market_universe");
      if (resolved.valid && resolved.ticker !== normalizedIntent.ticker) {
        warnings.push(`ticker_normalized:${resolved.ticker}`);
        normalizedIntent.ticker = resolved.ticker;
      }
    } catch {
      warnings.push("ticker_validation_source_unavailable");
    }
  }

  const estimatedNotional =
    normalizedIntent.price != null && normalizedIntent.quantity > 0
      ? Number((normalizedIntent.price * normalizedIntent.quantity).toFixed(2))
      : null;

  if (context.maxOrderNotional != null && estimatedNotional != null && estimatedNotional > context.maxOrderNotional) {
    issues.push("max_notional_exceeded");
  }
  if (estimatedNotional == null) {
    warnings.push("estimated_notional_unavailable");
  }

  const enforceTradingSession = context.enforceTradingSession ?? true;
  if (enforceTradingSession) {
    if (!isVnTradingDay()) {
      warnings.push("outside_trading_day");
    } else if (!isWithinVnTradingSession()) {
      warnings.push("outside_trading_session");
    }
  }

  const estimatedFees = estimateFees(estimatedNotional);
  const requiresHumanConfirmation = true;
  let status: OrderValidationResult["status"] = "valid";

  if (issues.length > 0) {
    const hardBlockers = new Set([
      "missing_account_id",
      "missing_ticker",
      "invalid_quantity",
      "price_required_for_lo",
      "invalid_price",
      "ticker_not_in_market_universe",
      "account_not_allowed",
      "dnse_connection_not_verified",
      "max_notional_exceeded",
    ]);
    const hasHardBlocker = issues.some((issue) => hardBlockers.has(issue));
    status = hasHardBlocker ? "blocked" : "invalid";
  } else if (warnings.length > 0) {
    status = "needs_confirmation";
  }

  return {
    status,
    issues,
    warnings,
    normalizedIntent,
    estimatedNotional,
    estimatedFees,
    requiresHumanConfirmation,
    deterministic: true,
  };
}

export function buildDnseExecutionRequest(intent: OrderIntent): DnseExecutionRequest {
  return {
    accountNo: intent.accountId,
    symbol: intent.ticker,
    side: intent.side,
    orderType: intent.orderType,
    price: intent.price ?? null,
    quantity: intent.quantity,
    loanPackageId: intent.loanPackageId ?? null,
  };
}
