import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.BASE_URL || process.env.WORKFLOW_INTERNAL_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET || "";

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

async function triggerEvent(event) {
  const response = await fetch(`${BASE_URL}/api/internal/workflows/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": INTERNAL_KEY,
    },
    body: JSON.stringify(event),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`trigger_failed_http_${response.status}`, { payload, event });
  }
  return payload;
}

async function fetchLatestWorkflowRun(prisma, workflowKey) {
  return prisma.cronLog.findFirst({
    where: { cronName: `workflow:${workflowKey}` },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cronName: true,
      status: true,
      message: true,
      createdAt: true,
      duration: true,
      resultData: true,
    },
  });
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

function validateExecutionShape(execution, workflowKey) {
  assert(execution, "missing_execution_payload", { workflowKey });
  assert(Array.isArray(execution.actions), "execution_actions_missing", { workflowKey, execution });
  assert(typeof execution.retries === "number", "execution_retries_missing", { workflowKey, execution });
  assert(Array.isArray(execution.warnings), "execution_warnings_missing", { workflowKey, execution });
  assert(typeof execution.triggerSource === "string", "execution_trigger_source_missing", { workflowKey, execution });
  assert(typeof execution.triggerType === "string", "execution_trigger_type_missing", { workflowKey, execution });
}

async function main() {
  assert(Boolean(INTERNAL_KEY), "missing_INTERNAL_API_KEY_or_CRON_SECRET");

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;

    const eventCases = [
      {
        workflowKey: "morning-brief-ready-refresh",
        trigger: {
          type: "brief_ready",
          source: "phase6-smoke",
          payload: {
            reportType: "morning_brief",
            title: "Phase6 Smoke Morning",
            content: "Phase6 smoke content",
          },
        },
      },
      {
        workflowKey: "signal-active-notify",
        trigger: {
          type: "signal_status_changed",
          source: "phase6-smoke",
          payload: {
            ticker: "HPG",
            signalType: "TRUNG_HAN",
            fromStatus: "RADAR",
            toStatus: "ACTIVE",
            entryPrice: 26000,
          },
        },
      },
      {
        workflowKey: "portfolio-risk-alert",
        trigger: {
          type: "portfolio_risk_threshold",
          source: "phase6-smoke",
          payload: {
            userId: "phase6-smoke-user",
            riskPercent: 82,
          },
        },
      },
    ];

    const triggerResults = {};
    for (const item of eventCases) {
      const payload = await triggerEvent(item.trigger);
      assert(Array.isArray(payload.matchedWorkflowKeys), "matched_workflow_keys_missing", { workflowKey: item.workflowKey, payload });
      assert(
        payload.matchedWorkflowKeys.includes(item.workflowKey),
        "workflow_not_matched_by_trigger",
        { workflowKey: item.workflowKey, payload },
      );
      triggerResults[item.workflowKey] = payload;
    }

    const latestRuns = {};
    for (const item of eventCases) {
      const run = await fetchLatestWorkflowRun(prisma, item.workflowKey);
      assert(run, "missing_workflow_run", { workflowKey: item.workflowKey });
      const execution = parseExecution(run);
      validateExecutionShape(execution, item.workflowKey);

      latestRuns[item.workflowKey] = {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        duration: run.duration,
        message: run.message,
        triggerType: execution?.triggerType ?? null,
        triggerSource: execution?.triggerSource ?? null,
        retries: execution?.retries ?? null,
        warnings: execution?.warnings ?? [],
        actionStatuses: Array.isArray(execution?.actions)
          ? execution.actions.map((a) => ({
              actionKey: a.actionKey,
              type: a.type,
              status: a.status,
              attempts: a.attempts,
              warning: a.warning ?? null,
              error: a.error ?? null,
            }))
          : [],
      };
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: BASE_URL,
          triggerResults,
          latestRuns,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail("phase6_smoke_fatal", {
    detail: error instanceof Error ? error.message : String(error),
  });
});
