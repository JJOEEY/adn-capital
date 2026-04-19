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
    const headers = new Headers(options.headers || {});
    const cookie = cookieHeader();
    if (cookie) headers.set("cookie", cookie);

    const response = await fetch(`${baseUrl}${path}`, {
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
    fail("csrf_fetch_failed", { status: csrf.status, payload: csrf.payload, email });
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
    fail("credentials_login_failed", { status: auth.status, payload: auth.payload, email });
  }

  const me = await session.request(baseUrl, "/api/me");
  if (me.status !== 200 || !me.payload?.isAuthenticated) {
    fail("session_not_authenticated", { status: me.status, payload: me.payload, email });
  }
  return me.payload;
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

async function runParseValidatePreviewSubmit(session, baseUrl, intentPayload) {
  const parse = await session.request(baseUrl, "/api/v1/brokers/dnse/order-intents/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (parse.status !== 200) {
    fail("parse_failed", { status: parse.status, payload: parse.payload });
  }

  const validate = await session.request(baseUrl, "/api/v1/brokers/dnse/order-intents/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (validate.status !== 200) {
    fail("validate_failed", { status: validate.status, payload: validate.payload });
  }

  const preview = await session.request(baseUrl, "/api/v1/brokers/dnse/orders/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (preview.status !== 200) {
    fail("preview_failed", { status: preview.status, payload: preview.payload });
  }
  const previewId = preview.payload?.ticket?.preview?.previewId;
  if (!previewId) {
    fail("preview_missing_preview_id", { payload: preview.payload });
  }

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
  return {
    parse,
    validate,
    preview,
    submit,
    submitResult,
    submitStatus: submitResult?.status || null,
    submitErrors: Array.isArray(submitResult?.errors) ? submitResult.errors : [],
  };
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

function boolToString(value) {
  return value ? "true" : "false";
}

async function main() {
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const allowlistEmail = process.env.PHASE5_ALLOWLIST_USER_EMAIL;
  const allowlistPassword = process.env.PHASE5_ALLOWLIST_USER_PASSWORD;
  const adminEmail = process.env.PHASE5_ADMIN_EMAIL || "admin@adncapital.com.vn";
  const adminPassword = process.env.PHASE5_ADMIN_PASSWORD || "admin123";
  const outsiderEmail = process.env.PHASE5_OUTSIDER_EMAIL || "";
  const outsiderPassword = process.env.PHASE5_OUTSIDER_PASSWORD || "";

  if (!allowlistEmail || !allowlistPassword) {
    fail("missing PHASE5_ALLOWLIST_USER_EMAIL or PHASE5_ALLOWLIST_USER_PASSWORD");
  }

  const userSession = createSession();
  const adminSession = createSession();
  const outsiderSession = outsiderEmail && outsiderPassword ? createSession() : null;

  const summary = {
    ok: true,
    baseUrl,
    cases: {},
    skipped: {},
  };

  const allowlistUserMe = await loginWithCredentials(userSession, baseUrl, allowlistEmail, allowlistPassword);
  const allowlistUser = allowlistUserMe.user || {};
  if (!allowlistUser.id || !allowlistUser.email || !allowlistUser.dnseId || allowlistUser.dnseVerified !== true) {
    fail("allowlist_user_missing_dnse_link_or_verification", { allowlistUser });
  }

  await loginWithCredentials(adminSession, baseUrl, adminEmail, adminPassword);
  const settingsBefore = await getAdminSettings(adminSession, baseUrl);
  const settingsBackup = {
    DNSE_EXECUTION_KILL_SWITCH: boolToString(settingsBefore.DNSE_EXECUTION_KILL_SWITCH === true),
    DNSE_EXECUTION_KILL_SWITCH_REASON: String(settingsBefore.DNSE_EXECUTION_KILL_SWITCH_REASON ?? ""),
    DNSE_EXECUTION_ALLOWLIST_ENFORCED: boolToString(settingsBefore.DNSE_EXECUTION_ALLOWLIST_ENFORCED === true),
    DNSE_EXECUTION_ALLOWLIST_USER_IDS: String(settingsBefore.DNSE_EXECUTION_ALLOWLIST_USER_IDS ?? ""),
    DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS: String(settingsBefore.DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS ?? ""),
    DNSE_EXECUTION_ALLOWLIST_EMAILS: String(settingsBefore.DNSE_EXECUTION_ALLOWLIST_EMAILS ?? ""),
  };

  const restoreSettings = async () => {
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH", settingsBackup.DNSE_EXECUTION_KILL_SWITCH);
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH_REASON", settingsBackup.DNSE_EXECUTION_KILL_SWITCH_REASON);
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ENFORCED", settingsBackup.DNSE_EXECUTION_ALLOWLIST_ENFORCED);
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_USER_IDS", settingsBackup.DNSE_EXECUTION_ALLOWLIST_USER_IDS);
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", settingsBackup.DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS);
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_EMAILS", settingsBackup.DNSE_EXECUTION_ALLOWLIST_EMAILS);
  };

  try {
    // Baseline pilot settings: allowlist on, kill switch off, allowlist includes pilot user.
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH_REASON", "");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH", "false");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ENFORCED", "true");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_USER_IDS", String(allowlistUser.id));
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", String(allowlistUser.dnseId));
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_EMAILS", String(allowlistUser.email));

    // Case 1: inside allowlist + preview success + submit blocked by safe/compliance gate.
    const positiveFlow = await runParseValidatePreviewSubmit(
      userSession,
      baseUrl,
      createIntentPayload(allowlistUser.dnseId),
    );
    if (!["blocked_not_enabled", "approval_required"].includes(positiveFlow.submitStatus)) {
      fail("inside_allowlist_submit_not_blocked_as_expected", {
        submitStatus: positiveFlow.submitStatus,
        payload: positiveFlow.submit.payload,
      });
    }
    summary.cases.insideAllowlist = {
      parseStatus: positiveFlow.parse.status,
      validateStatus: positiveFlow.validate.status,
      previewStatus: positiveFlow.preview.status,
      submitHttpStatus: positiveFlow.submit.status,
      submitStatus: positiveFlow.submitStatus,
      submitErrors: positiveFlow.submitErrors,
    };

    // Case 2: outside allowlist -> blocked_not_enabled with pilot_allowlist_required
    if (outsiderSession) {
      const outsiderMe = await loginWithCredentials(outsiderSession, baseUrl, outsiderEmail, outsiderPassword);
      const outsiderUser = outsiderMe.user || {};
      if (!outsiderUser.dnseId || outsiderUser.dnseVerified !== true) {
        fail("outsider_user_missing_dnse_link_or_verification", { outsiderUser });
      }
      const outsiderFlow = await runParseValidatePreviewSubmit(
        outsiderSession,
        baseUrl,
        createIntentPayload(outsiderUser.dnseId),
      );
      if (outsiderFlow.submitStatus !== "blocked_not_enabled") {
        fail("outside_allowlist_not_blocked", { outsiderFlow });
      }
      if (!outsiderFlow.submitErrors.includes("pilot_allowlist_required")) {
        fail("outside_allowlist_block_reason_missing", { outsiderFlow });
      }
      summary.cases.outsideAllowlist = {
        mode: "outsider-session",
        submitHttpStatus: outsiderFlow.submit.status,
        submitStatus: outsiderFlow.submitStatus,
        submitErrors: outsiderFlow.submitErrors,
      };
    } else {
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_USER_IDS", "__blocked_user__");
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", "__blocked_account__");
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_EMAILS", "__blocked@example.com");
      const sameUserBlockedFlow = await runParseValidatePreviewSubmit(
        userSession,
        baseUrl,
        createIntentPayload(allowlistUser.dnseId),
      );
      if (sameUserBlockedFlow.submitStatus !== "blocked_not_enabled") {
        fail("outside_allowlist_not_blocked_same_user_path", { sameUserBlockedFlow });
      }
      if (!sameUserBlockedFlow.submitErrors.includes("pilot_allowlist_required")) {
        fail("outside_allowlist_reason_missing_same_user_path", { sameUserBlockedFlow });
      }
      summary.cases.outsideAllowlist = {
        mode: "same-user-by-temporary-allowlist-mismatch",
        submitHttpStatus: sameUserBlockedFlow.submit.status,
        submitStatus: sameUserBlockedFlow.submitStatus,
        submitErrors: sameUserBlockedFlow.submitErrors,
      };
      // Restore allowlist include pilot for next cases.
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_USER_IDS", String(allowlistUser.id));
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS", String(allowlistUser.dnseId));
      await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_ALLOWLIST_EMAILS", String(allowlistUser.email));
      summary.skipped.outsiderSession = "PHASE5_OUTSIDER_EMAIL/PASSWORD not provided";
    }

    // Case 3: kill switch on -> parse blocked immediately.
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH_REASON", "phase5_4_runtime_verification");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH", "true");
    const killSwitchParse = await userSession.request(baseUrl, "/api/v1/brokers/dnse/order-intents/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createIntentPayload(allowlistUser.dnseId)),
    });
    if (killSwitchParse.status !== 503 || killSwitchParse.payload?.error !== "execution_kill_switch_enabled") {
      fail("kill_switch_guard_failed", { killSwitchParse });
    }
    summary.cases.killSwitchOn = {
      parseStatus: killSwitchParse.status,
      error: killSwitchParse.payload?.error ?? null,
      reason: killSwitchParse.payload?.reason ?? null,
    };
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH", "false");
    await setAdminSetting(adminSession, baseUrl, "DNSE_EXECUTION_KILL_SWITCH_REASON", "");

    // Case 4: admin debug + decision chain + topic hydration verify.
    const params = new URLSearchParams({
      userId: String(allowlistUser.id),
      accountId: String(allowlistUser.dnseId),
      ticker: "HPG",
      actions: "parse_intent,validate_intent,preview_order,submit_blocked_not_enabled,submit_approval_required",
      limit: "200",
      withTopics: "1",
    });
    const debug = await adminSession.request(baseUrl, `/api/admin/system/dnse-execution?${params.toString()}`);
    if (debug.status !== 200) {
      fail("admin_debug_fetch_failed", { debug });
    }
    const runtime = debug.payload?.runtime || {};
    const latestSubmit = debug.payload?.readModel?.latest?.submit;
    if (!latestSubmit) {
      fail("admin_debug_missing_latest_submit");
    }
    const chains = debug.payload?.readModel?.chains || [];
    if (!Array.isArray(chains) || chains.length === 0) {
      fail("admin_debug_missing_decision_chain");
    }
    const hydrated = debug.payload?.topics?.hydrated || [];
    const requiredSuffixes = ["positions", "orders", "balance", "holdings"];
    for (const suffix of requiredSuffixes) {
      const found = hydrated.some((item) => String(item.topic || "").endsWith(`:${suffix}`));
      if (!found) {
        fail("topic_hydration_missing_channel", { missing: suffix, hydratedCount: hydrated.length });
      }
    }
    summary.cases.adminDebug = {
      status: debug.status,
      expectedSubmitStatus: runtime.expectedSubmitStatus ?? null,
      blockers: runtime.blockers ?? [],
      warnings: runtime.warnings ?? [],
      chainsCount: chains.length,
      hydratedTopicsCount: hydrated.length,
      allowlistEnforced: runtime.rollout?.allowlistEnforced ?? null,
      allowlistMatched: runtime.rollout?.allowlistMatched ?? null,
      killSwitchEnabled: runtime.rollout?.killSwitchEnabled ?? null,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await restoreSettings().catch((error) => {
      console.error(
        JSON.stringify(
          {
            ok: false,
            warning: "settings_restore_failed",
            detail: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    });
  }
}

main().catch((error) => {
  fail("fatal_error", {
    detail: error instanceof Error ? error.message : String(error),
  });
});
