/**
 * src/lib/settings.ts
 *
 * Runtime system settings backed by DB (SystemSetting model).
 * In-process cache invalidates every 10s to allow near-instant toggle
 * without reloading the server.
 */
import { prisma } from "@/lib/prisma";

// ── In-process cache (avoid DB round-trip on every request) ─────────
let _cache: Record<string, { value: string; ts: number }> = {};
const CACHE_TTL_MS = 10_000; // 10s — fast enough for live toggle

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const now = Date.now();
  if (_cache[key] && now - _cache[key].ts < CACHE_TTL_MS) {
    return _cache[key].value;
  }
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    const value = row?.value ?? defaultValue;
    _cache[key] = { value, ts: now };
    return value;
  } catch {
    return defaultValue;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  // Invalidate cache immediately
  delete _cache[key];
}

// ── Public API ───────────────────────────────────────────────────────

/** Returns true when IS_MOCK_MODE is enabled (presentation mode) */
export async function isMockMode(): Promise<boolean> {
  const val = await getSetting("IS_MOCK_MODE", "false");
  return val === "true";
}

/** Toggle IS_MOCK_MODE */
export async function setMockMode(enabled: boolean): Promise<void> {
  await setSetting("IS_MOCK_MODE", enabled ? "true" : "false");
}

/** Generic getter/setter for any system setting */
export { getSetting, setSetting };
