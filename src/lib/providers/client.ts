import type {
  BacktestManifestResponse,
  ProviderInputValue,
  ProviderRunRequest,
  ProviderRunResponse,
  ScannerManifestResponse,
} from "@/types/provider-manifest";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  return data;
}

async function parseErrorMessage(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; message?: string; errors?: string[] }
    | null;
  return payload?.error || payload?.message || payload?.errors?.[0] || `Request failed (${res.status})`;
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
  providerKey: string;
  inputs: Record<string, ProviderInputValue>;
  context?: Record<string, unknown>;
  requestInsight?: boolean;
}): Promise<ProviderRunResponse> {
  const canonicalPayload: ProviderRunRequest = {
    providerKey: payload.providerKey,
    inputs: payload.inputs,
    context: payload.context,
    requestInsight: payload.requestInsight,
  };
  const res = await fetch("/api/v1/providers/backtest/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(canonicalPayload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = await parseJson<ProviderRunResponse>(res);
  if (data.status !== "success") {
    throw new Error(data.errors[0] || "Backtest provider run failed");
  }
  return data;
}

export async function runScannerProvider(payload: {
  providerKey: string;
  inputs: Record<string, ProviderInputValue>;
  context?: Record<string, unknown>;
  requestInsight?: boolean;
}): Promise<ProviderRunResponse> {
  const canonicalPayload: ProviderRunRequest = {
    providerKey: payload.providerKey,
    inputs: payload.inputs,
    context: payload.context,
    requestInsight: payload.requestInsight,
  };
  const res = await fetch("/api/v1/providers/scanner/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(canonicalPayload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = await parseJson<ProviderRunResponse>(res);
  if (data.status !== "success") {
    throw new Error(data.errors[0] || "Scanner provider run failed");
  }
  return data;
}
