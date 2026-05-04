import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { getTopicEnvelope, invalidateTopics } from "@/lib/datahub/core";
import { pushNotification, saveMarketReport } from "@/lib/cronHelpers";
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

function splitTelegramText(text: string, maxLength = 3900) {
  const chunks: string[] = [];
  let current = "";
  for (const part of text.split(/\n{2,}/)) {
    const next = current ? `${current}\n\n${part}` : part;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (part.length <= maxLength) {
      current = part;
      continue;
    }
    for (let i = 0; i < part.length; i += maxLength) {
      chunks.push(part.slice(i, i + maxLength));
    }
    current = "";
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLength)];
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

const sendTelegramAction: ActionHandler = async (action, context) => {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID ?? "";

  if (!token || !chatId) {
    return {
      status: "skipped",
      retryable: false,
      deterministic: false,
      warning: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured",
      data: null,
    };
  }

  const text =
    resolveTemplateString(
      action.params?.text ??
        action.params?.message ??
        `Workflow ${context.workflow.workflowKey} triggered by ${context.event.type}.`,
      context.event,
    ) || `Workflow ${context.workflow.workflowKey}`;

  const textHash = createHash("sha256").update(text).digest("hex").slice(0, 32);
  const dedupeWindowMinutes =
    Number(action.params?.dedupeWindowMinutes) ||
    (context.workflow.workflowKey === "signal-active-notify" ? 24 * 60 : 30);
  const dedupeCutoff = new Date(Date.now() - dedupeWindowMinutes * 60_000);
  const dedupeCronName = `telegram:${context.workflow.workflowKey}`;
  const existingSend = await prisma.cronLog.findFirst({
    where: {
      cronName: dedupeCronName,
      status: "success",
      createdAt: { gte: dedupeCutoff },
      resultData: { contains: textHash },
    },
    select: { id: true },
  });

  if (existingSend) {
    return {
      status: "skipped",
      retryable: false,
      deterministic: true,
      warning: "telegram_duplicate_suppressed",
      data: { textHash, dedupeWindowMinutes },
    };
  }

  const chunks = splitTelegramText(text);
  const sentPayloads: Record<string, unknown>[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const send = async (withMarkdown: boolean) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunks.length > 1 ? `${chunk}\n\n(${index + 1}/${chunks.length})` : chunk,
          ...(withMarkdown ? { parse_mode: "Markdown" } : {}),
          disable_web_page_preview: true,
        }),
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { response, payload };
    };

    let result = await send(true);
    if (!result.response.ok && result.response.status === 400) {
      result = await send(false);
    }
    if (!result.response.ok) {
      return {
        status: "error",
        retryable: true,
        deterministic: false,
        error: `telegram_http_${result.response.status}`,
        data: result.payload && typeof result.payload === "object" ? (result.payload as Record<string, unknown>) : null,
      };
    }
    if (result.payload && typeof result.payload === "object") {
      sentPayloads.push(result.payload as Record<string, unknown>);
    }
  }

  await prisma.cronLog.create({
    data: {
      cronName: dedupeCronName,
      status: "success",
      message: "telegram_sent",
      duration: 0,
      resultData: JSON.stringify({
        textHash,
        workflowKey: context.workflow.workflowKey,
        triggerType: context.event.type,
        triggerSource: context.event.source,
      }),
    },
  });

  return {
    status: "success",
    retryable: false,
    deterministic: false,
    data: { parts: chunks.length, payloads: sentPayloads },
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
