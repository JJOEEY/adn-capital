import { prisma } from "@/lib/prisma";
import { getTopicEnvelope, invalidateTopics } from "@/lib/datahub/core";
import { pushNotification, saveMarketReport } from "@/lib/cronHelpers";
import { sendTelegramOnce, telegramHash } from "@/lib/telegram/dispatch";
import { resolveTemplateString } from "./helpers";
import { WorkflowActionDefinition, WorkflowActionType, WorkflowContext } from "./types";

type ActionHandlerResult = {
  status: "success" | "error" | "skipped";
  retryable: boolean;
  deterministic: boolean;
  data?: Record<string, unknown> | null;
  warning?: string | null;
  error?: string | null;
};

type ActionHandler = (action: WorkflowActionDefinition, context: WorkflowContext) => Promise<ActionHandlerResult>;

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(lowered)) return true;
    if (["0", "false", "no", "off"].includes(lowered)) return false;
  }
  return fallback;
}

function toStringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function resolveRunSummary(context: WorkflowContext) {
  const event = context.event;
  return {
    workflowKey: context.workflow.workflowKey,
    triggerType: event.type,
    triggerSource: event.source,
    triggerAt: event.at ?? new Date().toISOString(),
  };
}

const invalidateTopicAction: ActionHandler = async (action) => {
  const topics = normalizeStringArray(action.params?.topics);
  const tags = normalizeStringArray(action.params?.tags);
  const prefixes = normalizeStringArray(action.params?.prefixes);
  const result = invalidateTopics({ topics, tags, prefixes });
  return {
    status: "success",
    retryable: false,
    deterministic: true,
    data: {
      topics,
      tags,
      prefixes,
      result,
    },
  };
};

const refreshTopicAction: ActionHandler = async (action, context) => {
  const topics = normalizeStringArray(action.params?.topics);
  if (topics.length === 0) {
    return {
      status: "skipped",
      retryable: false,
      deterministic: true,
      warning: "No topics configured",
      data: null,
    };
  }
  const userId = toStringValue(action.params?.userId || context.event.payload?.userId, "").trim() || undefined;
  const envelopes = await Promise.all(
    topics.map((topic) => getTopicEnvelope(topic, { force: true, userId })),
  );
  return {
    status: "success",
    retryable: false,
    deterministic: true,
    data: {
      topics,
      userId: userId ?? null,
      refreshed: envelopes.length,
    },
  };
};

const runScannerAction: ActionHandler = async (action, context) => {
  const disallowRecursive = context.event.type === "cron" && !toBoolean(action.params?.allowDuringCron, false);
  if (disallowRecursive) {
    return {
      status: "skipped",
      retryable: false,
      deterministic: true,
      warning: "Scanner action skipped during cron-triggered workflow to avoid recursion",
      data: null,
    };
  }

  const cronTypeRaw = toStringValue(action.params?.cronType, "signal_scan_type1").trim();
  if (!cronTypeRaw) {
    return {
      status: "error",
      retryable: false,
      deterministic: true,
      error: "Missing cronType",
      data: null,
    };
  }

  const baseUrl = (
    process.env.WORKFLOW_INTERNAL_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET ?? process.env.INTERNAL_API_KEY ?? "";
  if (!cronSecret) {
    return {
      status: "error",
      retryable: false,
      deterministic: true,
      error: "CRON_SECRET/INTERNAL_API_KEY missing",
      data: null,
    };
  }

  const sync = toBoolean(action.params?.sync, true);
  const force = toBoolean(action.params?.force, false);
  const url = new URL(`${baseUrl}/api/cron`);
  url.searchParams.set("type", cronTypeRaw);
  if (sync) url.searchParams.set("sync", "1");
  if (force) url.searchParams.set("force", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-cron-secret": cronSecret,
    },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      status: "error",
      retryable: true,
      deterministic: true,
      error: `run_scanner_failed_http_${response.status}`,
      data: payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null,
    };
  }

  return {
    status: "success",
    retryable: false,
    deterministic: true,
    data: {
      cronType: cronTypeRaw,
      responseStatus: response.status,
      payload: payload && typeof payload === "object" ? payload : null,
    },
  };
};

