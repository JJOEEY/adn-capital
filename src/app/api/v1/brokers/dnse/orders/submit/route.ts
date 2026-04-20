import { NextRequest, NextResponse } from "next/server";
import { requireExecutionUserContext } from "@/lib/brokers/dnse/api";
import { getDnseExecutionFlags } from "@/lib/brokers/dnse/flags";
import { consumePreviewTicket, getPreviewTicket } from "@/lib/brokers/dnse/preview-store";
import {
  checkDuplicateSubmit,
  checkReplayCooldown,
  getIdempotentResult,
  setIdempotentResult,
} from "@/lib/brokers/dnse/submission-guard";
import { submitOrderToDnse, toOrderSnapshot } from "@/lib/brokers/dnse/adapter";
import { buildDnseExecutionRequest } from "@/lib/brokers/dnse/order-intent-gate";
import { writeDnseExecutionAudit } from "@/lib/brokers/dnse/audit";
import { invalidateDnseBrokerTopicsForUser } from "@/lib/brokers/dnse/topics";
import { getDnseExecutionRolloutSnapshot } from "@/lib/brokers/dnse/rollout";
import { isWithinVnTradingSession } from "@/lib/time";
import { emitObservabilityEvent, maskIdentifier } from "@/lib/observability";
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

function inferBlockedHttpStatus(status: DnseExecutionResult["status"], fallback = 403) {
  if (status === "approval_required" || status === "blocked_not_enabled") return 403;
  if (status === "rejected") return 422;
  if (status === "degraded") return 409;
  return fallback;
}

