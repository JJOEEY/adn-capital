type ObservabilityLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityDomain =
  | "datahub"
  | "cron"
  | "workflow"
  | "provider"
  | "broker"
  | "aiden"
  | "health";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ObservabilityMeta = Record<string, JsonValue | undefined>;

const SECRET_KEY_PATTERN = /(token|secret|password|authorization|cookie|key|private|bearer)/i;

function envLogLevel(): ObservabilityLevel {
  const raw = (process.env.OBSERVABILITY_LOG_LEVEL ?? "info").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function severityRank(level: ObservabilityLevel): number {
  switch (level) {
    case "debug":
      return 10;
    case "info":
      return 20;
    case "warn":
      return 30;
    case "error":
      return 40;
    default:
      return 20;
  }
}

function shouldLog(level: ObservabilityLevel): boolean {
  return severityRank(level) >= severityRank(envLogLevel());
}

function maskText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 6) return "***";
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

function sanitizeValue(key: string, value: JsonValue | undefined): JsonValue | undefined {
  if (value == null) return value ?? null;

  if (typeof value === "string") {
    return SECRET_KEY_PATTERN.test(key) ? maskText(value) : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item) ?? null);
  }

  const out: Record<string, JsonValue> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    const next = sanitizeValue(childKey, childValue as JsonValue);
    if (next !== undefined) out[childKey] = next;
  }
  return out;
}

function sanitizeMeta(meta?: ObservabilityMeta): Record<string, JsonValue> {
  if (!meta) return {};
  const output: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(meta)) {
    const sanitized = sanitizeValue(key, value as JsonValue | undefined);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

export function maskIdentifier(value?: string | null): string | null {
  if (!value) return null;
  return maskText(value);
}

export function emitObservabilityEvent(input: {
  domain: ObservabilityDomain;
  event: string;
  level?: ObservabilityLevel;
  meta?: ObservabilityMeta;
}) {
  const level = input.level ?? "info";
  if (!shouldLog(level)) return;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    domain: input.domain,
    event: input.event,
    meta: sanitizeMeta(input.meta),
  };

  const line = `[obs] ${JSON.stringify(payload)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