const createNotificationAction: ActionHandler = async (action, context) => {
  const event = context.event;
  const type = resolveTemplateString(action.params?.type ?? event.type, event) || event.type;
  const title =
    resolveTemplateString(action.params?.title ?? `Workflow ${context.workflow.workflowKey}`, event) ||
    `Workflow ${context.workflow.workflowKey}`;
  const content =
    resolveTemplateString(
      action.params?.content ??
        `Workflow ${context.workflow.workflowKey} triggered by ${event.type} (${event.source}).`,
      event,
    ) || `Workflow ${context.workflow.workflowKey}`;

  const notificationId = await pushNotification(type, title, content);
  return {
    status: notificationId ? "success" : "error",
    retryable: !notificationId,
    deterministic: false,
    data: {
      notificationId,
      type,
      title,
    },
    error: notificationId ? null : "notification_create_failed",
  };
};

function resolveTelegramEventType(context: WorkflowContext) {
  const reportType = String(context.event.payload?.reportType ?? "").toLowerCase();
  if (context.event.type === "brief_ready") {
    if (reportType.includes("morning")) return "MORNING_BRIEF";
    if (reportType.includes("15h")) return "EOD_15H";
    if (reportType.includes("19h") || reportType.includes("eod")) return "EOD_19H";
  }
  if (context.workflow.workflowKey === "signal-active-notify") return "SIGNAL_ACTIVE";
  return `WORKFLOW:${context.workflow.workflowKey}`;
}

function resolveTelegramTradingDate(context: WorkflowContext) {
  const payload = context.event.payload ?? {};
  const raw =
    payload.tradingDate ??
    payload.date ??
    payload.reportDate ??
    payload.targetDate ??
    context.event.at ??
    new Date().toISOString();
  return String(raw).slice(0, 10);
}

function resolveTelegramSlot(context: WorkflowContext) {
  const payload = context.event.payload ?? {};
  const raw = payload.slot ?? payload.slotLabel ?? payload.reportSlot ?? null;
  return raw == null ? null : String(raw);
}

function resolveTelegramEventKey(
  action: WorkflowActionDefinition,
  context: WorkflowContext,
  text: string,
) {
  const explicit = resolveTemplateString(action.params?.eventKey ?? "", context.event).trim();
  if (explicit) return explicit;

  const eventType = resolveTelegramEventType(context);
  const tradingDate = resolveTelegramTradingDate(context);
  if (eventType === "MORNING_BRIEF" || eventType === "EOD_15H" || eventType === "EOD_19H") {
    return `${eventType}:${tradingDate}`;
  }

  const payload = context.event.payload ?? {};
  if (eventType === "SIGNAL_ACTIVE" && payload.ticker) {
    return `SIGNAL_ACTIVE:${tradingDate}:${String(payload.ticker).toUpperCase()}:${String(
      payload.signalType ?? payload.type ?? "UNKNOWN",
    ).toUpperCase()}`;
  }

  return `${eventType}:${context.event.type}:${telegramHash(text).slice(0, 16)}`;
}

