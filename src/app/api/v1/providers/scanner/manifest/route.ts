import { NextResponse } from "next/server";
import { fallbackScannerProviders } from "@/lib/providers/fallback-manifests";
import type { ScannerManifestResponse, ScannerProviderManifest } from "@/types/provider-manifest";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

const BRIDGE = getPythonBridgeUrl();

export async function GET() {
  try {
    const res = await fetch(`${BRIDGE}/api/v1/providers/scanner/manifest`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (res.ok) {
      const payload = (await res.json()) as Partial<ScannerManifestResponse> & {
        providers?: ScannerProviderManifest[];
      };
      const providers = Array.isArray(payload.providers) ? payload.providers : [];
      if (providers.length > 0) {
        return NextResponse.json({
          providers,
          source: "bridge",
          fetchedAt: new Date().toISOString(),
        } satisfies ScannerManifestResponse);
      }
    }
  } catch {
    // fallback below
  }

  console.warn("[providers.scanner.manifest] bridge unavailable, serving fallback manifest");

  return NextResponse.json({
    providers: fallbackScannerProviders,
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  } satisfies ScannerManifestResponse);
}
