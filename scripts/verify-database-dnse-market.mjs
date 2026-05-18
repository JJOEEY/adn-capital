import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const INITIAL_ENV_KEYS = new Set(Object.keys(process.env));
const DOCS = [
  "https://developers.dnse.com.vn/docs/guide/enum/market_data",
  "https://developers.dnse.com.vn/docs/guide/market-data/connect",
  "https://developers.dnse.com.vn/docs/dnse/market-data",
];

function loadEnvFile(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) return;
  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key && !INITIAL_ENV_KEYS.has(key)) process.env[key] = value;
  }
}

for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) loadEnvFile(file);

function checkStaticDatabaseV2() {
  const dir = path.join(ROOT, "src", "lib", "database");
  const hits = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        if (content.includes("DNSE_MARKET_SNAPSHOT_URL") || content.includes("market-snapshot")) hits.push(path.relative(ROOT, full));
      }
    }
  }
  walk(dir);
  return hits;
}

function extractJson(stdout) {
  const text = String(stdout ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(value ?? "").digest("hex").slice(0, 8);
}

const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
const staticHits = checkStaticDatabaseV2();
const wsRun = spawnSync(process.execPath, ["scripts/verify-database-dnse-websocket.mjs"], {
  cwd: ROOT,
  env: process.env,
  encoding: "utf8",
  timeout: 70_000,
});
const websocket = extractJson(wsRun.stdout);
const blockers = [];
const warnings = [];

if (!apiKey || !apiSecret) blockers.push("dnse_credentials_missing");
if (staticHits.length) blockers.push("database_v2_contains_snapshot_reference");
if (!websocket?.ok) blockers.push("dnse_lightspeed_websocket_failed");

const report = {
  provider: "dnse",
  checkedAt: new Date().toISOString(),
  mode: "lightspeed-websocket-primary",
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : warnings.length ? "degraded" : "ok",
  docs: DOCS,
  credentials: {
    configured: Boolean(apiKey && apiSecret),
    keyFingerprint: apiKey ? fingerprint(apiKey) : null,
    secretFingerprint: apiSecret ? fingerprint(apiSecret) : null,
  },
  checks: {
    noSnapshotEnvInDatabaseV2: { ok: staticHits.length === 0, files: staticHits },
    websocket: websocket ?? {
      ok: false,
      error: wsRun.error?.message ?? wsRun.stderr?.slice(0, 300) ?? "websocket verify did not return JSON",
      exitCode: wsRun.status,
    },
  },
  blockers,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
