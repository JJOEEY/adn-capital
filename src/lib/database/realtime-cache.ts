type CacheEntry<T> = {
  value: T;
  updatedAt: string;
  expiresAtMs: number;
};

type RealtimeCacheState = {
  entries: Map<string, CacheEntry<unknown>>;
};

const REALTIME_CACHE_STATE = Symbol.for("__adn_database_v2_realtime_cache__");

function getState(): RealtimeCacheState {
  const root = globalThis as unknown as Record<string | symbol, unknown>;
  const existing = root[REALTIME_CACHE_STATE] as RealtimeCacheState | undefined;
  if (existing) return existing;
  const state: RealtimeCacheState = { entries: new Map() };
  root[REALTIME_CACHE_STATE] = state;
  return state;
}

function makeKey(namespace: string, key: string) {
  return `${namespace}:${key}`;
}

export function setRealtimeCache<T>(namespace: string, key: string, value: T, ttlMs = 90_000) {
  const state = getState();
  state.entries.set(makeKey(namespace, key), {
    value,
    updatedAt: new Date().toISOString(),
    expiresAtMs: Date.now() + ttlMs,
  });
}

export function getRealtimeCache<T>(namespace: string, key: string): { value: T; updatedAt: string } | null {
  const state = getState();
  const cacheKey = makeKey(namespace, key);
  const entry = state.entries.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAtMs < Date.now()) {
    state.entries.delete(cacheKey);
    return null;
  }
  return { value: entry.value as T, updatedAt: entry.updatedAt };
}

export function inspectRealtimeCache() {
  const state = getState();
  const now = Date.now();
  const rows = Array.from(state.entries.entries()).map(([key, entry]) => ({
    key,
    updatedAt: entry.updatedAt,
    expiresAt: new Date(entry.expiresAtMs).toISOString(),
    fresh: entry.expiresAtMs >= now,
  }));
  return {
    checkedAt: new Date().toISOString(),
    size: rows.length,
    fresh: rows.filter((row) => row.fresh).length,
    rows,
  };
}

export function pruneRealtimeCache() {
  const state = getState();
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of state.entries.entries()) {
    if (entry.expiresAtMs >= now) continue;
    state.entries.delete(key);
    pruned += 1;
  }
  return pruned;
}
