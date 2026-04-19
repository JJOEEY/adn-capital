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

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

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

function buildRuntimeDependencyAudit(hasConnectedDnseUser: boolean) {
  const flags = getDnseExecutionFlags();
  const env = process.env;
  const dependencies = {
    NEXTAUTH_URL: Boolean(env.NEXTAUTH_URL),
    AUTH_TRUST_HOST: Boolean(env.AUTH_TRUST_HOST),
    DATABASE_URL: Boolean(env.DATABASE_URL?.startsWith("postgres://") || env.DATABASE_URL?.startsWith("postgresql://")),
    DIRECT_DATABASE_URL: Boolean(
      env.DIRECT_DATABASE_URL?.startsWith("postgres://") || env.DIRECT_DATABASE_URL?.startsWith("postgresql://"),
    ),
    DNSE_API_KEY: Boolean(env.DNSE_API_KEY),
    DNSE_ORDER_SUBMIT_URL: Boolean(env.DNSE_ORDER_SUBMIT_URL),
    DNSE_MANUAL_TEST_JWT_TOKEN: Boolean(env.DNSE_MANUAL_TEST_JWT_TOKEN),
    DNSE_MANUAL_TEST_TRADING_TOKEN: Boolean(env.DNSE_MANUAL_TEST_TRADING_TOKEN),
  };
  const blockers: string[] = [];
  if (!dependencies.DATABASE_URL) blockers.push("missing_or_invalid_DATABASE_URL");
  if (!dependencies.DIRECT_DATABASE_URL) blockers.push("missing_or_invalid_DIRECT_DATABASE_URL");
  if (!dependencies.NEXTAUTH_URL) blockers.push("missing_NEXTAUTH_URL");
  if (!dependencies.AUTH_TRUST_HOST) blockers.push("missing_AUTH_TRUST_HOST_for_local_or_proxy_runtime");
  if (!dependencies.DNSE_API_KEY) blockers.push("missing_DNSE_API_KEY");
  if (!hasConnectedDnseUser) blockers.push("no_dnse_verified_user_found");

  const canRunStagingSafeFlow = blockers.length === 0;
  const expectedSubmitStatus =
    !flags.realOrderSubmitEnabled
      ? "blocked_not_enabled"
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
      pass: hasConnectedDnseUser,
    },
    executionSafeMode: {
      required: [
        "DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE",
        "DNSE_REAL_ORDER_SUBMIT_ENABLED=false",
        "DNSE_COMPLIANCE_APPROVED_FLOW=false",
      ],
      pass:
        flags.mode === "SAFE_EXECUTION_ADAPTER_MODE" &&
        !flags.realOrderSubmitEnabled &&
        !flags.complianceApprovedFlow,
    },
  };
  return {
    mode: flags.mode,
    flags,
    dependencies,
    requirements,
    blockers,
    canRunStagingSafeFlow,
    expectedSubmitStatus,
  };
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUserId = pickString(req.nextUrl.searchParams.get("targetUserId"));
  const includeTopicHydration = req.nextUrl.searchParams.get("withTopics") !== "0";
  const targetUser = await resolveTargetUser(targetUserId);

  if (!targetUser) {
    return NextResponse.json({
      ok: false,
      message: "No DNSE connected user found",
      runtime: buildRuntimeDependencyAudit(false),
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

  const auditRows = await prisma.changelog.findMany({
    where: {
      component: "DNSE_EXECUTION",
      OR: [
        { author: targetUser.id },
        { diff: { contains: targetUser.id } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      description: true,
      author: true,
      diff: true,
      createdAt: true,
    },
  });

  const parsedEvents = auditRows.map((row) => {
    const payload = parseJson(row.diff);
    const order = toRecord(payload?.order);
    const ticket = toRecord(payload?.ticket);
    return {
      id: row.id,
      action: row.action,
      description: row.description,
      author: row.author,
      createdAt: row.createdAt.toISOString(),
      intent: payload?.intent ?? ticket ?? null,
      validation: payload?.validation ?? ticket?.validation ?? null,
      preview: ticket?.preview ?? null,
      submit: order,
      payload,
    };
  });

  const latestByAction = {
    parse: parsedEvents.find((item) => item.action === "parse_intent") ?? null,
    validate: parsedEvents.find((item) => item.action === "validate_intent") ?? null,
    preview: parsedEvents.find((item) => item.action === "preview_order") ?? null,
    submit:
      parsedEvents.find((item) =>
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
    runtime: buildRuntimeDependencyAudit(true),
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
      latest: latestByAction,
      events: parsedEvents,
    },
  });
}
