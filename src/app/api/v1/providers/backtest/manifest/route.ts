import { NextResponse } from "next/server";
import { fallbackBacktestProviders } from "@/lib/providers/fallback-manifests";
import type { BacktestManifestResponse, BacktestProviderManifest } from "@/types/provider-manifest";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

const BRIDGE = getPythonBridgeUrl();

export async function GET() {
  try {
    const res = await fetch(`${BRIDGE}/api/v1/providers/backtest/manifest`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (res.ok) {
      const payload = (await res.json()) as Partial<BacktestManifestResponse> & {
        providers?: BacktestProviderManifest[];
      };
      const providers = Array.isArray(payload.providers) ? payload.providers : [];
      if (providers.length > 0) {
        return NextResponse.json({
          providers,
          source: "bridge",
          fetchedAt: new Date().toISOString(),
        } satisfies BacktestManifestResponse);
      }
    }
  } catch {
    // fallback below
  }

  console.warn("[providers.backtest.manifest] bridge unavailable, serving fallback manifest");

  return NextResponse.json({
    providers: fallbackBacktestProviders,
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  } satisfies BacktestManifestResponse);
}
