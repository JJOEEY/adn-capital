import { WorkflowCondition, WorkflowDefinition, WorkflowRetryPolicy, WorkflowTriggerEvent } from "./types";

const DEFAULT_RETRY_POLICY: WorkflowRetryPolicy = {
  maxAttempts: 2,
  delayMs: 800,
};

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function getValueByPath(input: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  const normalized = path.trim().replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);
  let current: unknown = input;
  for (const segment of segments) {
    if (current == null) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function compareNumber(value: unknown, predicate: number, op: "gt" | "gte" | "lt" | "lte") {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  if (op === "gt") return value > predicate;
  if (op === "gte") return value >= predicate;
  if (op === "lt") return value < predicate;
  return value <= predicate;
}

export function matchesCondition(condition: WorkflowCondition, event: WorkflowTriggerEvent) {
  const value = getValueByPath({ event, payload: event.payload ?? {} }, condition.path);
  if (condition.equals !== undefined && value !== condition.equals) return false;
  if (condition.notEquals !== undefined && value === condition.notEquals) return false;
  if (condition.gt !== undefined && !compareNumber(value, condition.gt, "gt")) return false;
  if (condition.gte !== undefined && !compareNumber(value, condition.gte, "gte")) return false;
  if (condition.lt !== undefined && !compareNumber(value, condition.lt, "lt")) return false;
  if (condition.lte !== undefined && !compareNumber(value, condition.lte, "lte")) return false;
  if (condition.includes !== undefined) {
    if (Array.isArray(value)) {
      if (!value.includes(condition.includes)) return false;
    } else if (typeof value === "string") {
      if (!value.includes(String(condition.includes))) return false;
    } else {
      return false;
    }
  }
  return true;
}

export function shouldRunConditions(workflow: WorkflowDefinition, event: WorkflowTriggerEvent) {
  if (!workflow.conditions || workflow.conditions.length === 0) return true;
  return workflow.conditions.every((condition) => matchesCondition(condition, event));
}

export function resolveRetryPolicy(
  workflowRetry?: Partial<WorkflowRetryPolicy>,
  actionRetry?: Partial<WorkflowRetryPolicy>,
): WorkflowRetryPolicy {
  const maxAttempts = actionRetry?.maxAttempts ?? workflowRetry?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts;
  const delayMs = actionRetry?.delayMs ?? workflowRetry?.delayMs ?? DEFAULT_RETRY_POLICY.delayMs;
  return {
    maxAttempts: Math.max(1, Math.floor(maxAttempts)),
    delayMs: Math.max(0, Math.floor(delayMs)),
  };
}

function interpolatePath(input: string, event: WorkflowTriggerEvent) {
  return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawPath: string) => {
    const value = getValueByPath({ event, payload: event.payload ?? {} }, rawPath.trim());
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  });
}

export function resolveTemplateString(input: unknown, event: WorkflowTriggerEvent) {
  if (typeof input !== "string") return "";
  return interpolatePath(input, event);
}

