import { NextRequest, NextResponse } from "next/server";
import { emitWorkflowTrigger } from "@/lib/workflows";
import { emitObservabilityEvent } from "@/lib/observability";
import { WorkflowTriggerEvent, WorkflowTriggerType } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";

const ALLOWED_TRIGGER_TYPES = new Set<WorkflowTriggerType>([
  "cron",
  "signal_status_changed",
  "market_threshold",
  "portfolio_risk_threshold",
  "brief_ready",
]);

function isAuthorized(req: NextRequest) {
  const expected = process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  const provided = req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? "";
  return provided === expected;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    emitObservabilityEvent({
      domain: "workflow",
      level: "warn",
      event: "workflow_trigger_unauthorized",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isObject(body)) {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  const typeRaw = String(body.type ?? "").trim() as WorkflowTriggerType;
  if (!ALLOWED_TRIGGER_TYPES.has(typeRaw)) {
    return NextResponse.json({ error: "Unsupported workflow trigger type" }, { status: 400 });
  }

  const event: WorkflowTriggerEvent = {
    type: typeRaw,
    source: String(body.source ?? "internal-api").trim() || "internal-api",
    at: typeof body.at === "string" && body.at.trim() ? body.at.trim() : undefined,
    payload: isObject(body.payload) ? body.payload : {},
  };

  const result = await emitWorkflowTrigger(event);
  emitObservabilityEvent({
    domain: "workflow",
    event: "workflow_trigger_api_dispatch",
    meta: {
      triggerType: event.type,
      triggerSource: event.source,
      accepted: result.accepted,
      matchedCount: result.matchedWorkflowKeys.length,
    },
  });
  return NextResponse.json({
    ok: result.accepted,
    event: result.event,
    matchedWorkflowKeys: result.matchedWorkflowKeys,
    skippedWorkflowKeys: result.skippedWorkflowKeys,
    runs: result.runs,
  });
}