function toTelegramPlainText(text: string) {
  return text
    .replace(/\\([\\`*_{}\[\]()#+\-.!|])/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const sendTelegramAction: ActionHandler = async (action, context) => {
  const token = (
    process.env.TELEGRAM_SUPPORT_BOT_TOKEN ??
    process.env.ADN_SUPPORT_TELEGRAM_BOT_TOKEN ??
    process.env.TELEGRAM_SIGNAL_BOT_TOKEN ??
    ""
  ).trim();
  const chatId = (
    process.env.TELEGRAM_SUPPORT_CHAT_ID ??
    process.env.ADN_SUPPORT_TELEGRAM_CHAT_ID ??
    process.env.TELEGRAM_SIGNAL_CHAT_ID ??
    ""
  ).trim();

  if (!token || !chatId) {
    return {
      status: "skipped",
      retryable: false,
      deterministic: false,
      warning: "support_telegram_not_configured",
      data: null,
    };
  }

  const rawText =
    resolveTemplateString(
      action.params?.text ??
        action.params?.message ??
        `Workflow ${context.workflow.workflowKey} triggered by ${context.event.type}.`,
      context.event,
    ) || `Workflow ${context.workflow.workflowKey}`;
  const text = toTelegramPlainText(rawText);

  const eventType = resolveTelegramEventType(context);
  const eventKey = resolveTelegramEventKey(action, context, text);
  const result = await sendTelegramOnce({
    eventType,
    eventKey,
    text,
    token,
    chatId,
    tradingDate: resolveTelegramTradingDate(context),
    slot: resolveTelegramSlot(context),
  });

  if (result.ok && "skipped" in result && result.skipped) {
    return {
      status: "skipped",
      retryable: false,
      deterministic: true,
      warning: result.reason,
      data: { eventKey, eventType },
    };
  }
  if (!result.ok) {
    return {
      status: "error",
      retryable: true,
      deterministic: false,
      error: result.error,
      data: { eventKey, eventType },
    };
  }

  return {
    status: "success",
    retryable: false,
    deterministic: false,
    data: { eventKey, eventType },
  };
};

const persistReportAction: ActionHandler = async (action, context) => {
  const event = context.event;
  const reportType =
    resolveTemplateString(action.params?.reportType ?? event.payload?.reportType ?? "workflow_report", event) ||
    "workflow_report";
  const title =
    resolveTemplateString(action.params?.title ?? event.payload?.title ?? `Workflow Report ${reportType}`, event) ||
    `Workflow Report ${reportType}`;
  const content =
    resolveTemplateString(
      action.params?.content ??
        event.payload?.content ??
        `Workflow ${context.workflow.workflowKey} generated report for ${reportType}.`,
      event,
    ) || "";
  const dedupeWindowMinutes = Number(action.params?.dedupeWindowMinutes ?? 30);
  const dedupeEnabled = toBoolean(action.params?.dedupe, true);

  if (dedupeEnabled && content.trim()) {
    const cutoff = new Date(Date.now() - Math.max(1, dedupeWindowMinutes) * 60_000);
    const existing = await prisma.marketReport.findFirst({
      where: {
        type: reportType,
        title,
        content,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });
    if (existing) {
      return {
        status: "skipped",
        retryable: false,
        deterministic: true,
        warning: "Duplicate report skipped by dedupe window",
        data: { existingId: existing.id },
      };
    }
  }

  const saved = await saveMarketReport(
    reportType,
    title,
    content || `Workflow ${context.workflow.workflowKey} (${reportType})`,
    event.payload ?? null,
    { workflow: resolveRunSummary(context), actionParams: action.params ?? null },
  );

  return {
    status: saved ? "success" : "error",
    retryable: !saved,
    deterministic: true,
    data: {
      reportId: saved?.id ?? null,
      reportType,
      title,
    },
    error: saved ? null : "persist_report_failed",
  };
};

const writeLogAction: ActionHandler = async (action, context) => {
  const event = context.event;
  const description =
    resolveTemplateString(
      action.params?.description ??
        `Workflow ${context.workflow.workflowKey} executed (${event.type} from ${event.source}).`,
      event,
    ) || `Workflow ${context.workflow.workflowKey}`;
  const actionName = resolveTemplateString(action.params?.action ?? "WORKFLOW_ACTION", event) || "WORKFLOW_ACTION";

  const row = await prisma.changelog.create({
    data: {
      component: "WORKFLOW_RUNTIME",
      action: actionName,
      description,
      author: "system",
      diff: JSON.stringify({
        workflow: resolveRunSummary(context),
        eventPayload: event.payload ?? null,
        actionParams: action.params ?? null,
      }),
    },
    select: { id: true, createdAt: true },
  });

  return {
    status: "success",
    retryable: false,
    deterministic: true,
    data: {
      changelogId: row.id,
      createdAt: row.createdAt.toISOString(),
    },
  };
};

const ACTION_HANDLERS: Record<WorkflowActionType, ActionHandler> = {
  invalidate_topic: invalidateTopicAction,
  refresh_topic: refreshTopicAction,
  run_scanner: runScannerAction,
  create_notification: createNotificationAction,
  send_telegram: sendTelegramAction,
  persist_report: persistReportAction,
  write_log: writeLogAction,
};

export async function executeWorkflowAction(action: WorkflowActionDefinition, context: WorkflowContext) {
  const handler = ACTION_HANDLERS[action.type];
  if (!handler) {
    return {
      status: "error" as const,
      retryable: false,
      deterministic: action.deterministic ?? true,
      error: `unsupported_action:${action.type}`,
      data: null,
    };
  }
  return handler(action, context);
}
