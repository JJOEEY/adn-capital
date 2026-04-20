import { buildTopicContext } from "./producer-context";
import { resolveTopicFamily, resolveTopicStaleWindowMs } from "./policy";
import { resolveTopicDefinition } from "./registry";
import { TopicContext, TopicDefinition, TopicEnvelope, TopicError, TopicFreshness } from "./types";
import { emitObservabilityEvent, maskIdentifier } from "@/lib/observability";

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

export type TopicCacheInspection = {
  topic: string;
  scopeUserId: string | null;
  freshness: TopicFreshness;
  source: string;
  family: string;
  updatedAt: string;
  expiresAt: string;
  tags: string[];
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
  const staleWindowMs = resolveTopicStaleWindowMs(definition);
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
    emitObservabilityEvent({
      domain: "datahub",
      level: "warn",
      event: "topic_not_found",
      meta: {
        topic: normalizedTopic,
      },
    });
    return makeErrorEnvelope(
      normalizedTopic,
      "datahub",
      "v1",
      toTopicError("topic_not_found", `Topic ${normalizedTopic} is not registered`),
      nowMs,
    );
  }

  const { definition, params } = found;
  const family = resolveTopicFamily(definition);
  const scopedContext = await buildTopicContext(context);
  if (isPrivateTopicUnauthorized(definition, scopedContext)) {
    emitObservabilityEvent({
      domain: "datahub",
      level: "warn",
      event: "topic_unauthorized",
      meta: {
        topic: normalizedTopic,
        source: definition.source,
        family,
        userId: maskIdentifier(scopedContext.userId),
      },
    });
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
    emitObservabilityEvent({
      domain: "datahub",
      event: "cache_inflight_dedupe",
      meta: {
        topic: normalizedTopic,
        source: definition.source,
        family,
        userId: maskIdentifier(scopedContext.userId),
      },
    });
    return cached.inFlight;
  }

  if (!force && cached) {
    const cachedEnvelope = withFreshness(cached.envelope, definition, nowMs);
    if (cachedEnvelope.freshness === "fresh") {
      emitObservabilityEvent({
        domain: "datahub",
        event: "cache_hit",
        meta: {
          topic: normalizedTopic,
          source: definition.source,
          family,
          freshness: cachedEnvelope.freshness,
          cacheScope: definition.cacheScope ?? "global",
          userId: maskIdentifier(scopedContext.userId),
        },
      });
      return cachedEnvelope;
    }

    const elapsed = nowMs - cached.lastAttemptMs;
    if (elapsed < definition.minIntervalMs) {
      emitObservabilityEvent({
        domain: "datahub",
        event: "cache_stale_min_interval",
        meta: {
          topic: normalizedTopic,
          source: definition.source,
          family,
          freshness: cachedEnvelope.freshness,
          minIntervalMs: definition.minIntervalMs,
          elapsedMs: elapsed,
          cacheScope: definition.cacheScope ?? "global",
          userId: maskIdentifier(scopedContext.userId),
        },
      });
      return cachedEnvelope;
    }
  }

  const run = (async (): Promise<TopicEnvelope> => {
    const attemptMs = Date.now();
    const refreshStartedAt = Date.now();
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
      emitObservabilityEvent({
        domain: "datahub",
        event: "refresh_success",
        meta: {
          topic: normalizedTopic,
          source: definition.source,
          family,
          latencyMs: Date.now() - refreshStartedAt,
          freshness: envelope.freshness,
          ttlMs: definition.ttlMs,
          staleWhileRevalidateMs: resolveTopicStaleWindowMs(definition),
          cacheScope: definition.cacheScope ?? "global",
          userId: maskIdentifier(scopedContext.userId),
          force,
        },
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
        emitObservabilityEvent({
          domain: "datahub",
          level: "warn",
          event: "refresh_failed_using_fallback",
          meta: {
            topic: normalizedTopic,
            source: definition.source,
            family,
            latencyMs: Date.now() - refreshStartedAt,
            freshness: staleEnvelope.freshness,
            errorCode: err.code,
            errorMessage: err.message,
            cacheScope: definition.cacheScope ?? "global",
            userId: maskIdentifier(scopedContext.userId),
            force,
          },
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
      emitObservabilityEvent({
        domain: "datahub",
        level: "error",
        event: "refresh_failed_no_fallback",
        meta: {
          topic: normalizedTopic,
          source: definition.source,
          family,
          latencyMs: Date.now() - refreshStartedAt,
          errorCode: err.code,
          errorMessage: err.message,
          cacheScope: definition.cacheScope ?? "global",
          userId: maskIdentifier(scopedContext.userId),
          force,
        },
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

  emitObservabilityEvent({
    domain: "datahub",
    event: "invalidate_topics",
    meta: {
      removed,
      remaining: state.cache.size,
      topicsCount: topics.size,
      tagsCount: tags.size,
      prefixesCount: prefixes.length,
    },
  });

  return {
    removed,
    remaining: state.cache.size,
  };
}

export function getTopicCacheInspections(): TopicCacheInspection[] {
  const nowMs = Date.now();
  const state = getState();
  const inspections: TopicCacheInspection[] = [];

  for (const entry of state.cache.values()) {
    const resolved = resolveTopicDefinition(entry.topic);
    if (!resolved) continue;
    const envelope = withFreshness(entry.envelope, resolved.definition, nowMs);
    inspections.push({
      topic: entry.topic,
      scopeUserId: maskIdentifier(entry.scopeUserId),
      freshness: envelope.freshness,
      source: resolved.definition.source,
      family: resolveTopicFamily(resolved.definition),
      updatedAt: envelope.updatedAt,
      expiresAt: envelope.expiresAt,
      tags: resolved.definition.tags,
    });
  }

  return inspections.sort((a, b) => a.topic.localeCompare(b.topic));
}
