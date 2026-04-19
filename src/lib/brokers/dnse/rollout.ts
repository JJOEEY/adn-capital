import { getSetting } from "@/lib/settings";
import { getDnseExecutionFlags } from "./flags";

type AllowlistMatchBy = "userId" | "accountId" | "email";

function toBool(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function normalizeList(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSet(values: string[], lowerCase = false) {
  const set = new Set<string>();
  for (const value of values) {
    set.add(lowerCase ? value.toLowerCase() : value);
  }
  return set;
}

export type DnseExecutionRolloutSnapshot = {
  mode: string;
  complianceApprovedFlow: boolean;
  realSubmitEnabled: boolean;
  allowlistEnforced: boolean;
  allowlistMatched: boolean;
  allowlistMatchBy: AllowlistMatchBy | null;
  allowlistCounts: {
    userIds: number;
    accountIds: number;
    emails: number;
  };
  allowlistEmpty: boolean;
  killSwitchEnabled: boolean;
  killSwitchReason: string | null;
  pilotEligible: boolean;
  blockedReasons: string[];
};

export type DnseRolloutIdentity = {
  userId: string;
  email?: string | null;
  accountId?: string | null;
};

export async function getDnseExecutionRolloutSnapshot(identity: DnseRolloutIdentity): Promise<DnseExecutionRolloutSnapshot> {
  const flags = getDnseExecutionFlags();
  const envAllowlistEnforced = toBool(process.env.DNSE_EXECUTION_ALLOWLIST_ENFORCED, true);
  const dbAllowlistEnforcedRaw = await getSetting(
    "DNSE_EXECUTION_ALLOWLIST_ENFORCED",
    envAllowlistEnforced ? "true" : "false",
  );
  const allowlistEnforced = toBool(dbAllowlistEnforcedRaw, envAllowlistEnforced);

  const envUserIds = normalizeList(process.env.DNSE_EXECUTION_ALLOWLIST_USER_IDS);
  const envAccountIds = normalizeList(process.env.DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS);
  const envEmails = normalizeList(process.env.DNSE_EXECUTION_ALLOWLIST_EMAILS);

  const dbUserIds = normalizeList(await getSetting("DNSE_EXECUTION_ALLOWLIST_USER_IDS", ""));
  const dbAccountIds = normalizeList(await getSetting("DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", ""));
  const dbEmails = normalizeList(await getSetting("DNSE_EXECUTION_ALLOWLIST_EMAILS", ""));

  const userIdSet = toSet([...envUserIds, ...dbUserIds]);
  const accountIdSet = toSet([...envAccountIds, ...dbAccountIds]);
  const emailSet = toSet([...envEmails, ...dbEmails], true);

  const normalizedUserId = identity.userId.trim();
  const normalizedAccountId = (identity.accountId ?? "").trim();
  const normalizedEmail = (identity.email ?? "").trim().toLowerCase();

  let allowlistMatchBy: AllowlistMatchBy | null = null;
  if (normalizedUserId && userIdSet.has(normalizedUserId)) {
    allowlistMatchBy = "userId";
  } else if (normalizedAccountId && accountIdSet.has(normalizedAccountId)) {
    allowlistMatchBy = "accountId";
  } else if (normalizedEmail && emailSet.has(normalizedEmail)) {
    allowlistMatchBy = "email";
  }

  const allowlistMatched = allowlistMatchBy != null;
  const allowlistCounts = {
    userIds: userIdSet.size,
    accountIds: accountIdSet.size,
    emails: emailSet.size,
  };
  const allowlistEmpty =
    allowlistCounts.userIds + allowlistCounts.accountIds + allowlistCounts.emails === 0;

  const envKillSwitch = toBool(process.env.DNSE_EXECUTION_KILL_SWITCH, false);
  const dbKillSwitchRaw = await getSetting(
    "DNSE_EXECUTION_KILL_SWITCH",
    envKillSwitch ? "true" : "false",
  );
  const killSwitchEnabled = envKillSwitch || toBool(dbKillSwitchRaw, false);
  const killSwitchReasonRaw = await getSetting(
    "DNSE_EXECUTION_KILL_SWITCH_REASON",
    process.env.DNSE_EXECUTION_KILL_SWITCH_REASON ?? "",
  );
  const killSwitchReason = killSwitchEnabled
    ? (killSwitchReasonRaw.trim() || "execution_kill_switch_enabled")
    : null;

  const blockedReasons: string[] = [];
  if (killSwitchEnabled) blockedReasons.push("execution_kill_switch_enabled");
  if (allowlistEnforced && allowlistEmpty) blockedReasons.push("pilot_allowlist_empty");
  if (allowlistEnforced && !allowlistMatched) blockedReasons.push("pilot_allowlist_required");
  if (flags.configuredRealSubmitEnabled && !flags.complianceApprovedFlow) {
    blockedReasons.push("compliance_approval_required_for_real_submit");
  }

  const pilotEligible = !killSwitchEnabled && (!allowlistEnforced || allowlistMatched);

  return {
    mode: flags.mode,
    complianceApprovedFlow: flags.complianceApprovedFlow,
    realSubmitEnabled: flags.realOrderSubmitEnabled,
    allowlistEnforced,
    allowlistMatched,
    allowlistMatchBy,
    allowlistCounts,
    allowlistEmpty,
    killSwitchEnabled,
    killSwitchReason,
    pilotEligible,
    blockedReasons,
  };
}