export async function POST(req: NextRequest) {
  const userContext = await requireExecutionUserContext();
  if (!userContext) {
    emitObservabilityEvent({
      domain: "broker",
      level: "warn",
      event: "dnse_submit_unauthorized",
      meta: {
        path: req.nextUrl.pathname,
      },
    });
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

  const rollout = await getDnseExecutionRolloutSnapshot({
    userId: userContext.user.id,
    email: userContext.user.email,
    accountId: ticket.intent.accountId,
  });

  const idempotencyKey = body.idempotencyKey || req.headers.get("x-idempotency-key") || `${userContext.user.id}:${previewId}`;
  const idempotentCacheKey = `idem:${userContext.user.id}:${idempotencyKey}`;
  const cached = getIdempotentResult(idempotentCacheKey);
  if (cached) {
    return NextResponse.json(cached.result.payload, { status: 200 });
  }

  const respondBlocked = async (args: {
    status: DnseExecutionResult["status"];
    error: string;
    warning?: string;
    httpStatus?: number;
  }) => {
    const result = blockedResult(ticket.intent.intentId, args.status, args.error, args.warning);
    const payload = {
      mode: flags.mode,
      rollout,
      result,
      deterministic: true,
    };
    setIdempotentResult(idempotentCacheKey, payload, result.status);
    await writeDnseExecutionAudit({
      action:
        result.status === "approval_required"
          ? "submit_approval_required"
          : "submit_blocked_not_enabled",
      description: "DNSE order submit blocked before broker adapter",
      actorUserId: userContext.user.id,
      targetUserId: userContext.user.id,
      payload: {
        mode: flags.mode,
        rollout,
        previewId,
        reason: args.error,
        warning: args.warning ?? null,
        status: result.status,
      },
    });
    emitObservabilityEvent({
      domain: "broker",
      level: "warn",
      event: "dnse_submit_blocked",
      meta: {
        mode: flags.mode,
        userId: maskIdentifier(userContext.user.id),
        accountId: maskIdentifier(ticket.intent.accountId),
        ticker: ticket.intent.ticker,
        side: ticket.intent.side,
        status: result.status,
        reason: args.error,
      },
    });
    return NextResponse.json(payload, { status: args.httpStatus ?? inferBlockedHttpStatus(result.status) });
  };

  if (rollout.killSwitchEnabled) {
    return respondBlocked({
      status: "blocked_not_enabled",
      error: "execution_kill_switch_enabled",
      warning: rollout.killSwitchReason ?? "execution_kill_switch_enabled",
      httpStatus: 503,
    });
  }
  if (!rollout.pilotEligible) {
    return respondBlocked({
      status: "blocked_not_enabled",
      error: "pilot_allowlist_required",
      warning: rollout.blockedReasons.join(",") || "pilot_allowlist_required",
    });
  }
  if (flags.configuredRealSubmitEnabled && !flags.complianceApprovedFlow) {
    return respondBlocked({
      status: "approval_required",
      error: "compliance_approval_required_for_real_submit",
      warning: "DNSE_COMPLIANCE_APPROVED_FLOW=false",
    });
  }
  if (flags.enforceMarketSessionGuard && !isWithinVnTradingSession()) {
    return respondBlocked({
      status: "blocked_not_enabled",
      error: "outside_market_session",
      warning: "market_session_guard_active",
      httpStatus: 423,
    });
  }
  if (
    userContext.approvedConnectionId &&
    ticket.intent.accountId.trim() !== userContext.approvedConnectionId.trim()
  ) {
    return respondBlocked({
      status: "blocked_not_enabled",
      error: "account_binding_mismatch",
    });
  }
  const estimatedNotional =
    ticket.validation.estimatedNotional ??
    (ticket.intent.price != null ? Number((ticket.intent.price * ticket.intent.quantity).toFixed(2)) : null);
  if (
    flags.maxOrderNotional != null &&
    estimatedNotional != null &&
    estimatedNotional > flags.maxOrderNotional
  ) {
    return respondBlocked({
      status: "blocked_not_enabled",
      error: "max_notional_exceeded",
      warning: `max_notional:${flags.maxOrderNotional}`,
      httpStatus: 422,
    });
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

  const duplicateKey = [
    "dup",
    userContext.user.id,
    ticket.intent.accountId,
    ticket.intent.ticker,
    ticket.intent.side,
    ticket.intent.orderType,
    String(ticket.intent.quantity),
    ticket.intent.price == null ? "MKT" : String(ticket.intent.price),
  ].join(":");
  const duplicateGuard = checkDuplicateSubmit(duplicateKey, flags.duplicateSubmitWindowMs);
  if (!duplicateGuard.allowed) {
    return respondBlocked({
      status: "blocked_not_enabled",
      error: "duplicate_submit_detected",
      warning: `retry_after_ms:${duplicateGuard.retryAfterMs}`,
      httpStatus: 409,
    });
  }

  if (!consumePreviewTicket(previewId, userContext.user.id)) {
    const result = blockedResult(ticket.intent.intentId, "degraded", "preview_already_consumed_or_expired");
    setIdempotentResult(idempotentCacheKey, result, result.status);
    return NextResponse.json(result, { status: 409 });
  }

  const brokerPayload = buildDnseExecutionRequest(ticket.intent);
  const result = await submitOrderToDnse({
    userId: userContext.user.id,
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
      rollout,
      previewId,
      order: orderSnapshot,
      validationStatus: ticket.validation.status,
      confirmation: true,
    },
  });

  await invalidateDnseBrokerTopicsForUser(userContext.user.id);

  const responsePayload = {
    mode: flags.mode,
    rollout,
    result,
    order: orderSnapshot,
    deterministic: true,
  };
  setIdempotentResult(idempotentCacheKey, responsePayload, result.status);
  emitObservabilityEvent({
    domain: "broker",
    level: result.status === "accepted" ? "info" : "warn",
    event: "dnse_submit_result",
    meta: {
      mode: flags.mode,
      userId: maskIdentifier(userContext.user.id),
      accountId: maskIdentifier(ticket.intent.accountId),
      ticker: ticket.intent.ticker,
      side: ticket.intent.side,
      status: result.status,
      source: result.source,
      deterministic: result.deterministic,
    },
  });

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
