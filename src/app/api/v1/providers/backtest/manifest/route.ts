import { NextResponse } from "next/server";
import { fallbackBacktestProviders } from "@/lib/providers/fallback-manifests";
import type { BacktestManifestResponse } from "@/types/provider-manifest";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { normalizeManifestResponse } from "@/lib/providers/contracts";
import { emitObservabilityEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

const BRIDGE = getPythonBridgeUrl();

export async function GET() {
  const warnings: string[] = [];
  try {
    const res = await fetch(`${BRIDGE}/api/v1/providers/backtest/manifest`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (res.ok) {
      const payload = (await res.json()) as unknown;
      const normalized = normalizeManifestResponse("backtest", payload, "bridge");
      const providers = normalized.providers;
      if (providers.length > 0) {
        return NextResponse.json(normalized satisfies BacktestManifestResponse);
      }
      warnings.push("Bridge returned an empty backtest provider list.");
    } else {
      warnings.push(`Bridge manifest endpoint returned HTTP ${res.status}.`);
    }
  } catch (error) {
    warnings.push(
      error instanceof Error ? error.message : "Bridge manifest fetch failed for unknown reason.",
    );
  }

  emitObservabilityEvent({
    domain: "provider",
    level: "warn",
    event: "backtest_manifest_fallback",
    meta: {
      source: "fallback",
      warnings,
    },
  });

  return NextResponse.json(
    normalizeManifestResponse(
      "backtest",
      { providers: fallbackBacktestProviders },
      "fallback",
      warnings,
    ) satisfies BacktestManifestResponse,
  );
}
