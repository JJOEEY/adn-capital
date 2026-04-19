export type ProviderMode = "PYTHON_PROVIDER_MODE" | "CONTRACT_FIRST_FALLBACK_MODE";
export type ProviderType = "scanner" | "backtest";
export type ProviderSource = "bridge" | "fallback" | "web-adapter";
export type ProviderExecutionMode = "python-bridge" | "web-adapter" | "fallback-stub";
export type ProviderRunStatus = "success" | "degraded" | "error";

export type ProviderFieldType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "boolean"
  | "date"
  | "dateRange"
  | "ticker"
  | "textarea";

export interface ProviderFieldOption {
  label: string;
  value: string;
}

export interface ProviderDateRangeValue {
  start: string;
  end: string;
}

export type ProviderInputValue =
  | string
  | number
  | boolean
  | string[]
  | ProviderDateRangeValue
  | null;

export interface ProviderField {
  key: string;
  label: string;
  type: ProviderFieldType;
  required?: boolean;
  default?: ProviderInputValue;
  placeholder?: string;
  helpText?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ProviderFieldOption[];
}

export interface ProviderManifestBase {
  providerKey: string;
  providerType: ProviderType;
  title: string;
  description?: string;
  version: string;
  capabilities: string[];
  fields: ProviderField[];
  defaults?: Record<string, ProviderInputValue>;
  constraints?: Record<string, unknown>;
  executionMode: ProviderExecutionMode;
  supportsInsight: boolean;
}

export type BacktestProviderManifest = ProviderManifestBase & {
  providerType: "backtest";
};

export type ScannerProviderManifest = ProviderManifestBase & {
  providerType: "scanner";
};

export interface BacktestManifestResponse {
  providers: BacktestProviderManifest[];
  source: ProviderSource;
  mode: ProviderMode;
  fetchedAt: string;
  warnings?: string[];
}

export interface ScannerManifestResponse {
  providers: ScannerProviderManifest[];
  source: ProviderSource;
  mode: ProviderMode;
  fetchedAt: string;
  warnings?: string[];
}

export interface ProviderRunRequest {
  providerKey: string;
  inputs: Record<string, ProviderInputValue>;
  context?: Record<string, unknown>;
  requestInsight?: boolean;
}

export interface ProviderRunResponse {
  status: ProviderRunStatus;
  providerKey: string;
  runId: string;
  startedAt: string;
  completedAt?: string;
  result: unknown | null;
  summary?: string;
  insight?: string;
  warnings: string[];
  errors: string[];
  source: ProviderSource;
  deterministic: boolean;
}
