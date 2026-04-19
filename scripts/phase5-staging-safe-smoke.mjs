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

async function main() {
  const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const userEmail = process.env.PHASE5_USER_EMAIL;
  const userPassword = process.env.PHASE5_USER_PASSWORD;
  const adminEmail = process.env.PHASE5_ADMIN_EMAIL || "admin@adncapital.com.vn";
  const adminPassword = process.env.PHASE5_ADMIN_PASSWORD || "admin123";

  if (!userEmail || !userPassword) {
    fail("missing PHASE5_USER_EMAIL or PHASE5_USER_PASSWORD");
  }

  const userSession = createSession();
  const adminSession = createSession();
  const summary = { ok: true, baseUrl, steps: {} };

  const userMe = await loginWithCredentials(userSession, baseUrl, userEmail, userPassword);
  const user = userMe.user || {};
  if (!user.dnseId || user.dnseVerified !== true) {
    fail("user_session_ready_but_dnse_link_missing_or_unverified", { user });
  }

  const intentPayload = {
    intent: {
      ticker: "HPG",
      side: "BUY",
      quantity: 100,
      orderType: "LO",
      price: 25.5,
      accountId: user.dnseId,
    },
    source: "manual",
  };

  const parse = await userSession.request(baseUrl, "/api/v1/brokers/dnse/order-intents/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (parse.status !== 200) fail("parse_failed", { status: parse.status, payload: parse.payload });
  summary.steps.parse = {
    status: parse.status,
    validationStatus: parse.payload?.validation?.status || null,
  };

  const validate = await userSession.request(baseUrl, "/api/v1/brokers/dnse/order-intents/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (validate.status !== 200) fail("validate_failed", { status: validate.status, payload: validate.payload });
  summary.steps.validate = {
    status: validate.status,
    validationStatus: validate.payload?.validation?.status || null,
  };

  const preview = await userSession.request(baseUrl, "/api/v1/brokers/dnse/orders/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intentPayload),
  });
  if (preview.status !== 200) fail("preview_failed", { status: preview.status, payload: preview.payload });
  const previewId = preview.payload?.ticket?.preview?.previewId;
  if (!previewId) fail("preview_missing_preview_id", { payload: preview.payload });
  summary.steps.preview = { status: preview.status, previewId };

  const submit = await userSession.request(baseUrl, "/api/v1/brokers/dnse/orders/submit", {
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
  if (!["blocked_not_enabled", "approval_required"].includes(submitStatus)) {
    fail("submit_status_not_safe_mode", { httpStatus: submit.status, submitStatus, payload: submit.payload });
  }
  summary.steps.submit = { httpStatus: submit.status, resultStatus: submitStatus };

  await loginWithCredentials(adminSession, baseUrl, adminEmail, adminPassword);
  const adminDebug = await adminSession.request(baseUrl, "/api/admin/system/dnse-execution");
  if (adminDebug.status !== 200) fail("admin_debug_failed", { status: adminDebug.status, payload: adminDebug.payload });
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
    hydratedTopicsCount: hydrated.length,
  };
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
