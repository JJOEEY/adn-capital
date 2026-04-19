import type {
  BacktestManifestResponse,
  ProviderRunResponse,
  ScannerManifestResponse,
} from "@/types/provider-manifest";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  return data;
}

async function parseErrorMessage(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return payload?.error || payload?.message || `Request failed (${res.status})`;
}

export async function fetchBacktestManifest(): Promise<BacktestManifestResponse> {
  const res = await fetch("/api/v1/providers/backtest/manifest", {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Cannot fetch backtest manifest (${res.status})`);
  }
  return parseJson<BacktestManifestResponse>(res);
}

export async function fetchScannerManifest(): Promise<ScannerManifestResponse> {
  const res = await fetch("/api/v1/providers/scanner/manifest", {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Cannot fetch scanner manifest (${res.status})`);
  }
  return parseJson<ScannerManifestResponse>(res);
}

export async function runBacktestProvider(payload: {
  provider: string;
  params: Record<string, unknown>;
}): Promise<ProviderRunResponse> {
  const res = await fetch("/api/v1/providers/backtest/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = await parseJson<ProviderRunResponse>(res);
  if (!data.ok) {
    throw new Error(data.error || "Backtest provider run failed");
  }
  return data;
}

export async function runScannerProvider(payload: {
  provider: string;
  params: Record<string, unknown>;
}): Promise<ProviderRunResponse> {
  const res = await fetch("/api/v1/providers/scanner/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = await parseJson<ProviderRunResponse>(res);
  if (!data.ok) {
    throw new Error(data.error || "Scanner provider run failed");
  }
  return data;
}
