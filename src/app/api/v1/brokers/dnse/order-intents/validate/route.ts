import { NextRequest, NextResponse } from "next/server";
import { getDnseExecutionFlags } from "@/lib/brokers/dnse/flags";
import { parseOrderIntentDraft, validateOrderIntent } from "@/lib/brokers/dnse/order-intent-gate";
import { parseIntentRequestBody, requireExecutionUserContext } from "@/lib/brokers/dnse/api";
import { writeDnseExecutionAudit } from "@/lib/brokers/dnse/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userContext = await requireExecutionUserContext();
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flags = getDnseExecutionFlags();
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
    action: "validate_intent",
    description: "DNSE order intent validated",
    actorUserId: userContext.user.id,
    targetUserId: userContext.user.id,
    payload: {
      mode: flags.mode,
      intent: validation.normalizedIntent,
      validation,
    },
  });

  return NextResponse.json({
    mode: flags.mode,
    validation,
    deterministic: true,
  });
}
