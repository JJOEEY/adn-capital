import { buildTopicContext } from "./producer-context";
import { resolveTopicDefinition } from "./registry";
import { TopicContext, TopicDefinition, TopicEnvelope, TopicError, TopicFreshness } from "./types";

type CacheEntry = {
  cacheKey: string;
  topic: string;
  scopeUserId: string | null;
  envelope: TopicEnvelope;
  updatedAtMs: number;
  expiresAtMs: number;
  lastAttemptMs: number;
  tags: string[];
  inFlight?: Promise<TopicEnvelope>;
};

type GlobalState = {
  cache: Map<string, CacheEntry>;
};

const DATAHUB_STATE = Symbol.for("__adn_datahub_state__");

function getState(): GlobalState {
  const root = globalThis as unknown as Record<string | symbol, unknown>;
  const existing = root[DATAHUB_STATE] as GlobalState | undefined;
  if (existing) return existing;
  const state: GlobalState = { cache: new Map() };
  root[DATAHUB_STATE] = state;
  return state;
}

function nowIso(nowMs: number) {
  return new Date(nowMs).toISOString();
}

function toTopicError(code: string, message: string, retryable = false): TopicError {
  return { code, message, retryable };
}

function buildCacheKey(topic: string, definition: TopicDefinition, context: TopicContext): string {
  if (definition.cacheScope === "user") {
    return `user:${context.userId ?? "anonymous"}::${topic}`;
  }
  return topic;
}

function computeFreshness(
  nowMs: number,
  expiresAtMs: number,
  staleWindowMs: number,
): TopicFreshness {
  if (nowMs <= expiresAtMs) return "fresh";
  if (staleWindowMs > 0 && nowMs <= expiresAtMs + staleWindowMs) return "stale";
  return "expired";
}

function withFreshness(
  envelope: TopicEnvelope,
  definition: TopicDefinition,
  nowMs: number,
): TopicEnvelope {
  const expiresAtMs = new Date(envelope.expiresAt).getTime();
  const staleWindowMs = definition.staleWhileRevalidateMs ?? 0;
  const freshness = Number.isFinite(expiresAtMs)
    ? computeFreshness(nowMs, expiresAtMs, staleWindowMs)
    : "error";
  return freshness === envelope.freshness ? envelope : { ...envelope, freshness };
}

function makeErrorEnvelope(
  topic: string,
  source: string,
  version: string,
  error: TopicError,
  nowMs: number,
): TopicEnvelope {
  return {
    topic,
    value: null,
    updatedAt: nowIso(nowMs),
    expiresAt: nowIso(nowMs),
    freshness: "error",
    source,
    version,
    error,
  };
}

function isPrivateTopicUnauthorized(definition: TopicDefinition, context: TopicContext) {
  return (definition.access ?? "public") === "private" && !context.userId;
}

