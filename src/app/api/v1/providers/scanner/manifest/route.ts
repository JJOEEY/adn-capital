import { NextResponse } from "next/server";
import { fallbackScannerProviders } from "@/lib/providers/fallback-manifests";
import type { ScannerManifestResponse } from "@/types/provider-manifest";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { normalizeManifestResponse } from "@/lib/providers/contracts";
import { emitObservabilityEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

const BRIDGE = getPythonBridgeUrl();

export async function GET() {
  const warnings: string[] = [];
  try {
    const res = await fetch(`${BRIDGE}/api/v1/providers/scanner/manifest`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (res.ok) {
      const payload = (await res.json()) as unknown;
      const normalized = normalizeManifestResponse("scanner", payload, "bridge");
      const providers = normalized.providers;
      if (providers.length > 0) {
        return NextResponse.json(normalized satisfies ScannerManifestResponse);
      }
      warnings.push("Bridge returned an empty scanner provider list.");
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
    event: "scanner_manifest_fallback",
    meta: {
      source: "fallback",
      warnings,
    },
  });

  return NextResponse.json(
    normalizeManifestResponse(
      "scanner",
      { providers: fallbackScannerProviders },
      "fallback",
      warnings,
    ) satisfies ScannerManifestResponse,
  );
}
