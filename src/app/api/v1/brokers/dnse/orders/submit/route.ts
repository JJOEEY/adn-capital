import { NextRequest, NextResponse } from "next/server";
import { requireExecutionUserContext } from "@/lib/brokers/dnse/api";
import { getDnseExecutionFlags } from "@/lib/brokers/dnse/flags";
import { consumePreviewTicket, getPreviewTicket } from "@/lib/brokers/dnse/preview-store";
import { checkReplayCooldown, getIdempotentResult, setIdempotentResult } from "@/lib/brokers/dnse/submission-guard";
import { submitOrderToDnse, toOrderSnapshot } from "@/lib/brokers/dnse/adapter";
import { buildDnseExecutionRequest } from "@/lib/brokers/dnse/order-intent-gate";
import { writeDnseExecutionAudit } from "@/lib/brokers/dnse/audit";
import { invalidateDnseBrokerTopicsForUser } from "@/lib/brokers/dnse/topics";
import type { DnseExecutionResult } from "@/types/dnse-execution";

export const dynamic = "force-dynamic";

type SubmitBody = {
  previewId?: string;
  confirm?: boolean;
  confirmationText?: string;
  idempotencyKey?: string;
};

function parseBody(value: unknown): SubmitBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    previewId: typeof row.previewId === "string" ? row.previewId.trim() : undefined,
    confirm: Boolean(row.confirm),
    confirmationText: typeof row.confirmationText === "string" ? row.confirmationText.trim() : undefined,
    idempotencyKey: typeof row.idempotencyKey === "string" ? row.idempotencyKey.trim() : undefined,
  };
}

function blockedResult(intentId: string, status: DnseExecutionResult["status"], error: string, warning?: string): DnseExecutionResult {
  return {
    status,
    intentId,
    submittedAt: null,
    result: null,
    warnings: warning ? [warning] : [],
    errors: [error],
    source: "safe-adapter",
    deterministic: true,
  };
}

export async function POST(req: NextRequest) {
  const userContext = await requireExecutionUserContext();
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flags = getDnseExecutionFlags();
  const body = parseBody(await req.json().catch(() => null));
  const previewId = body.previewId ?? "";
  if (!previewId) {
    return NextResponse.json({ error: "previewId is required" }, { status: 400 });
  }

  const ticket = getPreviewTicket(previewId, userContext.user.id);
  if (!ticket) {
    return NextResponse.json(
      blockedResult("unknown", "degraded", "preview_not_found_or_expired"),
      { status: 410 },
    );
  }

  if (!body.confirm || (body.confirmationText ?? "").toUpperCase() !== "CONFIRM") {
    return NextResponse.json(
      blockedResult(ticket.intent.intentId, "blocked_not_enabled", "human_confirmation_required", "missing_confirm_phrase"),
      { status: 400 },
    );
  }

  const idempotencyKey = body.idempotencyKey || req.headers.get("x-idempotency-key") || `${userContext.user.id}:${previewId}`;
  const idempotentCacheKey = `idem:${userContext.user.id}:${idempotencyKey}`;
  const cached = getIdempotentResult(idempotentCacheKey);
  if (cached) {
    return NextResponse.json(cached.result.payload, { status: 200 });
  }

  const replayKey = `replay:${userContext.user.id}:${ticket.intent.accountId}:${ticket.intent.ticker}:${ticket.intent.side}`;
  const replayGuard = checkReplayCooldown(replayKey, flags.replayCooldownMs);
  if (!replayGuard.allowed) {
    const result = blockedResult(
      ticket.intent.intentId,
      "blocked_not_enabled",
      "replay_cooldown_active",
      `retry_after_ms:${replayGuard.retryAfterMs}`,
    );
    setIdempotentResult(idempotentCacheKey, result, result.status);
    return NextResponse.json(result, { status: 429 });
  }

  if (!consumePreviewTicket(previewId, userContext.user.id)) {
    const result = blockedResult(ticket.intent.intentId, "degraded", "preview_already_consumed_or_expired");
    setIdempotentResult(idempotentCacheKey, result, result.status);
    return NextResponse.json(result, { status: 409 });
  }

  const brokerPayload = buildDnseExecutionRequest(ticket.intent);
  const result = await submitOrderToDnse({
    intent: ticket.intent,
    brokerPayload,
    validation: ticket.validation,
  });

  const orderSnapshot = toOrderSnapshot({
    intent: ticket.intent,
    result,
    previewId,
  });

  const actionMap: Record<string, string> = {
    accepted: "submit_accepted",
    rejected: "submit_rejected",
    degraded: "submit_degraded",
    blocked_not_enabled: "submit_blocked_not_enabled",
    approval_required: "submit_approval_required",
    error: "submit_error",
  };

  await writeDnseExecutionAudit({
    action: actionMap[result.status] ?? "submit_unknown",
    description: "DNSE order submit attempted",
    actorUserId: userContext.user.id,
    targetUserId: userContext.user.id,
    payload: {
      mode: flags.mode,
      previewId,
      order: orderSnapshot,
      validationStatus: ticket.validation.status,
      confirmation: true,
    },
  });

  await invalidateDnseBrokerTopicsForUser(userContext.user.id);

  const responsePayload = {
    mode: flags.mode,
    result,
    order: orderSnapshot,
    deterministic: true,
  };
  setIdempotentResult(idempotentCacheKey, responsePayload, result.status);

  const statusCode =
    result.status === "accepted"
      ? 200
      : result.status === "approval_required" || result.status === "blocked_not_enabled"
        ? 403
        : result.status === "rejected"
          ? 422
          : 502;

  return NextResponse.json(responsePayload, { status: statusCode });
}