export async function getTopicEnvelope(topicKey: string, context?: TopicContext): Promise<TopicEnvelope> {
  const normalizedTopic = decodeURIComponent(topicKey).trim();
  const nowMs = Date.now();
  const state = getState();
  const found = resolveTopicDefinition(normalizedTopic);

  if (!found) {
    return makeErrorEnvelope(
      normalizedTopic,
      "datahub",
      "v1",
      toTopicError("topic_not_found", `Topic ${normalizedTopic} is not registered`),
      nowMs,
    );
  }

  const { definition, params } = found;
  const scopedContext = await buildTopicContext(context);
  if (isPrivateTopicUnauthorized(definition, scopedContext)) {
    return makeErrorEnvelope(
      normalizedTopic,
      definition.source,
      definition.version,
      toTopicError("unauthorized", "Authentication required for private topic"),
      nowMs,
    );
  }

  const force = scopedContext.force === true;
  const cacheKey = buildCacheKey(normalizedTopic, definition, scopedContext);
  const cached = state.cache.get(cacheKey);

  if (!force && cached?.inFlight) {
    return cached.inFlight;
  }

  if (!force && cached) {
    const cachedEnvelope = withFreshness(cached.envelope, definition, nowMs);
    if (cachedEnvelope.freshness === "fresh") {
      return cachedEnvelope;
    }

    const elapsed = nowMs - cached.lastAttemptMs;
    if (elapsed < definition.minIntervalMs) {
      return cachedEnvelope;
    }
  }

  const run = (async (): Promise<TopicEnvelope> => {
    const attemptMs = Date.now();
    try {
      const value = await definition.resolve(normalizedTopic, scopedContext, params);
      const envelope: TopicEnvelope = {
        topic: normalizedTopic,
        value: (value ?? null) as TopicEnvelope["value"],
        updatedAt: nowIso(attemptMs),
        expiresAt: nowIso(attemptMs + definition.ttlMs),
        freshness: "fresh",
        source: definition.source,
        version: definition.version,
        tags: definition.tags,
      };
      state.cache.set(cacheKey, {
        cacheKey,
        topic: normalizedTopic,
        scopeUserId: scopedContext.userId ?? null,
        envelope,
        updatedAtMs: attemptMs,
        expiresAtMs: attemptMs + definition.ttlMs,
        lastAttemptMs: attemptMs,
        tags: definition.tags,
      });
      return envelope;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = state.cache.get(cacheKey);
      const err = toTopicError("resolve_failed", message, true);
      if (fallback?.envelope) {
        const fallbackEnvelope = withFreshness(fallback.envelope, definition, attemptMs);
        const nextFreshness = fallbackEnvelope.freshness === "fresh" ? "stale" : fallbackEnvelope.freshness;
        const staleEnvelope: TopicEnvelope = {
          ...fallbackEnvelope,
          freshness: nextFreshness,
          error: err,
        };
        state.cache.set(cacheKey, {
          ...fallback,
          envelope: staleEnvelope,
          lastAttemptMs: attemptMs,
        });
        return staleEnvelope;
      }

      const empty = makeErrorEnvelope(normalizedTopic, definition.source, definition.version, err, attemptMs);
      state.cache.set(cacheKey, {
        cacheKey,
        topic: normalizedTopic,
        scopeUserId: scopedContext.userId ?? null,
        envelope: empty,
        updatedAtMs: attemptMs,
        expiresAtMs: attemptMs,
        lastAttemptMs: attemptMs,
        tags: definition.tags,
      });
      return empty;
    } finally {
      const current = state.cache.get(cacheKey);
      if (current?.inFlight) {
        const { inFlight, ...rest } = current;
        state.cache.set(cacheKey, rest);
      }
    }
  })();

  const baseline =
    cached ??
    ({
      cacheKey,
      topic: normalizedTopic,
      scopeUserId: scopedContext.userId ?? null,
      envelope: {
        topic: normalizedTopic,
        value: null,
        updatedAt: nowIso(nowMs),
        expiresAt: nowIso(nowMs),
        freshness: "stale",
        source: definition.source,
        version: definition.version,
        tags: definition.tags,
      } satisfies TopicEnvelope,
      updatedAtMs: nowMs,
      expiresAtMs: nowMs,
      lastAttemptMs: nowMs,
      tags: definition.tags,
    });

  state.cache.set(cacheKey, {
    ...baseline,
    inFlight: run,
    lastAttemptMs: nowMs,
    tags: definition.tags,
  });

  return run;
}

export async function getTopicEnvelopes(topicKeys: string[], context?: TopicContext): Promise<TopicEnvelope[]> {
  return Promise.all(topicKeys.map((topicKey) => getTopicEnvelope(topicKey, context)));
}

export function invalidateTopics(input: {
  topics?: string[];
  tags?: string[];
  prefixes?: string[];
}) {
  const state = getState();
  const topics = new Set((input.topics ?? []).map((item) => decodeURIComponent(item).trim()).filter(Boolean));
  const tags = new Set((input.tags ?? []).map((item) => item.trim()).filter(Boolean));
  const prefixes = (input.prefixes ?? []).map((item) => decodeURIComponent(item).trim()).filter(Boolean);

  let removed = 0;
  for (const [cacheKey, entry] of state.cache.entries()) {
    const hitByTopic = topics.size > 0 && topics.has(entry.topic);
    const hitByTag = tags.size > 0 && entry.tags.some((tag) => tags.has(tag));
    const hitByPrefix = prefixes.length > 0 && prefixes.some((prefix) => entry.topic.startsWith(prefix));
    if (hitByTopic || hitByTag || hitByPrefix) {
      state.cache.delete(cacheKey);
      removed += 1;
    }
  }

  return {
    removed,
    remaining: state.cache.size,
  };
}
