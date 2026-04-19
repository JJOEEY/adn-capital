type SubmissionRecord = {
  atMs: number;
  result: {
    status: string;
    payload: unknown;
  };
};

type GuardState = {
  byIdempotency: Map<string, SubmissionRecord>;
  byReplay: Map<string, number>;
};

const SUBMISSION_GUARD_KEY = Symbol.for("__adn_dnse_submission_guard__");

function getState(): GuardState {
  const root = globalThis as unknown as Record<string | symbol, unknown>;
  const existing = root[SUBMISSION_GUARD_KEY] as GuardState | undefined;
  if (existing) return existing;
  const created: GuardState = {
    byIdempotency: new Map(),
    byReplay: new Map(),
  };
  root[SUBMISSION_GUARD_KEY] = created;
  return created;
}

function cleanState(nowMs: number) {
  const state = getState();
  for (const [key, value] of state.byIdempotency.entries()) {
    if (nowMs - value.atMs > 5 * 60 * 1000) state.byIdempotency.delete(key);
  }
  for (const [key, atMs] of state.byReplay.entries()) {
    if (nowMs - atMs > 60_000) state.byReplay.delete(key);
  }
}

export function getIdempotentResult(key: string) {
  const nowMs = Date.now();
  cleanState(nowMs);
  const state = getState();
  return state.byIdempotency.get(key) ?? null;
}

export function setIdempotentResult(key: string, payload: unknown, status: string) {
  const nowMs = Date.now();
  cleanState(nowMs);
  const state = getState();
  state.byIdempotency.set(key, {
    atMs: nowMs,
    result: { status, payload },
  });
}

export function checkReplayCooldown(key: string, cooldownMs: number) {
  const nowMs = Date.now();
  cleanState(nowMs);
  const state = getState();
  const last = state.byReplay.get(key);
  if (last != null && nowMs - last < cooldownMs) {
    return {
      allowed: false,
      retryAfterMs: cooldownMs - (nowMs - last),
    };
  }
  state.byReplay.set(key, nowMs);
  return {
    allowed: true,
    retryAfterMs: 0,
  };
}
