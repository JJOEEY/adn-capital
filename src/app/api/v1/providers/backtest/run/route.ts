import { NextRequest, NextResponse } from "next/server";
import type { ProviderRunResponse } from "@/types/provider-manifest";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

const BRIDGE = getPythonBridgeUrl();

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { provider?: string; params?: Record<string, unknown> } | null;
  const provider = String(body?.provider ?? "").trim();
  const params = typeof body?.params === "object" && body?.params != null ? body.params : {};

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        provider: "",
        error: "provider is required",
        source: "fallback",
      } satisfies ProviderRunResponse,
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${BRIDGE}/api/v1/providers/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, params }),
      signal: AbortSignal.timeout(60_000),
    });

    if (res.ok) {
      const payload = (await res.json()) as ProviderRunResponse;
      return NextResponse.json({
        ok: payload.ok ?? true,
        provider,
        result: payload.result ?? payload,
        source: "bridge",
      } satisfies ProviderRunResponse);
    }
  } catch {
    // fallback below
  }

  console.warn(`[providers.backtest.run] bridge run unavailable for provider=${provider}`);

  return NextResponse.json(
    {
      ok: false,
      provider,
      error: "Bridge provider run endpoint unavailable",
      source: "fallback",
    } satisfies ProviderRunResponse,
    { status: 503 },
  );
}
