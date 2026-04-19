import { PrismaClient } from "@prisma/client";

function isPostgresUrl(value) {
  if (!value) return false;
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

function boolEnv(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function classify(name, required, ok, detail = null) {
  return { name, required, ok, detail };
}

async function checkInternalTriggerAuth(baseUrl, internalKey) {
  if (!baseUrl || !internalKey) {
    return classify("internal_trigger_auth", true, false, "missing_base_url_or_internal_key");
  }
  try {
    const response = await fetch(`${baseUrl}/api/internal/workflows/trigger`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({
        type: "invalid_type_for_auth_probe",
        source: "phase6-readiness-probe",
        payload: {},
      }),
      cache: "no-store",
    });

    if (response.status === 401) {
      return classify("internal_trigger_auth", true, false, "auth_rejected");
    }
    if (response.status === 400) {
      return classify("internal_trigger_auth", true, true, "auth_ok_shape_rejected_expected");
    }
    if (response.ok) {
      return classify("internal_trigger_auth", true, true, "auth_ok_request_accepted");
    }
    return classify("internal_trigger_auth", true, false, `unexpected_http_${response.status}`);
  } catch (error) {
    return classify(
      "internal_trigger_auth",
      true,
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkAdminRouteProtection(baseUrl) {
  if (!baseUrl) {
    return classify("admin_route_access", false, false, "base_url_missing");
  }
  try {
    const response = await fetch(`${baseUrl}/api/admin/system/workflows`, {
      method: "GET",
      cache: "no-store",
    });
    if (response.status === 401) {
      return classify("admin_route_access", false, true, "auth_required_expected");
    }
    if (response.ok) {
      return classify("admin_route_access", false, true, "admin_session_present_or_proxy_auth");
    }
    return classify("admin_route_access", false, false, `unexpected_http_${response.status}`);
  } catch (error) {
    return classify(
      "admin_route_access",
      false,
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkDatabaseAndCronLog(prisma) {
  const checks = [];
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push(classify("database_connection", true, true, "select_1_ok"));
  } catch (error) {
    checks.push(
      classify(
        "database_connection",
        true,
        false,
        error instanceof Error ? error.message : String(error),
      ),
    );
    return checks;
  }

  const probeName = `workflow:readiness_probe_${Date.now()}`;
  let createdId = null;
  try {
    const row = await prisma.cronLog.create({
      data: {
        cronName: probeName,
        status: "success",
        message: "phase6 readiness probe",
        duration: 0,
        resultData: JSON.stringify({ probe: true, at: new Date().toISOString() }),
      },
      select: { id: true },
    });
    createdId = row.id;
    checks.push(classify("cronlog_write", true, true, "create_ok"));
  } catch (error) {
    checks.push(
      classify(
        "cronlog_write",
        true,
        false,
        error instanceof Error ? error.message : String(error),
      ),
    );
  } finally {
    if (createdId) {
      await prisma.cronLog.delete({ where: { id: createdId } }).catch(() => null);
    }
  }
  return checks;
}

async function main() {
  const env = process.env;
  const baseUrl = (env.BASE_URL || env.WORKFLOW_INTERNAL_BASE_URL || env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const internalKey = env.INTERNAL_API_KEY || env.CRON_SECRET || "";

  const dependencyChecks = [
    classify("DATABASE_URL", true, isPostgresUrl(env.DATABASE_URL), "must_be_postgres_url"),
    classify("DIRECT_DATABASE_URL", true, isPostgresUrl(env.DIRECT_DATABASE_URL), "must_be_postgres_url"),
    classify("INTERNAL_API_KEY_OR_CRON_SECRET", true, Boolean(internalKey), "required_for_internal_trigger"),
    classify("WORKFLOW_INTERNAL_BASE_URL_OR_NEXTAUTH_URL", true, Boolean(baseUrl), "required_for_http_probes"),
    classify("TELEGRAM_BOT_TOKEN", false, Boolean(env.TELEGRAM_BOT_TOKEN), "optional_send_telegram_action"),
    classify("TELEGRAM_CHAT_ID", false, Boolean(env.TELEGRAM_CHAT_ID), "optional_send_telegram_action"),
    classify("PHASE6_ADMIN_EMAIL", false, Boolean(env.PHASE6_ADMIN_EMAIL), "required_for_admin_session_verify"),
    classify("PHASE6_ADMIN_PASSWORD", false, Boolean(env.PHASE6_ADMIN_PASSWORD), "required_for_admin_session_verify"),
    classify(
      "DNSE_REAL_ORDER_SUBMIT_ENABLED",
      false,
      !boolEnv(env.DNSE_REAL_ORDER_SUBMIT_ENABLED, false),
      "must_remain_false_for_phase6",
    ),
  ];

  const blockers = [];
  const warnings = [];
  for (const item of dependencyChecks) {
    if (!item.ok && item.required) blockers.push(item.name);
    if (!item.ok && !item.required) warnings.push(item.name);
  }

  const dbChecks = [];
  if (isPostgresUrl(env.DATABASE_URL) && isPostgresUrl(env.DIRECT_DATABASE_URL)) {
    const prisma = new PrismaClient();
    try {
      const results = await checkDatabaseAndCronLog(prisma);
      dbChecks.push(...results);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    dbChecks.push(classify("database_connection", true, false, "skipped_invalid_database_urls"));
    dbChecks.push(classify("cronlog_write", true, false, "skipped_invalid_database_urls"));
  }

  const internalAuthCheck = await checkInternalTriggerAuth(baseUrl, internalKey);
  const adminRouteCheck = await checkAdminRouteProtection(baseUrl);

  const allChecks = [...dependencyChecks, ...dbChecks, internalAuthCheck, adminRouteCheck];
  for (const check of [internalAuthCheck, ...dbChecks]) {
    if (!check.ok && check.required) blockers.push(check.name);
  }
  if (!adminRouteCheck.ok) warnings.push(adminRouteCheck.name);

  const output = {
    timestamp: new Date().toISOString(),
    mode: "phase6_runtime_readiness",
    checks: allChecks,
    requiredBlockers: Array.from(new Set(blockers)),
    optionalWarnings: Array.from(new Set(warnings)),
    ready: blockers.length === 0,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ready) process.exitCode = 2;
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        mode: "phase6_runtime_readiness",
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
