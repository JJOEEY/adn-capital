export type WorkflowTriggerType =
  | "cron"
  | "signal_status_changed"
  | "market_threshold"
  | "portfolio_risk_threshold"
  | "brief_ready";

export type WorkflowActionType =
  | "invalidate_topic"
  | "refresh_topic"
  | "run_scanner"
  | "create_notification"
  | "send_telegram"
  | "persist_report"
  | "write_log";

export type WorkflowExecutionStatus = "success" | "error" | "skipped";

export interface WorkflowRetryPolicy {
  maxAttempts: number;
  delayMs: number;
}

export interface WorkflowTriggerEvent {
  type: WorkflowTriggerType;
  source: string;
  at?: string;
  payload?: Record<string, unknown>;
}

export interface WorkflowTriggerDefinition {
  type: WorkflowTriggerType;
  config?: Record<string, unknown>;
}

export interface WorkflowCondition {
  path: string;
  equals?: unknown;
  notEquals?: unknown;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  includes?: string | number | boolean;
}

export interface WorkflowActionDefinition {
  actionKey?: string;
  type: WorkflowActionType;
  params?: Record<string, unknown>;
  continueOnError?: boolean;
  deterministic?: boolean;
  retryPolicy?: Partial<WorkflowRetryPolicy>;
}

export interface WorkflowDefinition {
  workflowKey: string;
  title: string;
  enabled: boolean;
  trigger: WorkflowTriggerDefinition;
  conditions?: WorkflowCondition[];
  actions: WorkflowActionDefinition[];
  retryPolicy?: Partial<WorkflowRetryPolicy>;
  tags?: string[];
}

export interface WorkflowContext {
  event: WorkflowTriggerEvent;
  workflow: WorkflowDefinition;
  runId: string;
}

export interface WorkflowActionExecutionResult {
  actionKey: string;
  type: WorkflowActionType;
  status: "success" | "error" | "skipped";
  deterministic: boolean;
  attempts: number;
  retryable: boolean;
  continueOnError: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  data?: Record<string, unknown> | null;
  warning?: string | null;
  error?: string | null;
}

export interface WorkflowExecutionRecord {
  runId: string;
  workflowKey: string;
  title: string;
  triggerType: WorkflowTriggerType;
  triggerSource: string;
  triggerAt: string;
  triggerPayload: Record<string, unknown> | null;
  status: WorkflowExecutionStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  actions: WorkflowActionExecutionResult[];
  retries: number;
  warnings: string[];
  error?: string | null;
}

export interface WorkflowDispatchResult {
  accepted: boolean;
  event: WorkflowTriggerEvent;
  matchedWorkflowKeys: string[];
  skippedWorkflowKeys: string[];
  runs: WorkflowExecutionRecord[];
}

