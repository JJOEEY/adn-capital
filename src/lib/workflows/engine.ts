import { prisma } from "@/lib/prisma";
import { emitObservabilityEvent } from "@/lib/observability";
import { executeWorkflowAction } from "./actions";
import { WORKFLOW_DEFINITIONS } from "./definitions";
import { nowIso, resolveRetryPolicy, shouldRunConditions, sleep } from "./helpers";
import { triggerMatches } from "./triggers";
import {
  WorkflowActionDefinition,
  WorkflowActionExecutionResult,
  WorkflowDefinition,
  WorkflowDispatchResult,
  WorkflowExecutionRecord,
  WorkflowExecutionStatus,
  WorkflowRetryPolicy,
  WorkflowTriggerEvent,
} from "./types";

const WORKFLOW_ENABLED_SETTING_PREFIX = "workflow:";

function parseBoolean(raw: string | null | undefined) {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function buildRunId(workflowKey: string) {
  return `${workflowKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function loadWorkflowEnabledOverrides() {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: WORKFLOW_ENABLED_SETTING_PREFIX,
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const map = new Map<string, boolean>();
  for (const row of rows) {
    const matched = row.key.match(/^workflow:([^:]+):enabled$/);
    if (!matched) continue;
    const parsed = parseBoolean(row.value);
    if (parsed == null) continue;
    map.set(matched[1], parsed);
  }
  return map;
}

export async function getWorkflowDefinitions() {
  const overrides = await loadWorkflowEnabledOverrides();
  return WORKFLOW_DEFINITIONS.map((definition) => {
    const override = overrides.get(definition.workflowKey);
    return {
      ...definition,
      enabled: override ?? definition.enabled,
      runtimeOverride: override ?? null,
    };
  });
}

async function persistExecution(record: WorkflowExecutionRecord) {
  const status: WorkflowExecutionStatus = record.status;
  const row = await prisma.cronLog.create({
    data: {
      cronName: `workflow:${record.workflowKey}`,
      status,
      message: `${record.triggerType} via ${record.triggerSource}`,
      duration: record.durationMs,
      resultData: JSON.stringify(record),
    },
  });
  emitObservabilityEvent({
    domain: "workflow",
    level: status === "error" ? "error" : status === "skipped" ? "warn" : "info",
    event: "workflow_run_persisted",
    meta: {
      workflowKey: record.workflowKey,
      runId: record.runId,
      cronLogId: row.id,
      status,
      triggerType: record.triggerType,
      triggerSource: record.triggerSource,
      durationMs: record.durationMs,
      retries: record.retries,
      actionsCount: record.actions.length,
    },
  });
}

type ActionAttemptResult = {
  result: WorkflowActionExecutionResult;
  retriesUsed: number;
  failedHard: boolean;
};

async function executeActionWithRetry(
  action: WorkflowActionDefinition,
  workflow: WorkflowDefinition,
  event: WorkflowTriggerEvent,
  runId: string,
): Promise<ActionAttemptResult> {
  const retry = resolveRetryPolicy(workflow.retryPolicy, action.retryPolicy);
  const actionKey = action.actionKey ?? action.type;
  let attempts = 0;
  let retriesUsed = 0;
  const startedAt = nowIso();

  while (attempts < retry.maxAttempts) {
    attempts += 1;
    const actionStartMs = Date.now();
    const execution = await executeWorkflowAction(action, {
      event,
      workflow,
      runId,
    });
    const completedAt = nowIso();
    const result: WorkflowActionExecutionResult = {
      actionKey,
      type: action.type,
      status: execution.status,
      deterministic: action.deterministic ?? execution.deterministic,
      attempts,
      retryable: execution.retryable,
      continueOnError: action.continueOnError === true,
      startedAt,
      completedAt,
      durationMs: Date.now() - actionStartMs,
      data: execution.data ?? null,
      warning: execution.warning ?? null,
      error: execution.error ?? null,
    };

    if (execution.status !== "error") {
      return {
        result,
        retriesUsed,
        failedHard: false,
      };
    }

    const hasMoreAttempts = attempts < retry.maxAttempts;
    if (!execution.retryable || !hasMoreAttempts) {
      return {
        result,
        retriesUsed,
        failedHard: true,
      };
    }

    retriesUsed += 1;
    if (retry.delayMs > 0) {
      await sleep(retry.delayMs);
    }
  }

  return {
    result: {
      actionKey,
      type: action.type,
      status: "error",
      deterministic: action.deterministic ?? true,
      attempts,
      retryable: false,
      continueOnError: action.continueOnError === true,
      startedAt,
      completedAt: nowIso(),
      durationMs: 0,
      data: null,
      warning: null,
      error: "unknown_workflow_action_error",
    },
    retriesUsed,
    failedHard: true,
  };
}

async function runWorkflow(definition: WorkflowDefinition, event: WorkflowTriggerEvent) {
  const runId = buildRunId(definition.workflowKey);
  const startedAt = nowIso();
  const startMs = Date.now();
  const actions: WorkflowActionExecutionResult[] = [];
  const warnings: string[] = [];
  let retries = 0;
  let status: WorkflowExecutionStatus = "success";
  let runError: string | null = null;

  for (const action of definition.actions) {
    const { result, retriesUsed, failedHard } = await executeActionWithRetry(
      action,
      definition,
      event,
      runId,
    );
    retries += retriesUsed;
    actions.push(result);
    if (result.warning) warnings.push(result.warning);
    if (result.status === "error" && failedHard) {
      if (action.continueOnError) {
        warnings.push(`Action ${result.actionKey} failed but continued`);
        continue;
      }
      status = "error";
      runError = result.error ?? "workflow_action_failed";
      break;
    }
  }

  const completedAt = nowIso();
  const record: WorkflowExecutionRecord = {
    runId,
    workflowKey: definition.workflowKey,
    title: definition.title,
    triggerType: event.type,
    triggerSource: event.source,
    triggerAt: event.at ?? startedAt,
    triggerPayload: event.payload ?? null,
    status,
    startedAt,
    completedAt,
    durationMs: Date.now() - startMs,
    actions,
    retries,
    warnings,
    error: runError,
  };
  await persistExecution(record);
  return record;
}

export async function runWorkflowsForTrigger(input: WorkflowTriggerEvent): Promise<WorkflowDispatchResult> {
  const event: WorkflowTriggerEvent = {
    ...input,
    at: input.at ?? nowIso(),
    payload: input.payload ?? {},
  };
  const definitions = await getWorkflowDefinitions();

  const matched: WorkflowDefinition[] = [];
  const skippedKeys: string[] = [];
  for (const definition of definitions) {
    if (!definition.enabled) {
      skippedKeys.push(definition.workflowKey);
      continue;
    }
    if (!triggerMatches(definition.trigger, event)) {
      skippedKeys.push(definition.workflowKey);
      continue;
    }
    if (!shouldRunConditions(definition, event)) {
      skippedKeys.push(definition.workflowKey);
      continue;
    }
    matched.push(definition);
  }

  const runs: WorkflowExecutionRecord[] = [];
  emitObservabilityEvent({
    domain: "workflow",
    event: "workflow_trigger_received",
    meta: {
      triggerType: event.type,
      triggerSource: event.source,
      definitionsCount: definitions.length,
      matchedCount: matched.length,
      skippedCount: skippedKeys.length,
    },
  });

  for (const definition of matched) {
    try {
      const run = await runWorkflow(definition, event);
      runs.push(run);
    } catch (error) {
      const startedAt = nowIso();
      const failedRecord: WorkflowExecutionRecord = {
        runId: buildRunId(definition.workflowKey),
        workflowKey: definition.workflowKey,
        title: definition.title,
        triggerType: event.type,
        triggerSource: event.source,
        triggerAt: event.at ?? startedAt,
        triggerPayload: event.payload ?? null,
        status: "error",
        startedAt,
        completedAt: nowIso(),
        durationMs: 0,
        actions: [],
        retries: 0,
        warnings: [],
        error: error instanceof Error ? error.message : String(error),
      };
      await persistExecution(failedRecord);
      runs.push(failedRecord);
    }
  }

  return {
    accepted: true,
    event,
    matchedWorkflowKeys: matched.map((item) => item.workflowKey),
    skippedWorkflowKeys: skippedKeys,
    runs,
  };
}

export async function emitWorkflowTrigger(event: WorkflowTriggerEvent) {
  try {
    return await runWorkflowsForTrigger(event);
  } catch (error) {
    emitObservabilityEvent({
      domain: "workflow",
      level: "error",
      event: "workflow_trigger_failed",
      meta: {
        triggerType: event.type,
        triggerSource: event.source,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      accepted: false,
      event,
      matchedWorkflowKeys: [],
      skippedWorkflowKeys: [],
      runs: [],
    } satisfies WorkflowDispatchResult;
  }
}

export function getWorkflowDefaultRetryPolicy(): WorkflowRetryPolicy {
  return {
    maxAttempts: 2,
    delayMs: 800,
  };
}

export function getWorkflowRunWhereInput(filters?: { workflowKey?: string; status?: string[] }) {
  const where: {
    cronName: { startsWith: string } | { equals: string };
    status?: { in: string[] };
  } = {
    cronName: { startsWith: "workflow:" },
  };

  if (filters?.workflowKey?.trim()) {
    where.cronName = { equals: `workflow:${filters.workflowKey.trim()}` };
  }
  if (filters?.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }
  return where;
}
