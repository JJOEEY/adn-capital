export type ProviderFieldType = "number" | "string" | "boolean" | "select";

export interface ProviderFieldOption {
  label: string;
  value: string;
}

export interface ProviderField {
  key: string;
  label: string;
  type: ProviderFieldType;
  required?: boolean;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ProviderFieldOption[];
  helpText?: string;
}

export interface BacktestProviderManifest {
  provider: string;
  version: string;
  label: string;
  description?: string;
  parameters: ProviderField[];
}

export interface ScannerProviderManifest {
  provider: string;
  version: string;
  label: string;
  description?: string;
  parameters: ProviderField[];
}

export interface BacktestManifestResponse {
  providers: BacktestProviderManifest[];
  source: "bridge" | "fallback";
  fetchedAt: string;
}

export interface ScannerManifestResponse {
  providers: ScannerProviderManifest[];
  source: "bridge" | "fallback";
  fetchedAt: string;
}

export interface ProviderRunResponse {
  ok: boolean;
  provider: string;
  result?: unknown;
  error?: string;
  source?: "bridge" | "fallback";
}
