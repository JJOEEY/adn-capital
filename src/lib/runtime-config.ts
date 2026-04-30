const DEFAULT_PYTHON_BRIDGE_URL =
  process.env.NODE_ENV === "production" ? "http://fiinquant:8000" : "http://127.0.0.1:8000";

export function getPythonBridgeUrl(): string {
  const raw =
    process.env.PYTHON_BRIDGE_URL ??
    process.env.FIINQUANT_URL ??
    DEFAULT_PYTHON_BRIDGE_URL;

  return raw.replace(/\/$/, "");
}

export function getDatabaseUrlContract() {
  return {
    pooled: process.env.DATABASE_URL ?? "",
    direct: process.env.DIRECT_DATABASE_URL ?? "",
  };
}
