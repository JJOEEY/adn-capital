export type DnseExecutionMode =
  | "APPROVED_PARTNER_FLOW_MODE"
  | "SAFE_EXECUTION_ADAPTER_MODE";

export type OrderIntentSource = "ai" | "manual" | "hybrid";
export type OrderSide = "BUY" | "SELL";
export type OrderType = "LO" | "ATO" | "ATC" | "MP" | "MOK" | "MAK" | "MTL";
export type TimeInForce = "DAY" | "GTC" | "IOC" | "FOK";

export interface OrderIntent {
  intentId: string;
  userId: string;
  accountId: string;
  ticker: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  price?: number | null;
  timeInForce?: TimeInForce | null;
  loanPackageId?: string | null;
  source: OrderIntentSource;
  rationale?: string | null;
  requestInsight?: boolean;
  metadata?: Record<string, unknown>;
}

export type ValidationStatus = "valid" | "invalid" | "needs_confirmation" | "blocked";

export interface OrderValidationResult {
  status: ValidationStatus;
  issues: string[];
  warnings: string[];
  normalizedIntent: OrderIntent;
  estimatedNotional?: number | null;
  estimatedFees?: number | null;
  requiresHumanConfirmation: boolean;
  deterministic: true;
}

export interface DnseExecutionRequest {
  accountNo: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  price?: number | null;
  quantity: number;
  loanPackageId?: string | null;
}

export type DnseExecutionStatus =
  | "accepted"
  | "rejected"
  | "degraded"
  | "blocked_not_enabled"
  | "approval_required"
  | "error";

export interface DnseExecutionResult {
  status: DnseExecutionStatus;
  brokerOrderId?: string | null;
  intentId: string;
  submittedAt?: string | null;
  result?: Record<string, unknown> | null;
  warnings: string[];
  errors: string[];
  source: "dnse" | "safe-adapter" | "manual-test-token" | "fallback";
  deterministic: true;
}

export interface OrderExecutionPreview {
  previewId: string;
  intent: OrderIntent;
  validation: OrderValidationResult;
  brokerPayloadPreview: DnseExecutionRequest;
  expiresAt: string;
}

export interface OrderTicket {
  intent: OrderIntent;
  validation: OrderValidationResult;
  preview: OrderExecutionPreview | null;
  riskFlags: string[];
  confirmationRequired: boolean;
}

export interface ParseIntentRequest {
  text?: string;
  intent?: Partial<OrderIntent>;
  source?: OrderIntentSource;
  requestInsight?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ParseIntentResponse {
  mode: DnseExecutionMode;
  intent: OrderIntent;
  validation: OrderValidationResult;
}
