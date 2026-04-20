import { NextRequest, NextResponse } from "next/server";
import type { ProviderRunResponse } from "@/types/provider-manifest";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import {
  createFallbackRunError,
  normalizeRunResponse,
  parseProviderRunRequest,
} from "@/lib/providers/contracts";
import { emitObservabilityEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

const BRIDGE = getPythonBridgeUrl();

export async function POST(req: NextRequest) {
  const parsedRequest = parseProviderRunRequest(await req.json().catch(() => null));
  if (!parsedRequest) {
    return NextResponse.json(
      createFallbackRunError({
        providerKey: "",
        error: "providerKey is required",
        source: "web-adapter",
      }) satisfies ProviderRunResponse,
      { status: 400 },
    );
  }

  const startedAt = new Date().toISOString();
  const baseFallbackResponse = createFallbackRunError({
    providerKey: parsedRequest.providerKey,
    error: "Bridge provider run endpoint unavailable",
    warnings: [
      "Deterministic execution source is unavailable.",
      "AI insight generation is blocked until deterministic results are available.",
    ],
    source: "fallback",
  });
  baseFallbackResponse.startedAt = startedAt;
  baseFallbackResponse.completedAt = new Date().toISOString();

  try {
    const res = await fetch(`${BRIDGE}/api/v1/providers/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerKey: parsedRequest.providerKey,
        inputs: parsedRequest.inputs,
        context: parsedRequest.context,
        requestInsight: parsedRequest.requestInsight,
        // Legacy bridge compatibility:
        provider: parsedRequest.providerKey,
        params: parsedRequest.inputs,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (res.ok) {
      const payload = (await res.json()) as unknown;
      return NextResponse.json(
        normalizeRunResponse(payload, {
          ...baseFallbackResponse,
          status: "success",
          source: "bridge",
          deterministic: true,
          errors: [],
          warnings: [],
        }) satisfies ProviderRunResponse,
      );
    }

    const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    return NextResponse.json(
      createFallbackRunError({
        providerKey: parsedRequest.providerKey,
        error: payload?.error || payload?.message || `Bridge provider run failed with HTTP ${res.status}`,
        source: "bridge",
      }) satisfies ProviderRunResponse,
      { status: 502 },
    );
  } catch (error) {
    emitObservabilityEvent({
      domain: "provider",
      level: "warn",
      event: "backtest_run_bridge_unavailable",
      meta: {
        providerKey: parsedRequest.providerKey,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const allowDevStub = process.env.NODE_ENV !== "production" && process.env.PROVIDER_ALLOW_DEV_STUB === "1";
  if (allowDevStub) {
    return NextResponse.json(
      {
        status: "success",
        providerKey: parsedRequest.providerKey,
        runId: `devstub-${Date.now()}`,
        startedAt,
        completedAt: new Date().toISOString(),
        result: {
          trades: [],
          metrics: {
            cagr: 0,
            maxDrawdown: 0,
            sharpe: 0,
            note: "DEV_STUB_ONLY",
          },
        },
        summary: "Dev stub executed. Use Python bridge provider in production for deterministic outputs.",
        warnings: ["DEV_STUB_ONLY", "Not for production usage."],
        errors: [],
        source: "fallback",
        deterministic: true,
      } satisfies ProviderRunResponse,
    );
  }

  return NextResponse.json(
    baseFallbackResponse satisfies ProviderRunResponse,
    { status: 503 },
  );
}
