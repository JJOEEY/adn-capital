import { NextRequest, NextResponse } from "next/server";
import { getDnseExecutionFlags } from "@/lib/brokers/dnse/flags";
import { parseOrderIntentDraft, validateOrderIntent, buildDnseExecutionRequest } from "@/lib/brokers/dnse/order-intent-gate";
import { parseIntentRequestBody, requireExecutionUserContext } from "@/lib/brokers/dnse/api";
import type { OrderExecutionPreview, OrderTicket } from "@/types/dnse-execution";
import { savePreviewTicket } from "@/lib/brokers/dnse/preview-store";
import { writeDnseExecutionAudit } from "@/lib/brokers/dnse/audit";
import { invalidateDnseBrokerTopicsForUser } from "@/lib/brokers/dnse/topics";
import { getDnseExecutionRolloutSnapshot } from "@/lib/brokers/dnse/rollout";
import { emitObservabilityEvent, maskIdentifier } from "@/lib/observability";

export const dynamic = "force-dynamic";

const PREVIEW_TTL_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  const userContext = await requireExecutionUserContext();
  if (!userContext) {
    emitObservabilityEvent({
      domain: "broker",
      level: "warn",
      event: "dnse_preview_unauthorized",
      meta: {
        path: req.nextUrl.pathname,
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flags = getDnseExecutionFlags();
  const rollout = await getDnseExecutionRolloutSnapshot({
    userId: userContext.user.id,
    email: userContext.user.email,
    accountId: userContext.approvedConnectionId,
  });
  if (rollout.killSwitchEnabled) {
    await writeDnseExecutionAudit({
      action: "preview_blocked_kill_switch",
      description: "DNSE preview blocked by global kill switch",
      actorUserId: userContext.user.id,
      targetUserId: userContext.user.id,
      payload: {
        mode: flags.mode,
        rollout,
      },
    });
    return NextResponse.json(
      {
        mode: flags.mode,
        error: "execution_kill_switch_enabled",
        reason: rollout.killSwitchReason,
        deterministic: true,
      },
      { status: 503 },
    );
  }

  const body = parseIntentRequestBody(await req.json().catch(() => null));
  const draft = parseOrderIntentDraft({
    text: body.text,
    partial: body.intent,
    source: body.source,
    userId: userContext.user.id,
    accountId: userContext.approvedConnectionId ?? body.intent?.accountId?.toString() ?? "",
    requestInsight: body.requestInsight,
    metadata: body.metadata,
  });
  const validation = await validateOrderIntent(draft, {
    approvedAccountId: userContext.approvedConnectionId,
    dnseVerified: userContext.dnseVerified,
    maxOrderNotional: flags.maxOrderNotional,
    enforceTradingSession: true,
  });

  if (!flags.previewEnabled) {
    validation.status = "blocked";
    validation.issues = Array.from(new Set([...validation.issues, "preview_feature_disabled"]));
  }

  let preview: OrderExecutionPreview | null = null;
  if (validation.status !== "blocked" && validation.status !== "invalid") {
    const previewId = `preview_${crypto.randomUUID()}`;
    const expiresAtMs = Date.now() + PREVIEW_TTL_MS;
    preview = {
      previewId,
      intent: validation.normalizedIntent,
      validation,
      brokerPayloadPreview: buildDnseExecutionRequest(validation.normalizedIntent),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  const riskFlags = [
    ...validation.issues.map((issue) => `issue:${issue}`),
    ...validation.warnings.map((warning) => `warning:${warning}`),
  ];

  const ticket: OrderTicket = {
    intent: validation.normalizedIntent,
    validation,
    preview,
    riskFlags,
    confirmationRequired: true,
  };

  if (preview) {
    savePreviewTicket({
      previewId: preview.previewId,
      userId: userContext.user.id,
      ticket,
      expiresAtMs: new Date(preview.expiresAt).getTime(),
    });
  }

  await writeDnseExecutionAudit({
    action: "preview_order",
    description: "DNSE order preview created",
    actorUserId: userContext.user.id,
    targetUserId: userContext.user.id,
    payload: {
      mode: flags.mode,
      rollout,
      ticket,
    },
  });

  emitObservabilityEvent({
    domain: "broker",
    event: "dnse_order_preview_created",
    meta: {
      mode: flags.mode,
      userId: maskIdentifier(userContext.user.id),
      accountId: maskIdentifier(validation.normalizedIntent.accountId),
      ticker: validation.normalizedIntent.ticker,
      side: validation.normalizedIntent.side,
      validationStatus: validation.status,
      previewCreated: Boolean(preview),
      riskFlags: riskFlags.length,
    },
  });

  await invalidateDnseBrokerTopicsForUser(userContext.user.id);

  return NextResponse.json({
    mode: flags.mode,
    rollout,
    ticket,
    deterministic: true,
    confirmationPhrase: "CONFIRM",
    previewOnly: !flags.realOrderSubmitEnabled,
  });
}
