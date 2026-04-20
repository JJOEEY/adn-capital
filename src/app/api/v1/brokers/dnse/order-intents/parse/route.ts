import { NextRequest, NextResponse } from "next/server";
import { getDnseExecutionFlags } from "@/lib/brokers/dnse/flags";
import { parseOrderIntentDraft, validateOrderIntent } from "@/lib/brokers/dnse/order-intent-gate";
import { parseIntentRequestBody, requireExecutionUserContext } from "@/lib/brokers/dnse/api";
import { writeDnseExecutionAudit } from "@/lib/brokers/dnse/audit";
import { getDnseExecutionRolloutSnapshot } from "@/lib/brokers/dnse/rollout";
import { emitObservabilityEvent, maskIdentifier } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userContext = await requireExecutionUserContext();
  if (!userContext) {
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
      action: "parse_blocked_kill_switch",
      description: "DNSE intent parse blocked by global kill switch",
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

  if (!flags.intentEnabled) {
    validation.status = "blocked";
    validation.issues = Array.from(new Set([...validation.issues, "intent_feature_disabled"]));
  }

  await writeDnseExecutionAudit({
    action: "parse_intent",
    description: "DNSE order intent parsed",
    actorUserId: userContext.user.id,
    targetUserId: userContext.user.id,
    payload: {
      mode: flags.mode,
      rollout,
      intent: draft,
      validation,
    },
  });

  emitObservabilityEvent({
    domain: "broker",
    event: "dnse_intent_parsed",
    meta: {
      mode: flags.mode,
      userId: maskIdentifier(userContext.user.id),
      accountId: maskIdentifier(validation.normalizedIntent.accountId),
      ticker: validation.normalizedIntent.ticker,
      side: validation.normalizedIntent.side,
      validationStatus: validation.status,
      issues: validation.issues.length,
      warnings: validation.warnings.length,
    },
  });

  return NextResponse.json({
    mode: flags.mode,
    intent: draft,
    validation,
    deterministic: true,
  });
}
