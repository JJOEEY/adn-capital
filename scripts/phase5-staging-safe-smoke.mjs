function fail(message, extra = {}) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: message,
        ...extra,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

function createSession() {
  const cookies = new Map();

  function applySetCookie(response) {
    const setCookie = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
    for (const row of setCookie) {
      const first = row.split(";")[0] ?? "";
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      if (name) cookies.set(name, value);
    }
  }

  function cookieHeader() {
    if (cookies.size === 0) return "";
    return Array.from(cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function request(baseUrl, path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = new Headers(options.headers || {});
    const cookie = cookieHeader();
    if (cookie) headers.set("cookie", cookie);

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
      redirect: "manual",
      cache: "no-store",
    });
    applySetCookie(response);

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    return { status: response.status, payload };
  }

  return { request };
}

async function loginWithCredentials(session, baseUrl, email, password) {
  const csrf = await session.request(baseUrl, "/api/auth/csrf");
  if (csrf.status !== 200 || !csrf.payload?.csrfToken) {
    fail("csrf_fetch_failed", { step: "csrf", status: csrf.status, payload: csrf.payload });
  }

  const form = new URLSearchParams({
    csrfToken: csrf.payload.csrfToken,
    email,
    password,
    callbackUrl: baseUrl,
    json: "true",
  });

  const auth = await session.request(baseUrl, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (![200, 302].includes(auth.status)) {
    fail("credentials_login_failed", { step: "login", status: auth.status, payload: auth.payload });
  }

  const me = await session.request(baseUrl, "/api/me");
  if (me.status !== 200 || !me.payload?.isAuthenticated) {
    fail("session_not_authenticated", { step: "me", status: me.status, payload: me.payload });
  }

  return me.payload;
}

async function getAdminSettings(session, baseUrl) {
  const res = await session.request(baseUrl, "/api/admin/settings");
  if (res.status !== 200) {
    fail("admin_settings_get_failed", { status: res.status, payload: res.payload });
  }
  return res.payload;
}

async function setAdminSetting(session, baseUrl, key, value) {
  const res = await session.request(baseUrl, "/api/admin/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (res.status !== 200) {
    fail("admin_settings_set_failed", { key, value, status: res.status, payload: res.payload });
  }
}

function createIntentPayload(accountId, overrides = {}) {
  return {
    intent: {
      ticker: "HPG",
      side: "BUY",
      quantity: 100,
      orderType: "LO",
      price: 25.5,
      accountId,
      ...overrides,
    },
    source: "manual",
  };
}

async function runSubmitFlow(session, baseUrl, intentPayload) {
  const parse = await session.request(baseUrl, "/api/v1/brokers/dnse/order-intents/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (parse.status !== 200) fail("parse_failed", { status: parse.status, payload: parse.payload });

  const validate = await session.request(baseUrl, "/api/v1/brokers/dnse/order-intents/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (validate.status !== 200) fail("validate_failed", { status: validate.status, payload: validate.payload });

  const preview = await session.request(baseUrl, "/api/v1/brokers/dnse/orders/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (preview.status !== 200) fail("preview_failed", { status: preview.status, payload: preview.payload });
  const previewId = preview.payload?.ticket?.preview?.previewId;
  if (!previewId) fail("preview_missing_preview_id", { payload: preview.payload });

  const submit = await session.request(baseUrl, "/api/v1/brokers/dnse/orders/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      previewId,
      confirm: true,
      confirmationText: "CONFIRM",
    }),
  });
  const submitResult = submit.payload?.result || submit.payload;
  const submitStatus = submitResult?.status || null;

  return {
    parse,
    validate,
    preview,
    submit,
    submitResult,
    submitStatus,
  };
}

async function main() {
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const userEmail = process.env.PHASE5_USER_EMAIL;
  const userPassword = process.env.PHASE5_USER_PASSWORD;
  const adminEmail = process.env.PHASE5_ADMIN_EMAIL || "admin@adncapital.com.vn";
  const adminPassword = process.env.PHASE5_ADMIN_PASSWORD || "admin123";
  const outsiderEmail = process.env.PHASE5_OUTSIDER_EMAIL || "";
  const outsiderPassword = process.env.PHASE5_OUTSIDER_PASSWORD || "";
  const testKillSwitchGuard = ["1", "true", "yes", "on"].includes(
    String(process.env.PHASE5_TEST_KILL_SWITCH ?? "").trim().toLowerCase(),
  );
  const testAllowlistBlock = ["1", "true", "yes", "on"].includes(
    String(process.env.PHASE5_TEST_ALLOWLIST_BLOCK ?? "").trim().toLowerCase(),
  );

  if (!userEmail || !userPassword) {
    fail("missing PHASE5_USER_EMAIL or PHASE5_USER_PASSWORD");
  }

  const userSession = createSession();
  const adminSession = createSession();
  const summary = { ok: true, baseUrl, steps: {}, skipped: {} };

  const userMe = await loginWithCredentials(userSession, baseUrl, userEmail, userPassword);
  const user = userMe.user || {};
  if (!user.dnseId || user.dnseVerified !== true) {
    fail("user_session_ready_but_dnse_link_missing_or_unverified", { user });
  }

  const userFlow = await runSubmitFlow(userSession, baseUrl, createIntentPayload(user.dnseId));
  if (!["blocked_not_enabled", "approval_required"].includes(userFlow.submitStatus)) {
    fail("submit_status_not_safe_mode", {
      httpStatus: userFlow.submit.status,
      submitStatus: userFlow.submitStatus,
      payload: userFlow.submit.payload,
    });
  }
  summary.steps.userFlow = {
    parseStatus: userFlow.parse.status,
    validateStatus: userFlow.validate.status,
    previewStatus: userFlow.preview.status,
    submitHttpStatus: userFlow.submit.status,
    submitStatus: userFlow.submitStatus,
  };

  await loginWithCredentials(adminSession, baseUrl, adminEmail, adminPassword);
  const currentSettings = await getAdminSettings(adminSession, baseUrl);
  const adminDebug = await adminSession.request(baseUrl, "/api/admin/system/dnse-execution");
  if (adminDebug.status !== 200) fail("admin_debug_failed", { status: adminDebug.status, payload: adminDebug.payload });
  const runtimeRollout = adminDebug.payload?.runtime?.rollout || {};
  if (runtimeRollout.killSwitchEnabled === true) {
    fail("kill_switch_should_be_disabled_for_staging_safe_smoke", { runtimeRollout });
  }
  const latestSubmit = adminDebug.payload?.readModel?.latest?.submit;
  if (!latestSubmit) fail("audit_submit_event_missing_in_admin_debug");

  const hydrated = adminDebug.payload?.topics?.hydrated || [];
  const requiredSuffixes = ["positions", "orders", "balance", "holdings"];
  for (const suffix of requiredSuffixes) {
    const found = hydrated.some((item) => String(item.topic || "").endsWith(`:${suffix}`));
    if (!found) fail("broker_topics_missing_required_channels", { missing: suffix, hydratedCount: hydrated.length });
  }
  summary.steps.adminDebug = {
    status: adminDebug.status,
    canRunStagingSafeFlow: adminDebug.payload?.runtime?.canRunStagingSafeFlow ?? null,
    expectedSubmitStatus: adminDebug.payload?.runtime?.expectedSubmitStatus ?? null,
    rollout: {
      allowlistEnforced: runtimeRollout.allowlistEnforced ?? null,
      allowlistMatched: runtimeRollout.allowlistMatched ?? null,
      killSwitchEnabled: runtimeRollout.killSwitchEnabled ?? null,
    },
    hydratedTopicsCount: hydrated.length,
  };

  if (testKillSwitchGuard) {
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH_REASON", "phase5_smoke_guard_test");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH", "true");
    try {
      const parseBlocked = await userSession.request(baseUrl, "/api/v1/brokers/dnse/order-intents/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createIntentPayload(user.dnseId)),
      });
      if (parseBlocked.status !== 503 || parseBlocked.payload?.error !== "execution_kill_switch_enabled") {
        fail("kill_switch_guard_not_enforced", { parseBlocked });
      }
      summary.steps.killSwitchGuard = {
        parseStatus: parseBlocked.status,
        error: parseBlocked.payload?.error ?? null,
      };
    } finally {
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH", "false");
      await setAdminSetting(
        adminSession,
        baseUrl,
        "DNSE_EXECUTION_KILL_SWITCH_REASON",
        String(currentSettings.DNSE_EXECUTION_KILL_SWITCH_REASON ?? ""),
      );
    }
  } else {
    summary.skipped.killSwitchGuard = "set PHASE5_TEST_KILL_SWITCH=true to execute mutable guard test";
  }

  if (testAllowlistBlock) {
    const backup = {
      enforced: ["1", "true", "yes", "on"].includes(
        String(currentSettings.DNSE_EXECUTION_ALLOWLIST_ENFORCED ?? "").trim().toLowerCase(),
      )
        ? "true"
        : "false",
      users: String(currentSettings.DNSE_EXECUTION_ALLOWLIST_USER_IDS ?? ""),
      accounts: String(currentSettings.DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS ?? ""),
      emails: String(currentSettings.DNSE_EXECUTION_ALLOWLIST_EMAILS ?? ""),
    };
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ENFORCED", "true");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_USER_IDS", "__blocked_user__");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", "__blocked_account__");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_EMAILS", "__blocked@example.com");
    try {
      const blockedFlow = await runSubmitFlow(userSession, baseUrl, createIntentPayload(user.dnseId));
      if (blockedFlow.submitStatus !== "blocked_not_enabled") {
        fail("allowlist_guard_not_enforced", { blockedFlow });
      }
      const submitErrors = blockedFlow.submit.payload?.result?.errors || [];
      if (!Array.isArray(submitErrors) || !submitErrors.includes("pilot_allowlist_required")) {
        fail("allowlist_block_reason_missing", { blockedFlow });
      }
      summary.steps.allowlistGuard = {
        submitHttpStatus: blockedFlow.submit.status,
        submitStatus: blockedFlow.submitStatus,
      };
    } finally {
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ENFORCED", backup.enforced);
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_USER_IDS", backup.users);
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", backup.accounts);
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_EMAILS", backup.emails);
    }
  } else {
    summary.skipped.allowlistGuard = "set PHASE5_TEST_ALLOWLIST_BLOCK=true to execute mutable allowlist test";
  }

  if (outsiderEmail && outsiderPassword) {
    const outsiderSession = createSession();
    const outsiderMe = await loginWithCredentials(outsiderSession, baseUrl, outsiderEmail, outsiderPassword);
    const outsiderUser = outsiderMe.user || {};
    if (!outsiderUser.dnseId || outsiderUser.dnseVerified !== true) {
      fail("outsider_user_missing_dnse_link_for_allowlist_guard_test", { outsiderUser });
    }
    const outsiderFlow = await runSubmitFlow(
      outsiderSession,
      baseUrl,
      createIntentPayload(outsiderUser.dnseId),
    );
    if (outsiderFlow.submitStatus !== "blocked_not_enabled") {
      fail("outsider_submit_not_blocked_by_allowlist", {
        submitStatus: outsiderFlow.submitStatus,
        payload: outsiderFlow.submit.payload,
      });
    }
    summary.steps.outsiderAllowlistGuard = {
      submitHttpStatus: outsiderFlow.submit.status,
      submitStatus: outsiderFlow.submitStatus,
    };
  } else {
    summary.skipped.outsiderAllowlistGuard = "missing PHASE5_OUTSIDER_EMAIL/PHASE5_OUTSIDER_PASSWORD";
  }

  summary.user = {
    id: user.id || null,
    email: user.email || null,
    dnseId: user.dnseId || null,
    dnseVerified: Boolean(user.dnseVerified),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  fail("fatal_error", { detail: error instanceof Error ? error.message : String(error) });
});
