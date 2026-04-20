import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";
import { getTopicEnvelope } from "@/lib/datahub/core";
import {
  buildDnseBrokerTopicKeys,
  buildDnseBrokerTopicKeysV2,
  buildDnseCurrentUserAliasTopicKeys,
} from "@/lib/brokers/dnse/topics";
import { getDnseExecutionFlags } from "@/lib/brokers/dnse/flags";
import { getDnseExecutionRolloutSnapshot } from "@/lib/brokers/dnse/rollout";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type DebugEvent = {
  id: string;
  action: string;
  description: string;
  author: string;
  createdAt: string;
  intent: JsonRecord | null;
  validation: JsonRecord | null;
  preview: JsonRecord | null;
  submit: JsonRecord | null;
  payload: JsonRecord | null;
  userId: string | null;
  accountId: string | null;
  ticker: string | null;
  intentId: string | null;
  previewId: string | null;
};

function parseJson(value: string | null): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDateParam(value: string | null, endOfDay = false): Date | null {
  const raw = pickString(value);
  if (!raw) return null;
  const withTime = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`
    : raw;
  const date = new Date(withTime);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseListParam(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAuditEvent(row: {
  id: string;
  action: string;
  description: string;
  author: string;
  diff: string | null;
  createdAt: Date;
}): DebugEvent {
  const payload = parseJson(row.diff);
  const ticket = toRecord(payload?.ticket);
  const previewFromTicket = toRecord(ticket?.preview);
  const intentFromTicket = toRecord(ticket?.intent);
  const validationFromTicket = toRecord(ticket?.validation);
  const intent =
    toRecord(payload?.intent) ??
    toRecord(toRecord(payload?.validation)?.normalizedIntent) ??
    intentFromTicket;
  const validation = toRecord(payload?.validation) ?? validationFromTicket;
  const preview = toRecord(payload?.preview) ?? previewFromTicket;
  const submit = toRecord(payload?.submit) ?? toRecord(payload?.order);

  const intentId =
    pickString(intent?.intentId) ??
    pickString(submit?.intentId) ??
    pickString(toRecord(preview?.intent)?.intentId) ??
    null;
  const previewId =
    pickString(preview?.previewId) ??
    pickString(submit?.previewId) ??
    null;
  const userId =
    pickString(payload?.targetUserId) ??
    pickString(payload?.actorUserId) ??
    pickString(intent?.userId) ??
    null;
  const accountId =
    pickString(intent?.accountId) ??
    pickString(submit?.accountId) ??
    pickString(toRecord(preview?.intent)?.accountId) ??
    null;
  const ticker =
    pickString(intent?.ticker) ??
    pickString(submit?.ticker) ??
    pickString(toRecord(preview?.intent)?.ticker) ??
    null;

  return {
    id: row.id,
    action: row.action,
    description: row.description,
    author: row.author,
    createdAt: row.createdAt.toISOString(),
    intent,
    validation,
    preview,
    submit,
    payload,
    userId,
    accountId,
    ticker,
    intentId,
    previewId,
  };
}

function filterEvents(events: DebugEvent[], filters: {
  userId?: string | null;
  accountId?: string | null;
  ticker?: string | null;
  actions?: string[];
}) {
  const accountId = filters.accountId ? filters.accountId.trim() : null;
  const ticker = filters.ticker ? filters.ticker.trim().toUpperCase() : null;
  const actionSet = new Set((filters.actions ?? []).map((item) => item.trim()).filter(Boolean));
  return events.filter((item) => {
    if (filters.userId && item.userId !== filters.userId) return false;
    if (accountId && item.accountId !== accountId) return false;
    if (ticker && (item.ticker ?? "").toUpperCase() !== ticker) return false;
    if (actionSet.size > 0 && !actionSet.has(item.action)) return false;
    return true;
  });
}

function buildDecisionChains(events: DebugEvent[]) {
  const chains = new Map<string, {
    chainKey: string;
    intentId: string | null;
    previewId: string | null;
    userId: string | null;
    accountId: string | null;
    ticker: string | null;
    startedAt: string;
    lastAt: string;
    steps: Array<{
      action: string;
      at: string;
      validationStatus: string | null;
      submitStatus: string | null;
      reason: string | null;
    }>;
  }>();

  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const event of sorted) {
    const chainKey = event.intentId || event.previewId || `event:${event.id}`;
    const existing = chains.get(chainKey);
    const step = {
      action: event.action,
      at: event.createdAt,
      validationStatus: pickString(event.validation?.status),
      submitStatus: pickString(event.submit?.status),
      reason: pickString(event.payload?.reason) ?? pickString(event.payload?.warning),
    };
    if (!existing) {
      chains.set(chainKey, {
        chainKey,
        intentId: event.intentId,
        previewId: event.previewId,
        userId: event.userId,
        accountId: event.accountId,
        ticker: event.ticker,
        startedAt: event.createdAt,
        lastAt: event.createdAt,
        steps: [step],
      });
      continue;
    }
    existing.steps.push(step);
    existing.lastAt = event.createdAt;
    if (!existing.userId && event.userId) existing.userId = event.userId;
    if (!existing.accountId && event.accountId) existing.accountId = event.accountId;
    if (!existing.ticker && event.ticker) existing.ticker = event.ticker;
  }

  return Array.from(chains.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

async function resolveTargetUser(targetUserId: string | null) {
  if (targetUserId) {
    return prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        dnseId: true,
        dnseVerified: true,
      },
    });
  }

  return prisma.user.findFirst({
    where: {
      dnseVerified: true,
      dnseId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      dnseId: true,
      dnseVerified: true,
    },
  });
}

async function buildRuntimeDependencyAudit(args: {
  hasConnectedDnseUser: boolean;
  targetUser: {
    id: string;
    email: string;
    dnseId: string | null;
  } | null;
}) {
  const flags = getDnseExecutionFlags();
  const env = process.env;
  const rollout = await getDnseExecutionRolloutSnapshot({
    userId: args.targetUser?.id ?? "__missing_user__",
    email: args.targetUser?.email ?? null,
    accountId: args.targetUser?.dnseId ?? null,
  });
  const dependencies = {
    NEXTAUTH_URL: Boolean(env.NEXTAUTH_URL),
    AUTH_TRUST_HOST: Boolean(env.AUTH_TRUST_HOST),
    DATABASE_URL: Boolean(env.DATABASE_URL?.startsWith("postgres://") || env.DATABASE_URL?.startsWith("postgresql://")),
    DIRECT_DATABASE_URL: Boolean(
      env.DIRECT_DATABASE_URL?.startsWith("postgres://") || env.DIRECT_DATABASE_URL?.startsWith("postgresql://"),
    ),
    DNSE_API_KEY: Boolean(env.DNSE_API_KEY),
    DNSE_TOKEN_ENCRYPTION_KEY: Boolean(env.DNSE_TOKEN_ENCRYPTION_KEY),
    DNSE_OAUTH_AUTHORIZE_URL: Boolean(env.DNSE_OAUTH_AUTHORIZE_URL),
    DNSE_OAUTH_TOKEN_URL: Boolean(env.DNSE_OAUTH_TOKEN_URL),
    DNSE_OAUTH_CLIENT_ID: Boolean(env.DNSE_OAUTH_CLIENT_ID),
    DNSE_OAUTH_CLIENT_SECRET: Boolean(env.DNSE_OAUTH_CLIENT_SECRET),
    DNSE_BROKER_BALANCE_URL: Boolean(env.DNSE_BROKER_BALANCE_URL),
    DNSE_BROKER_HOLDINGS_URL: Boolean(env.DNSE_BROKER_HOLDINGS_URL),
    DNSE_BROKER_ORDERS_URL: Boolean(env.DNSE_BROKER_ORDERS_URL),
    DNSE_ORDER_SUBMIT_URL: Boolean(env.DNSE_ORDER_SUBMIT_URL),
    DNSE_MANUAL_TEST_JWT_TOKEN: Boolean(env.DNSE_MANUAL_TEST_JWT_TOKEN),
    DNSE_MANUAL_TEST_TRADING_TOKEN: Boolean(env.DNSE_MANUAL_TEST_TRADING_TOKEN),
  };
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!dependencies.DATABASE_URL) blockers.push("missing_or_invalid_DATABASE_URL");
  if (!dependencies.DIRECT_DATABASE_URL) blockers.push("missing_or_invalid_DIRECT_DATABASE_URL");
  if (!dependencies.NEXTAUTH_URL) blockers.push("missing_NEXTAUTH_URL");
  if (!dependencies.AUTH_TRUST_HOST) blockers.push("missing_AUTH_TRUST_HOST_for_local_or_proxy_runtime");
  if (!dependencies.DNSE_API_KEY) warnings.push("missing_DNSE_API_KEY");
  if (!dependencies.DNSE_TOKEN_ENCRYPTION_KEY) blockers.push("missing_DNSE_TOKEN_ENCRYPTION_KEY");
  if (!dependencies.DNSE_OAUTH_AUTHORIZE_URL) blockers.push("missing_DNSE_OAUTH_AUTHORIZE_URL");
  if (!dependencies.DNSE_OAUTH_TOKEN_URL) blockers.push("missing_DNSE_OAUTH_TOKEN_URL");
  if (!dependencies.DNSE_OAUTH_CLIENT_ID) blockers.push("missing_DNSE_OAUTH_CLIENT_ID");
  if (!dependencies.DNSE_OAUTH_CLIENT_SECRET) blockers.push("missing_DNSE_OAUTH_CLIENT_SECRET");
  if (!dependencies.DNSE_BROKER_BALANCE_URL) warnings.push("missing_DNSE_BROKER_BALANCE_URL");
  if (!dependencies.DNSE_BROKER_HOLDINGS_URL) warnings.push("missing_DNSE_BROKER_HOLDINGS_URL");
  if (!dependencies.DNSE_BROKER_ORDERS_URL) warnings.push("missing_DNSE_BROKER_ORDERS_URL");
  if (!args.hasConnectedDnseUser) blockers.push("no_dnse_verified_user_found");
  if (rollout.killSwitchEnabled) blockers.push("execution_kill_switch_enabled");
  if (rollout.allowlistEnforced && rollout.allowlistEmpty) blockers.push("pilot_allowlist_empty");
  if (!rollout.pilotEligible) blockers.push("pilot_allowlist_required");
  if (!flags.complianceApprovedFlow) warnings.push("compliance_flow_not_approved_real_submit_remains_blocked");

  const expectedSubmitStatus = rollout.killSwitchEnabled
    ? "blocked_not_enabled"
    : !rollout.pilotEligible
      ? "blocked_not_enabled"
      : !flags.realOrderSubmitEnabled
        ? flags.configuredRealSubmitEnabled && !flags.complianceApprovedFlow
          ? "approval_required"
          : "blocked_not_enabled"
        : !flags.manualTestTokenMode
          ? "approval_required"
          : "accepted_or_rejected_from_dnse";

  const requirements = {
    appHealth: {
      required: ["DATABASE_URL(postgres)", "DIRECT_DATABASE_URL(postgres)"],
      pass: dependencies.DATABASE_URL && dependencies.DIRECT_DATABASE_URL,
    },
    authSession: {
      required: ["NEXTAUTH_URL", "AUTH_TRUST_HOST"],
      pass: dependencies.NEXTAUTH_URL && dependencies.AUTH_TRUST_HOST,
      notes: "user/admin session cookies are required for protected routes",
    },
    brokerTopicHydration: {
      required: ["DNSE linked user"],
      pass: args.hasConnectedDnseUser,
    },
    pilotRollout: {
      required: ["DNSE_EXECUTION_ALLOWLIST_*", "DNSE_EXECUTION_KILL_SWITCH=false"],
      pass: rollout.pilotEligible,
    },
    complianceGate: {
      required: ["DNSE_COMPLIANCE_APPROVED_FLOW=true before real submit"],
      pass: flags.complianceApprovedFlow,
    },
    executionSafeDefaults: {
      required: [
        "DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE",
        "DNSE_REAL_ORDER_SUBMIT_ENABLED=false",
      ],
      pass:
        flags.mode === "SAFE_EXECUTION_ADAPTER_MODE" &&
        !flags.realOrderSubmitEnabled,
    },
  };

  return {
    mode: flags.mode,
    flags,
    rollout,
    dependencies,
    requirements,
    blockers,
    warnings,
    canRunStagingSafeFlow: blockers.length === 0,
    expectedSubmitStatus,
  };
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUserId = pickString(req.nextUrl.searchParams.get("targetUserId"));
  const filterUserId = pickString(req.nextUrl.searchParams.get("userId"));
  const filterAccountId = pickString(req.nextUrl.searchParams.get("accountId"));
  const filterTicker = pickString(req.nextUrl.searchParams.get("ticker"));
  const filterActions = parseListParam(req.nextUrl.searchParams.get("actions"));
  const from = parseDateParam(req.nextUrl.searchParams.get("from"), false);
  const to = parseDateParam(req.nextUrl.searchParams.get("to"), true);
  const includeTopicHydration = req.nextUrl.searchParams.get("withTopics") !== "0";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(20, Math.trunc(limitRaw))) : 200;

  const targetUser = await resolveTargetUser(targetUserId);
  const runtime = await buildRuntimeDependencyAudit({
    hasConnectedDnseUser: Boolean(targetUser),
    targetUser: targetUser
      ? { id: targetUser.id, email: targetUser.email, dnseId: targetUser.dnseId }
      : null,
  });

  if (!targetUser) {
    return NextResponse.json({
      ok: false,
      message: "No DNSE connected user found",
      runtime,
    });
  }

  const accountId = targetUser.dnseId?.trim() || "";
  const topicsV2 = accountId ? buildDnseBrokerTopicKeysV2(targetUser.id, accountId) : [];
  const topicsV1 = accountId ? buildDnseBrokerTopicKeys(accountId) : [];
  const aliases = buildDnseCurrentUserAliasTopicKeys();
  const topicKeys = [...topicsV2, ...topicsV1, ...aliases];

  const topicEnvelopes =
    includeTopicHydration && topicKeys.length > 0
      ? await Promise.all(
          topicKeys.map(async (topic) => {
            const envelope = await getTopicEnvelope(topic, {
              userId: targetUser.id,
              force: true,
            });
            return {
              topic: envelope.topic,
              source: envelope.source,
              freshness: envelope.freshness,
              hasValue: envelope.value != null,
              error: envelope.error ?? null,
              updatedAt: envelope.updatedAt,
              expiresAt: envelope.expiresAt,
            };
          }),
        )
      : [];

  const where: Record<string, unknown> = {
    component: "DNSE_EXECUTION",
  };
  if (targetUserId) {
    where.OR = [{ author: targetUserId }, { diff: { contains: targetUserId } }];
  }
  if (filterActions.length > 0) {
    where.action = { in: filterActions };
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const auditRows = await prisma.changelog.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      description: true,
      author: true,
      diff: true,
      createdAt: true,
    },
  });

  const normalizedEvents = auditRows.map((row) => normalizeAuditEvent(row));
  const filteredEvents = filterEvents(normalizedEvents, {
    userId: filterUserId,
    accountId: filterAccountId,
    ticker: filterTicker,
    actions: filterActions,
  });

  const latestByAction = {
    parse:
      filteredEvents.find((item) =>
        item.action === "parse_intent" || item.action === "parse_blocked_kill_switch",
      ) ?? null,
    validate:
      filteredEvents.find((item) =>
        item.action === "validate_intent" || item.action === "validate_blocked_kill_switch",
      ) ?? null,
    preview:
      filteredEvents.find((item) =>
        item.action === "preview_order" || item.action === "preview_blocked_kill_switch",
      ) ?? null,
    submit:
      filteredEvents.find((item) =>
        [
          "submit_accepted",
          "submit_rejected",
          "submit_degraded",
          "submit_blocked_not_enabled",
          "submit_approval_required",
          "submit_error",
        ].includes(item.action),
      ) ?? null,
  };

  return NextResponse.json({
    ok: true,
    runtime,
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      dnseId: targetUser.dnseId,
      dnseVerified: targetUser.dnseVerified,
    },
    topics: {
      expected: topicKeys,
      hydrated: topicEnvelopes,
    },
    readModel: {
      filters: {
        targetUserId,
        userId: filterUserId,
        accountId: filterAccountId,
        ticker: filterTicker,
        actions: filterActions,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        limit,
      },
      latest: latestByAction,
      events: filteredEvents,
      chains: buildDecisionChains(filteredEvents),
    },
  });
}
