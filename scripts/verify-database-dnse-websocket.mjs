import crypto from "crypto";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const INITIAL_ENV_KEYS = new Set(Object.keys(process.env));
const SYMBOLS = (process.env.DNSE_WS_VERIFY_SYMBOLS ?? "HPG").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
const WS_URLS = [
  process.env.DNSE_MARKET_WS_BASE_URL,
  "wss://ws-openapi.dnse.com.vn",
].filter(Boolean).map((item) => item.replace(/\/+$/, ""));
const CHANNELS = [
  { name: "tick.G1.json", symbols: SYMBOLS },
  { name: "ohlc.1m.json", symbols: SYMBOLS },
  { name: "ohlc.5m.json", symbols: SYMBOLS },
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

const API_KEY = process.env.DNSE_API_KEY?.trim() ?? "";
const API_SECRET = process.env.DNSE_API_SECRET?.trim() ?? "";

function wsAuthMessage(nonceMode) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = nonceMode === "string" ? String(Date.now() * 1000) : Math.floor(Date.now() * 1000);
  const signature = crypto.createHmac("sha256", API_SECRET).update(`${API_KEY}:${timestamp}:${nonce}`, "utf8").digest("hex");
  return { action: "auth", api_key: API_KEY, signature, timestamp, nonce };
}

function safeParse(raw) {
  try {
    return JSON.parse(String(raw));
  } catch {
    return { raw: String(raw).slice(0, 180) };
  }
}

function receive(ws, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => cleanup(null), timeoutMs);
    const cleanup = (value) => {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
      resolve(value);
    };
    const onMessage = (data) => cleanup(safeParse(data));
    const onError = (error) => cleanup({ error: error instanceof Error ? error.message : String(error) });
    const onClose = (code, reason) => cleanup({ closed: true, code, reason: String(reason ?? "").slice(0, 120) });
    ws.once("message", onMessage);
    ws.once("error", onError);
    ws.once("close", onClose);
  });
}

async function runCase(baseUrl, nonceMode) {
  const WebSocket = (await import("ws")).default;
  const url = `${baseUrl}/v1/stream?encoding=json`;
  const result = { url, nonceMode, ok: false, steps: [] };
  const ws = new WebSocket(url, { handshakeTimeout: 10_000 });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("open_timeout")), 10_000);
      ws.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const welcome = await receive(ws, 5_000);
    result.steps.push({
      step: "welcome",
      ok: Boolean(welcome),
      action: welcome?.action ?? null,
      message: String(welcome?.message ?? welcome?.error ?? welcome?.closed ?? "").slice(0, 160),
    });

    ws.send(JSON.stringify(wsAuthMessage(nonceMode)));
    const auth = await receive(ws, 8_000);
    result.steps.push({
      step: "auth",
      ok: auth?.action === "auth_success",
      action: auth?.action ?? null,
      message: String(auth?.message ?? auth?.error ?? auth?.closed ?? "").slice(0, 160),
      code: auth?.code ?? null,
    });
    if (auth?.action !== "auth_success") return result;

    for (const channel of CHANNELS) {
      ws.send(JSON.stringify({ action: "subscribe", channels: [channel] }));
    }

    const samples = [];
    const deadline = Date.now() + Number(process.env.DNSE_WS_VERIFY_WAIT_MS ?? 12_000);
    while (Date.now() < deadline && samples.length < 8) {
      const message = await receive(ws, Math.max(1, deadline - Date.now()));
      if (!message) break;
      samples.push({
        action: message.action ?? null,
        T: message.T ?? message.t ?? null,
        symbol: message.symbol ?? message.s ?? null,
        keys: Object.keys(message).slice(0, 12),
        message: String(message.message ?? message.error ?? message.closed ?? "").slice(0, 120),
      });
    }
    result.steps.push({ step: "subscribe", ok: samples.length > 0, symbols: SYMBOLS, channels: CHANNELS.map((item) => item.name), samples });
    result.ok = result.steps.some((step) => step.step === "auth" && step.ok);
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
}

const results = [];
for (const baseUrl of Array.from(new Set(WS_URLS))) {
  for (const nonceMode of ["number", "string"]) {
    results.push(await runCase(baseUrl, nonceMode));
  }
}

const report = {
  provider: "dnse",
  transport: "websocket",
  checkedAt: new Date().toISOString(),
  ok: results.some((item) => item.ok),
  hasCredentials: Boolean(API_KEY && API_SECRET),
  results,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
