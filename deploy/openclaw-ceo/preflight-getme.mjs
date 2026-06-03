#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

const envFile = process.env.OPENCLAW_ENV_FILE || "/home/adncapital/secrets/openclaw-ceo.env";

function loadEnv(file) {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(envFile);

const token = process.env.TELEGRAM_BOT_TOKEN;
const expected = (process.env.OPENCLAW_EXPECTED_TELEGRAM_USERNAME || "adnn8n_bot").replace(/^@/, "");

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in env file.");
  process.exit(2);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    console.error(`Telegram getMe failed: HTTP ${response.status}`);
    process.exit(3);
  }
  const username = payload.result?.username;
  if (username !== expected) {
    console.error(`Wrong Telegram bot: got @${username || "unknown"}, expected @${expected}.`);
    process.exit(4);
  }
  console.log(`Telegram preflight ok: @${username}`);
} catch (error) {
  console.error(`Telegram preflight failed: ${error?.name === "AbortError" ? "timeout" : error?.message || error}`);
  process.exit(5);
} finally {
  clearTimeout(timeout);
}
