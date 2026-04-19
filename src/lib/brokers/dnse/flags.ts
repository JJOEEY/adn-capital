import type { DnseExecutionMode } from "@/types/dnse-execution";

function toBool(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export type DnseExecutionFlags = {
  mode: DnseExecutionMode;
  intentEnabled: boolean;
  previewEnabled: boolean;
  realOrderSubmitEnabled: boolean;
  manualTestTokenMode: boolean;
  complianceApprovedFlow: boolean;
  configuredRealSubmitEnabled: boolean;
  configuredManualTestMode: boolean;
  allowRealSubmitInProd: boolean;
  allowManualTestInProd: boolean;
  isProductionRuntime: boolean;
  maxOrderNotional: number | null;
  replayCooldownMs: number;
  blockedReasons: string[];
};

export function getDnseExecutionFlags(): DnseExecutionFlags {
  const maxNotionalRaw = Number(process.env.DNSE_MAX_ORDER_NOTIONAL ?? "");
  const cooldownRaw = Number(process.env.DNSE_ORDER_REPLAY_COOLDOWN_MS ?? "");
  const modeRaw = (process.env.DNSE_EXECUTION_MODE ?? "").trim();
  const mode: DnseExecutionMode =
    modeRaw === "APPROVED_PARTNER_FLOW_MODE"
      ? "APPROVED_PARTNER_FLOW_MODE"
      : "SAFE_EXECUTION_ADAPTER_MODE";
  const isProductionRuntime = process.env.NODE_ENV === "production";
  const allowRealSubmitInProd = toBool(process.env.DNSE_ALLOW_REAL_SUBMIT_IN_PROD, false);
  const allowManualTestInProd = toBool(process.env.DNSE_ALLOW_MANUAL_TEST_IN_PROD, false);
  const complianceApprovedFlow = toBool(process.env.DNSE_COMPLIANCE_APPROVED_FLOW, false);
  const configuredRealSubmit = toBool(process.env.DNSE_REAL_ORDER_SUBMIT_ENABLED, false);
  const configuredManualMode = toBool(process.env.DNSE_MANUAL_TEST_TOKEN_MODE, false);
  const blockedReasons: string[] = [];

  if (configuredRealSubmit && !complianceApprovedFlow) {
    blockedReasons.push("real_submit_requires_compliance_approved_flow");
  }
  if (configuredRealSubmit && isProductionRuntime && !allowRealSubmitInProd) {
    blockedReasons.push("real_submit_blocked_in_production_without_explicit_override");
  }
  if (configuredManualMode && isProductionRuntime && !allowManualTestInProd) {
    blockedReasons.push("manual_test_token_mode_blocked_in_production_without_explicit_override");
  }

  return {
    mode,
    intentEnabled: toBool(process.env.DNSE_ORDER_INTENT_ENABLED, true),
    previewEnabled: toBool(process.env.DNSE_ORDER_PREVIEW_ENABLED, true),
    realOrderSubmitEnabled:
      configuredRealSubmit &&
      complianceApprovedFlow &&
      (!isProductionRuntime || allowRealSubmitInProd),
    manualTestTokenMode:
      configuredManualMode && (!isProductionRuntime || allowManualTestInProd),
    complianceApprovedFlow,
    configuredRealSubmitEnabled: configuredRealSubmit,
    configuredManualTestMode: configuredManualMode,
    allowRealSubmitInProd,
    allowManualTestInProd,
    isProductionRuntime,
    maxOrderNotional: Number.isFinite(maxNotionalRaw) && maxNotionalRaw > 0 ? maxNotionalRaw : null,
    replayCooldownMs: Number.isFinite(cooldownRaw) && cooldownRaw > 0 ? cooldownRaw : 12_000,
    blockedReasons,
  };
}
