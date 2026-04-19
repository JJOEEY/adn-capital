import type {
  BacktestManifestResponse,
  BacktestProviderManifest,
  ProviderDateRangeValue,
  ProviderExecutionMode,
  ProviderField,
  ProviderFieldType,
  ProviderInputValue,
  ProviderManifestBase,
  ProviderMode,
  ProviderRunRequest,
  ProviderRunResponse,
  ProviderSource,
  ProviderType,
  ScannerManifestResponse,
  ScannerProviderManifest,
} from "@/types/provider-manifest";

export const PROVIDER_MODE: ProviderMode = "CONTRACT_FIRST_FALLBACK_MODE";
const DATE_RANGE_FIELD_TYPE = "dateRange";
const LEGACY_TEXT_FIELD_TYPES = new Set(["string", "text"]);
const FIELD_TYPES: ProviderFieldType[] = [
  "text",
  "number",
  "select",
  "multiselect",
  "boolean",
  "date",
  DATE_RANGE_FIELD_TYPE,
  "ticker",
  "textarea",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIsoNow() {
  return new Date().toISOString();
}

function toProviderFieldType(value: unknown): ProviderFieldType {
  if (typeof value === "string") {
    if (LEGACY_TEXT_FIELD_TYPES.has(value)) return "text";
    if ((FIELD_TYPES as string[]).includes(value)) return value as ProviderFieldType;
  }
  return "text";
}

function toDateRangeOrNull(value: unknown): ProviderDateRangeValue | null {
  if (!isRecord(value)) return null;
  const start = typeof value.start === "string" ? value.start : "";
  const end = typeof value.end === "string" ? value.end : "";
  if (!start && !end) return null;
  return { start, end };
}

export function normalizeInputValue(fieldType: ProviderFieldType, value: unknown): ProviderInputValue {
  if (value == null) return null;
  if (fieldType === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (fieldType === "boolean") return Boolean(value);
  if (fieldType === "multiselect") {
    if (Array.isArray(value)) return value.map((item) => String(item));
    return [];
  }
  if (fieldType === DATE_RANGE_FIELD_TYPE) {
    return toDateRangeOrNull(value);
  }
  return String(value);
}

function normalizeField(rawField: unknown): ProviderField | null {
  if (!isRecord(rawField)) return null;
  const key = typeof rawField.key === "string" ? rawField.key.trim() : "";
  const label = typeof rawField.label === "string" ? rawField.label.trim() : "";
  const type = toProviderFieldType(rawField.type);
  if (!key || !label) return null;

  const field: ProviderField = {
    key,
    label,
    type,
  };

  if (typeof rawField.required === "boolean") field.required = rawField.required;
  if (typeof rawField.placeholder === "string") field.placeholder = rawField.placeholder;
  if (typeof rawField.helpText === "string") field.helpText = rawField.helpText;
  if (typeof rawField.min === "number") field.min = rawField.min;
  if (typeof rawField.max === "number") field.max = rawField.max;
  if (typeof rawField.step === "number") field.step = rawField.step;
  if (rawField.default !== undefined) field.default = normalizeInputValue(type, rawField.default);

  if (Array.isArray(rawField.options)) {
    const options = rawField.options
      .filter(isRecord)
      .map((option) => {
        const value = typeof option.value === "string" ? option.value : String(option.value ?? "");
        const label = typeof option.label === "string" ? option.label : value;
        return value ? { label, value } : null;
      })
      .filter((option): option is { label: string; value: string } => option !== null);
    if (options.length > 0) field.options = options;
  }

  return field;
}

function normalizeLegacyManifest(
  type: ProviderType,
  rawManifest: Record<string, unknown>,
): ProviderManifestBase | null {
  const providerKey =
    typeof rawManifest.providerKey === "string"
      ? rawManifest.providerKey.trim()
      : typeof rawManifest.provider === "string"
      ? rawManifest.provider.trim()
      : "";
  const title =
    typeof rawManifest.title === "string"
      ? rawManifest.title.trim()
      : typeof rawManifest.label === "string"
      ? rawManifest.label.trim()
      : providerKey;
  const version = typeof rawManifest.version === "string" ? rawManifest.version : "1.0.0";
  const description = typeof rawManifest.description === "string" ? rawManifest.description : undefined;

  const rawFields = Array.isArray(rawManifest.fields)
    ? rawManifest.fields
    : Array.isArray(rawManifest.parameters)
    ? rawManifest.parameters
    : [];
  const fields = rawFields.map(normalizeField).filter((field): field is ProviderField => field !== null);
  if (!providerKey || !title || fields.length === 0) return null;

  const capabilities = Array.isArray(rawManifest.capabilities)
    ? rawManifest.capabilities.filter((cap): cap is string => typeof cap === "string" && !!cap.trim())
    : [type === "scanner" ? "scan" : "backtest"];

  const executionMode = ((): ProviderExecutionMode => {
    if (rawManifest.executionMode === "python-bridge") return "python-bridge";
    if (rawManifest.executionMode === "web-adapter") return "web-adapter";
    if (rawManifest.executionMode === "fallback-stub") return "fallback-stub";
    return "web-adapter";
  })();

  const defaults = isRecord(rawManifest.defaults)
    ? Object.fromEntries(
        Object.entries(rawManifest.defaults).map(([key, value]) => {
          const fieldType = fields.find((field) => field.key === key)?.type ?? "text";
          return [key, normalizeInputValue(fieldType, value)];
        }),
      )
    : undefined;

  const constraints = isRecord(rawManifest.constraints) ? rawManifest.constraints : undefined;

  return {
    providerKey,
    providerType: type,
    title,
    description,
    version,
    capabilities,
    fields,
    defaults,
    constraints,
    executionMode,
    supportsInsight: Boolean(rawManifest.supportsInsight ?? false),
  };
}

function normalizeProviderCollection<T extends ProviderType>(
  type: T,
  payload: unknown,
): T extends "scanner" ? ScannerProviderManifest[] : BacktestProviderManifest[] {
  const list = Array.isArray(payload) ? payload : [];
  const providers = list
    .filter(isRecord)
    .map((entry) => normalizeLegacyManifest(type, entry))
    .filter((entry): entry is ProviderManifestBase => entry !== null);

  return providers as T extends "scanner" ? ScannerProviderManifest[] : BacktestProviderManifest[];
}

export function normalizeManifestResponse(
  type: "backtest",
  payload: unknown,
  source: ProviderSource,
  warnings?: string[],
): BacktestManifestResponse;
export function normalizeManifestResponse(
  type: "scanner",
  payload: unknown,
  source: ProviderSource,
  warnings?: string[],
): ScannerManifestResponse;
export function normalizeManifestResponse(
  type: ProviderType,
  payload: unknown,
  source: ProviderSource,
  warnings: string[] = [],
) {
  const rawProviders = isRecord(payload) ? payload.providers : payload;
  const providers = normalizeProviderCollection(type, rawProviders);
  const base = {
    providers,
    source,
    mode: PROVIDER_MODE,
    fetchedAt: toIsoNow(),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
  return type === "scanner"
    ? (base as ScannerManifestResponse)
    : (base as BacktestManifestResponse);
}

export function parseProviderRunRequest(body: unknown): ProviderRunRequest | null {
  if (!isRecord(body)) return null;
  const providerKey =
    typeof body.providerKey === "string"
      ? body.providerKey.trim()
      : typeof body.provider === "string"
      ? body.provider.trim()
      : "";

  const rawInputs = isRecord(body.inputs)
    ? body.inputs
    : isRecord(body.params)
    ? body.params
    : {};

  const inputs: Record<string, ProviderInputValue> = {};
  for (const [key, value] of Object.entries(rawInputs)) {
    if (!key.trim()) continue;
    if (Array.isArray(value)) {
      inputs[key] = value.map((item) => String(item));
      continue;
    }
    if (isRecord(value)) {
      const dateRange = toDateRangeOrNull(value);
      inputs[key] = dateRange ?? null;
      continue;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      inputs[key] = value;
      continue;
    }
    if (value == null) {
      inputs[key] = null;
      continue;
    }
    inputs[key] = String(value);
  }

  const context = isRecord(body.context) ? body.context : undefined;
  const requestInsight = typeof body.requestInsight === "boolean" ? body.requestInsight : false;

  if (!providerKey) return null;
  return { providerKey, inputs, context, requestInsight };
}

function sanitizeTextField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function createFallbackRunError(params: {
  providerKey: string;
  error: string;
  source?: ProviderSource;
  warnings?: string[];
}): ProviderRunResponse {
  return {
    status: "degraded",
    providerKey: params.providerKey,
    runId: `fallback-${Date.now()}`,
    startedAt: toIsoNow(),
    completedAt: toIsoNow(),
    result: null,
    warnings: params.warnings ?? [],
    errors: [params.error],
    source: params.source ?? "fallback",
    deterministic: false,
  };
}

export function normalizeRunResponse(payload: unknown, fallback: ProviderRunResponse): ProviderRunResponse {
  if (!isRecord(payload)) return fallback;

  const statusRaw = payload.status;
  const status =
    statusRaw === "success" || statusRaw === "degraded" || statusRaw === "error"
      ? statusRaw
      : payload.ok === true
      ? "success"
      : payload.ok === false
      ? "error"
      : fallback.status;

  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.map((item) => String(item))
    : [...fallback.warnings];
  const errors = Array.isArray(payload.errors)
    ? payload.errors.map((item) => String(item))
    : payload.error
    ? [String(payload.error)]
    : [...fallback.errors];

  const sourceRaw = payload.source;
  const source: ProviderSource =
    sourceRaw === "bridge" || sourceRaw === "fallback" || sourceRaw === "web-adapter"
      ? sourceRaw
      : fallback.source;

  const providerKey =
    typeof payload.providerKey === "string"
      ? payload.providerKey
      : typeof payload.provider === "string"
      ? payload.provider
      : fallback.providerKey;

  const startedAt = typeof payload.startedAt === "string" ? payload.startedAt : fallback.startedAt;
  const completedAt = typeof payload.completedAt === "string" ? payload.completedAt : toIsoNow();
  const runId = typeof payload.runId === "string" ? payload.runId : `run-${Date.now()}`;
  const result = payload.result ?? null;
  const deterministic = typeof payload.deterministic === "boolean" ? payload.deterministic : status === "success";
  let insight = sanitizeTextField(payload.insight);
  const summary = sanitizeTextField(payload.summary);

  // Guardrail: no AI insight when deterministic core does not exist.
  if (!deterministic && insight) {
    warnings.push("Insight removed because deterministic result is unavailable.");
    insight = undefined;
  }

  return {
    status,
    providerKey,
    runId,
    startedAt,
    completedAt,
    result,
    summary,
    insight,
    warnings,
    errors,
    source,
    deterministic,
  };
}
