import { WorkflowTriggerDefinition, WorkflowTriggerEvent, WorkflowTriggerType } from "./types";
import { getValueByPath } from "./helpers";

type TriggerMatcher = (definition: WorkflowTriggerDefinition, event: WorkflowTriggerEvent) => boolean;

function toArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const MATCHERS: Record<WorkflowTriggerType, TriggerMatcher> = {
  cron: (definition, event) => {
    const cronType = String((event.payload?.cronType ?? "")).trim();
    if (!cronType) return false;
    const accepted = toArray(definition.config?.cronTypes ?? definition.config?.cronType);
    if (accepted.length === 0) return true;
    return accepted.includes(cronType);
  },
  signal_status_changed: (definition, event) => {
    const fromStatus = String((event.payload?.fromStatus ?? "")).trim().toUpperCase();
    const toStatus = String((event.payload?.toStatus ?? "")).trim().toUpperCase();
    if (!toStatus) return false;
    const fromStatuses = toArray(definition.config?.fromStatuses).map((item) => item.toUpperCase());
    const toStatuses = toArray(definition.config?.toStatuses).map((item) => item.toUpperCase());
    if (fromStatuses.length > 0 && !fromStatuses.includes(fromStatus)) return false;
    if (toStatuses.length > 0 && !toStatuses.includes(toStatus)) return false;
    return true;
  },
  market_threshold: (definition, event) => {
    const metricPath = String(definition.config?.metricPath ?? "payload.value");
    const metric = asNumber(getValueByPath({ event, payload: event.payload ?? {} }, metricPath));
    const threshold = asNumber(definition.config?.value);
    const op = String(definition.config?.op ?? "gte");
    if (metric == null || threshold == null) return false;
    if (op === "gt") return metric > threshold;
    if (op === "lt") return metric < threshold;
    if (op === "lte") return metric <= threshold;
    return metric >= threshold;
  },
  portfolio_risk_threshold: (definition, event) => {
    const riskPath = String(definition.config?.metricPath ?? "payload.riskPercent");
    const riskValue = asNumber(getValueByPath({ event, payload: event.payload ?? {} }, riskPath));
    const threshold = asNumber(definition.config?.value);
    const op = String(definition.config?.op ?? "gte");
    if (riskValue == null || threshold == null) return false;
    if (op === "gt") return riskValue > threshold;
    if (op === "lt") return riskValue < threshold;
    if (op === "lte") return riskValue <= threshold;
    return riskValue >= threshold;
  },
  brief_ready: (definition, event) => {
    const reportType = String((event.payload?.reportType ?? "")).trim();
    if (!reportType) return false;
    const accepted = toArray(definition.config?.reportTypes ?? definition.config?.reportType);
    if (accepted.length === 0) return true;
    return accepted.includes(reportType);
  },
};

export function triggerMatches(definition: WorkflowTriggerDefinition, event: WorkflowTriggerEvent) {
  if (definition.type !== event.type) return false;
  const matcher = MATCHERS[definition.type];
  return matcher ? matcher(definition, event) : false;
}

