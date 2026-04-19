import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.BASE_URL || process.env.WORKFLOW_INTERNAL_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET || "";
const SCANNER_SECRET = process.env.SCANNER_SECRET || "adn-scanner-secret-key";
const ADMIN_EMAIL = process.env.PHASE6_ADMIN_EMAIL || "admin@adncapital.com.vn";
const ADMIN_PASSWORD = process.env.PHASE6_ADMIN_PASSWORD || "admin123";

const TEST_SIGNAL_TICKER = "WFTEST";
const TEST_SIGNAL_TYPE = "TRUNG_HAN";

const PHASE6_SETTING_KEYS = [
  "AI_BROKER_MIN_PRICE",
  "AI_BROKER_MIN_WINRATE",
  "AI_BROKER_MIN_RR",
  "AI_BROKER_AUTO_PICK",
];

function fail(message, extra = {}) {
  console.error(
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

function assert(condition, message, extra = {}) {
  if (!condition) fail(message, extra);
}

function createSession() {
  const cookies = new Map();

  function applySetCookie(response) {
    const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
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

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const cookie = cookieHeader();
    if (cookie) headers.set("cookie", cookie);

    const response = await fetch(`${BASE_URL}${path}`, {
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
    return { status: response.status, payload, raw };
  }

  return { request };
}

async function loginWithCredentials(session, email, password) {
  const csrf = await session.request("/api/auth/csrf");
  if (csrf.status !== 200 || !csrf.payload?.csrfToken) {
    fail("csrf_fetch_failed", { status: csrf.status, payload: csrf.payload, email });
  }

  const form = new URLSearchParams({
    csrfToken: csrf.payload.csrfToken,
    email,
    password,
    callbackUrl: BASE_URL,
    json: "true",
  });

  const auth = await session.request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (![200, 302].includes(auth.status)) {
    fail("credentials_login_failed", { status: auth.status, payload: auth.payload, email });
  }

  const me = await session.request("/api/me");
  if (me.status !== 200 || !me.payload?.isAuthenticated) {
    fail("session_not_authenticated", { status: me.status, payload: me.payload, email });
  }
  return me.payload;
}

async function triggerInternal(event) {
  const response = await fetch(`${BASE_URL}/api/internal/workflows/trigger`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-key": INTERNAL_KEY,
    },
    body: JSON.stringify(event),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`internal_trigger_failed_http_${response.status}`, { payload, event });
  }
  return payload;
}

function parseExecution(run) {
  if (!run?.resultData) return null;
  try {
    const parsed = JSON.parse(run.resultData);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function getLatestWorkflowRun(prisma, workflowKey) {
  const run = await prisma.cronLog.findFirst({
    where: { cronName: `workflow:${workflowKey}` },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      message: true,
      duration: true,
      createdAt: true,
      resultData: true,
    },
  });
  assert(run, "workflow_run_missing", { workflowKey });
  const execution = parseExecution(run);
  assert(execution, "workflow_run_execution_missing", { workflowKey, runId: run.id });
  assert(Array.isArray(execution.actions), "workflow_run_actions_missing", { workflowKey, runId: run.id });
  assert(typeof execution.retries === "number", "workflow_run_retries_missing", { workflowKey, runId: run.id });
  assert(typeof execution.triggerSource === "string", "workflow_run_trigger_source_missing", {
    workflowKey,
    runId: run.id,
  });
  return { run, execution };
}

async function setSystemSetting(prisma, key, value) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function main() {
  assert(Boolean(INTERNAL_KEY), "missing_INTERNAL_API_KEY_or_CRON_SECRET");
  const prisma = new PrismaClient();
  const backupSettings = new Map();
  const cleanupSignalIds = [];
  const summary = {
    ok: true,
    baseUrl: BASE_URL,
    workflows: {},
    admin: {},
    integrations: {},
  };

  try {
    await prisma.$queryRaw`SELECT 1`;

    for (const key of PHASE6_SETTING_KEYS) {
      const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
      backupSettings.set(key, row?.value ?? null);
    }

    const manualCases = [
      {
        workflowKey: "morning-brief-ready-refresh",
        event: {
          type: "brief_ready",
          source: "phase6-staging-verify",
          payload: {
            reportType: "morning_brief",
            title: "Phase6 Staging Verify Morning",
            content: "Phase6 staging verification content",
          },
        },
      },
      {
        workflowKey: "signal-active-notify",
        event: {
          type: "signal_status_changed",
          source: "phase6-staging-verify",
          payload: {
            ticker: "HPG",
            signalType: "TRUNG_HAN",
            fromStatus: "RADAR",
            toStatus: "ACTIVE",
            entryPrice: 25000,
          },
        },
      },
      {
        workflowKey: "portfolio-risk-alert",
        event: {
          type: "portfolio_risk_threshold",
          source: "phase6-staging-verify",
          payload: {
            userId: "phase6-staging-user",
            riskPercent: 83,
          },
        },
      },
    ];

    for (const item of manualCases) {
      const triggerResult = await triggerInternal(item.event);
      assert(Array.isArray(triggerResult.matchedWorkflowKeys), "trigger_result_missing_matched_keys", {
        workflowKey: item.workflowKey,
        triggerResult,
      });
      assert(triggerResult.matchedWorkflowKeys.includes(item.workflowKey), "workflow_not_matched", {
        workflowKey: item.workflowKey,
        triggerResult,
      });
      const { run, execution } = await getLatestWorkflowRun(prisma, item.workflowKey);
      summary.workflows[item.workflowKey] = {
        runId: run.id,
        status: run.status,
        triggerSource: execution.triggerSource,
        triggerType: execution.triggerType,
        retries: execution.retries,
        actionStatuses: execution.actions.map((a) => ({
          actionKey: a.actionKey,
          type: a.type,
          status: a.status,
          attempts: a.attempts,
          warning: a.warning ?? null,
          error: a.error ?? null,
        })),
      };
    }

    const adminSession = createSession();
    const adminMe = await loginWithCredentials(adminSession, ADMIN_EMAIL, ADMIN_PASSWORD);
    summary.admin.session = {
      userId: adminMe.user?.id ?? null,
      email: adminMe.user?.email ?? null,
      role: adminMe.user?.role ?? null,
    };

    const workflowsRes = await adminSession.request("/api/admin/system/workflows");
    assert(workflowsRes.status === 200, "admin_workflows_api_failed", { status: workflowsRes.status, payload: workflowsRes.payload });
    const runsRes = await adminSession.request("/api/admin/system/workflows/runs?limit=30");
    assert(runsRes.status === 200, "admin_workflow_runs_api_failed", { status: runsRes.status, payload: runsRes.payload });
    const pageRes = await adminSession.request("/admin/workflows");
    assert(pageRes.status === 200, "admin_workflows_page_failed", { status: pageRes.status });

    const definitions = Array.isArray(workflowsRes.payload?.definitions) ? workflowsRes.payload.definitions : [];
    const runs = Array.isArray(runsRes.payload?.runs) ? runsRes.payload.runs : [];
    assert(definitions.some((d) => d.workflowKey === "morning-brief-ready-refresh"), "admin_definitions_missing_morning");
    assert(definitions.some((d) => d.workflowKey === "signal-active-notify"), "admin_definitions_missing_signal");
    assert(definitions.some((d) => d.workflowKey === "portfolio-risk-alert"), "admin_definitions_missing_portfolio");
    assert(runs.some((r) => r.workflowKey === "morning-brief-ready-refresh"), "admin_runs_missing_morning");

    summary.admin.routes = {
      workflowsApiStatus: workflowsRes.status,
      runsApiStatus: runsRes.status,
      pageStatus: pageRes.status,
      definitionsCount: definitions.length,
      runsCount: runs.length,
    };

    const cronRes = await fetch(`${BASE_URL}/api/cron?type=signal_scan_type1&sync=1`, {
      method: "GET",
      headers: {
        "x-cron-secret": INTERNAL_KEY,
      },
      cache: "no-store",
    });
    const cronPayload = await cronRes.json().catch(() => ({}));
    assert(cronRes.ok, "cron_route_failed", { status: cronRes.status, payload: cronPayload });
    const { run: cronRun, execution: cronExec } = await getLatestWorkflowRun(prisma, "cron-canonical-pulse");
    assert(String(cronExec.triggerSource || "").includes("cron-dispatch"), "cron_trigger_source_not_canonical", {
      triggerSource: cronExec.triggerSource,
    });

    summary.integrations.cron = {
      httpStatus: cronRes.status,
      response: cronPayload,
      workflowRunId: cronRun.id,
      triggerSource: cronExec.triggerSource,
      triggerType: cronExec.triggerType,
    };

    await setSystemSetting(prisma, "AI_BROKER_MIN_PRICE", "1");
    await setSystemSetting(prisma, "AI_BROKER_MIN_WINRATE", "0");
    await setSystemSetting(prisma, "AI_BROKER_MIN_RR", "0.1");
    await setSystemSetting(prisma, "AI_BROKER_AUTO_PICK", "true");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const seeded = await prisma.signal.create({
      data: {
        ticker: TEST_SIGNAL_TICKER,
        type: TEST_SIGNAL_TYPE,
        status: "RADAR",
        tier: "NGAN_HAN",
        entryPrice: 25000,
        target: 26750,
        stoploss: 24250,
        navAllocation: 5,
        triggerSignal: "phase6 webhook seed",
        aiReasoning: "phase6 webhook seed",
      },
      select: { id: true },
    });
    cleanupSignalIds.push(seeded.id);

    const webhookRes = await fetch(`${BASE_URL}/api/webhooks/signals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secret: SCANNER_SECRET,
        signals: [
          {
            ticker: TEST_SIGNAL_TICKER,
            type: TEST_SIGNAL_TYPE,
            entryPrice: 25100,
            reason: "phase6 webhook runtime verification",
          },
        ],
      }),
      cache: "no-store",
    });
    const webhookPayload = await webhookRes.json().catch(() => ({}));
    assert(webhookRes.ok, "webhook_route_failed", { status: webhookRes.status, payload: webhookPayload });

    const { run: webhookRun, execution: webhookExec } = await getLatestWorkflowRun(prisma, "signal-active-notify");
    assert(
      String(webhookExec.triggerSource || "").includes("webhook:signals"),
      "webhook_trigger_source_not_canonical",
      { triggerSource: webhookExec.triggerSource },
    );

    summary.integrations.webhook = {
      httpStatus: webhookRes.status,
      response: webhookPayload,
      workflowRunId: webhookRun.id,
      triggerSource: webhookExec.triggerSource,
      triggerType: webhookExec.triggerType,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    for (const id of cleanupSignalIds) {
      await prisma.signal.delete({ where: { id } }).catch(() => null);
    }
    for (const key of PHASE6_SETTING_KEYS) {
      if (!backupSettings.has(key)) continue;
      const previous = backupSettings.get(key);
      if (previous == null) {
        await prisma.systemSetting.delete({ where: { key } }).catch(() => null);
      } else {
        await setSystemSetting(prisma, key, previous);
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail("phase6_staging_runtime_verification_failed", {
    detail: error instanceof Error ? error.message : String(error),
  });
});
