import { PrismaClient } from "@prisma/client";

function isTruthy(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function isPostgresUrl(value) {
  if (!value) return false;
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

function parseList(value) {
  return String(value ?? "")
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const env = process.env;
  const checks = {
    DATABASE_URL: isPostgresUrl(env.DATABASE_URL),
    DIRECT_DATABASE_URL: isPostgresUrl(env.DIRECT_DATABASE_URL),
    NEXTAUTH_URL: Boolean(env.NEXTAUTH_URL),
    NEXTAUTH_SECRET: Boolean(env.NEXTAUTH_SECRET || env.AUTH_SECRET),
    AUTH_TRUST_HOST: isTruthy(env.AUTH_TRUST_HOST, false),
    DNSE_API_KEY: Boolean(env.DNSE_API_KEY),
    DNSE_EXECUTION_MODE_SAFE:
      (env.DNSE_EXECUTION_MODE || "SAFE_EXECUTION_ADAPTER_MODE").trim() === "SAFE_EXECUTION_ADAPTER_MODE",
    DNSE_REAL_ORDER_SUBMIT_DISABLED: !isTruthy(env.DNSE_REAL_ORDER_SUBMIT_ENABLED, false),
    DNSE_COMPLIANCE_APPROVED_FLOW_DISABLED: !isTruthy(env.DNSE_COMPLIANCE_APPROVED_FLOW, false),
    DNSE_ALLOW_REAL_SUBMIT_IN_PROD_DISABLED: !isTruthy(env.DNSE_ALLOW_REAL_SUBMIT_IN_PROD, false),
    DNSE_ALLOW_MANUAL_TEST_IN_PROD_DISABLED: !isTruthy(env.DNSE_ALLOW_MANUAL_TEST_IN_PROD, false),
    DNSE_KILL_SWITCH_DISABLED: !isTruthy(env.DNSE_EXECUTION_KILL_SWITCH, false),
    DNSE_ALLOWLIST_ENFORCED: isTruthy(env.DNSE_EXECUTION_ALLOWLIST_ENFORCED, true),
    DNSE_MARKET_SESSION_GUARD_ENABLED: isTruthy(env.DNSE_ENFORCE_MARKET_SESSION_GUARD, true),
    DNSE_DUPLICATE_SUBMIT_WINDOW_VALID:
      Number.isFinite(Number(env.DNSE_DUPLICATE_SUBMIT_WINDOW_MS ?? "")) &&
      Number(env.DNSE_DUPLICATE_SUBMIT_WINDOW_MS ?? "") > 0,
  };

  const blockers = [];
  const warnings = [];
  if (!checks.DATABASE_URL) blockers.push("missing_or_invalid_DATABASE_URL");
  if (!checks.DIRECT_DATABASE_URL) blockers.push("missing_or_invalid_DIRECT_DATABASE_URL");
  if (!checks.NEXTAUTH_URL) blockers.push("missing_NEXTAUTH_URL");
  if (!checks.NEXTAUTH_SECRET) blockers.push("missing_NEXTAUTH_SECRET_or_AUTH_SECRET");
  if (!checks.AUTH_TRUST_HOST) blockers.push("AUTH_TRUST_HOST_should_be_true_for_staging_proxy_runtime");
  if (!checks.DNSE_API_KEY) warnings.push("missing_DNSE_API_KEY");
  if (!checks.DNSE_EXECUTION_MODE_SAFE) blockers.push("DNSE_EXECUTION_MODE_is_not_SAFE_EXECUTION_ADAPTER_MODE");
  if (!checks.DNSE_REAL_ORDER_SUBMIT_DISABLED) blockers.push("DNSE_REAL_ORDER_SUBMIT_ENABLED_must_be_false");
  if (!checks.DNSE_COMPLIANCE_APPROVED_FLOW_DISABLED) blockers.push("DNSE_COMPLIANCE_APPROVED_FLOW_must_be_false_by_default");
  if (!checks.DNSE_ALLOW_REAL_SUBMIT_IN_PROD_DISABLED) blockers.push("DNSE_ALLOW_REAL_SUBMIT_IN_PROD_must_be_false");
  if (!checks.DNSE_ALLOW_MANUAL_TEST_IN_PROD_DISABLED) blockers.push("DNSE_ALLOW_MANUAL_TEST_IN_PROD_must_be_false");
  if (!checks.DNSE_KILL_SWITCH_DISABLED) blockers.push("DNSE_EXECUTION_KILL_SWITCH_must_be_false_for_pilot_verification");
  if (!checks.DNSE_DUPLICATE_SUBMIT_WINDOW_VALID) blockers.push("DNSE_DUPLICATE_SUBMIT_WINDOW_MS_invalid");

  const envAllowlist = {
    userIds: parseList(env.DNSE_EXECUTION_ALLOWLIST_USER_IDS),
    accountIds: parseList(env.DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS),
    emails: parseList(env.DNSE_EXECUTION_ALLOWLIST_EMAILS),
  };

  let dbReachable = false;
  let dnseLinkedUserCount = 0;
  let adminUserCount = 0;
  let dbError = null;
  let dbSettings = {
    DNSE_EXECUTION_KILL_SWITCH: "false",
    DNSE_EXECUTION_ALLOWLIST_ENFORCED: checks.DNSE_ALLOWLIST_ENFORCED ? "true" : "false",
    DNSE_EXECUTION_ALLOWLIST_USER_IDS: "",
    DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS: "",
    DNSE_EXECUTION_ALLOWLIST_EMAILS: "",
  };

  if (checks.DATABASE_URL && checks.DIRECT_DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReachable = true;
      dnseLinkedUserCount = await prisma.user.count({
        where: { dnseVerified: true, dnseId: { not: null } },
      });
      adminUserCount = await prisma.user.count({
        where: { systemRole: "ADMIN" },
      });
      const settingsRows = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: Object.keys(dbSettings),
          },
        },
        select: { key: true, value: true },
      });
      for (const row of settingsRows) {
        dbSettings[row.key] = row.value;
      }
    } catch (error) {
      dbError = error instanceof Error ? error.message : String(error);
      blockers.push("database_connection_failed");
    } finally {
      await prisma.$disconnect();
    }
  }

  const mergedAllowlistEnforced = isTruthy(
    dbSettings.DNSE_EXECUTION_ALLOWLIST_ENFORCED,
    checks.DNSE_ALLOWLIST_ENFORCED,
  );
  const mergedKillSwitch =
    isTruthy(env.DNSE_EXECUTION_KILL_SWITCH, false) ||
    isTruthy(dbSettings.DNSE_EXECUTION_KILL_SWITCH, false);
  const mergedAllowlist = {
    userIds: Array.from(new Set([...envAllowlist.userIds, ...parseList(dbSettings.DNSE_EXECUTION_ALLOWLIST_USER_IDS)])),
    accountIds: Array.from(
      new Set([...envAllowlist.accountIds, ...parseList(dbSettings.DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS)]),
    ),
    emails: Array.from(new Set([...envAllowlist.emails, ...parseList(dbSettings.DNSE_EXECUTION_ALLOWLIST_EMAILS)])),
  };
  const mergedAllowlistCount =
    mergedAllowlist.userIds.length + mergedAllowlist.accountIds.length + mergedAllowlist.emails.length;

  if (mergedKillSwitch) blockers.push("execution_kill_switch_enabled");
  if (mergedAllowlistEnforced && mergedAllowlistCount === 0) blockers.push("pilot_allowlist_empty");
  if (dbReachable && dnseLinkedUserCount <= 0) blockers.push("no_dnse_linked_account_for_topic_hydration");
  if (dbReachable && adminUserCount <= 0) blockers.push("no_admin_user_found");

  const requirements = {
    appHealth: {
      required: ["DATABASE_URL(postgres)", "DIRECT_DATABASE_URL(postgres)"],
      pass: checks.DATABASE_URL && checks.DIRECT_DATABASE_URL && dbReachable,
    },
    authSession: {
      required: ["NEXTAUTH_URL", "NEXTAUTH_SECRET/AUTH_SECRET", "AUTH_TRUST_HOST=true"],
      pass: checks.NEXTAUTH_URL && checks.NEXTAUTH_SECRET && checks.AUTH_TRUST_HOST,
      notes: "user/admin session cookies are required for protected execution routes",
    },
    brokerTopicHydration: {
      required: ["db reachable", ">=1 dnse linked user"],
      pass: dbReachable && dnseLinkedUserCount > 0,
    },
    controlledPilotGuards: {
      required: [
        "DNSE_EXECUTION_ALLOWLIST_ENFORCED=true",
        "allowlist has >=1 identity",
        "kill switch disabled",
      ],
      pass: mergedAllowlistEnforced && mergedAllowlistCount > 0 && !mergedKillSwitch,
    },
    executionSafeMode: {
      required: [
        "DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE",
        "DNSE_REAL_ORDER_SUBMIT_ENABLED=false",
        "DNSE_COMPLIANCE_APPROVED_FLOW=false",
        "DNSE_ALLOW_REAL_SUBMIT_IN_PROD=false",
        "DNSE_ALLOW_MANUAL_TEST_IN_PROD=false",
      ],
      pass:
        checks.DNSE_EXECUTION_MODE_SAFE &&
        checks.DNSE_REAL_ORDER_SUBMIT_DISABLED &&
        checks.DNSE_COMPLIANCE_APPROVED_FLOW_DISABLED &&
        checks.DNSE_ALLOW_REAL_SUBMIT_IN_PROD_DISABLED &&
        checks.DNSE_ALLOW_MANUAL_TEST_IN_PROD_DISABLED,
    },
    executionSafety: {
      required: [
        "DNSE_ENFORCE_MARKET_SESSION_GUARD=true",
        "DNSE_DUPLICATE_SUBMIT_WINDOW_MS>0",
      ],
      pass:
        checks.DNSE_MARKET_SESSION_GUARD_ENABLED &&
        checks.DNSE_DUPLICATE_SUBMIT_WINDOW_VALID,
    },
  };

  const payload = {
    timestamp: new Date().toISOString(),
    checks,
    db: {
      reachable: dbReachable,
      error: dbError,
      dnseLinkedUserCount,
      adminUserCount,
      settings: dbSettings,
    },
    rollout: {
      allowlistEnforced: mergedAllowlistEnforced,
      allowlistCount: mergedAllowlistCount,
      allowlist: mergedAllowlist,
      killSwitchEnabled: mergedKillSwitch,
    },
    sessionRequirements: {
      adminSessionRequired: true,
      userSessionRequired: true,
      dnseLinkedAccountRequired: true,
    },
    requirements,
    blockers,
    warnings,
    ready: blockers.length === 0,
  };

  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ready) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ready: false,
        fatal: true,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
});
