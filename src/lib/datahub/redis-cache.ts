import Redis from "ioredis";
import { emitObservabilityEvent } from "@/lib/observability";
import { resolveTopicStaleWindowMs } from "./policy";
import type { TopicDefinition, TopicEnvelope } from "./types";

const REDIS_SCHEMA_VERSION = 1;
const DEFAULT_PREFIX = "adn:datahub:v1";

type RedisCacheRecord = {
  schemaVersion: number;
  envelope: TopicEnvelope;
  cachedAtMs: number;
  expiresAtMs: number;
  staleUntilMs: number;
  tags: string[];
};

type RedisCacheInput = {
  cacheKey: string;
  topic: string;
  scopeUserId: string | null;
  definition: TopicDefinition;
};

type InvalidateInput = {
  topics?: string[];
  tags?: string[];
  prefixes?: string[];
};

const DATAHUB_REDIS_CLIENT = Symbol.for("__adn_datahub_redis_client__");

function isRedisEnabled() {
  return process.env.DATAHUB_REDIS_ENABLED === "true" && Boolean(process.env.REDIS_URL?.trim());
}

function isPrivateRedisEnabled() {
  return process.env.DATAHUB_REDIS_PRIVATE_ENABLED === "true";
}

function redisPrefix() {
  return (process.env.DATAHUB_REDIS_PREFIX ?? DEFAULT_PREFIX).trim() || DEFAULT_PREFIX;
}

function getClient(): Redis | null {
  if (!isRedisEnabled()) return null;
  const root = globalThis as unknown as Record<string | symbol, unknown>;
  const existing = root[DATAHUB_REDIS_CLIENT] as Redis | undefined;
  if (existing) return existing;

  const client = new Redis(process.env.REDIS_URL ?? "", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: Number(process.env.DATAHUB_REDIS_CONNECT_TIMEOUT_MS ?? 500),
    commandTimeout: Number(process.env.DATAHUB_REDIS_COMMAND_TIMEOUT_MS ?? 500),
  });
  client.on("error", (error) => {
    emitObservabilityEvent({
      domain: "datahub",
      level: "warn",
      event: "redis_client_error",
      meta: { message: error.message },
    });
  });
  root[DATAHUB_REDIS_CLIENT] = client;
  return client;
}

async function getReadyClient() {
  const client = getClient();
  if (!client) return null;
  if (client.status === "ready") return client;
  if (client.status === "wait" || client.status === "end") {
    await client.connect();
  }
  return client;
}

function shouldCacheInRedis(input: RedisCacheInput) {
  if (!isRedisEnabled()) return false;
  const access = input.definition.access ?? "public";
  const scope = input.definition.cacheScope ?? "global";
  if (access === "private" || scope === "user") return isPrivateRedisEnabled();
  return true;
}

function cacheScope(input: RedisCacheInput) {
  if ((input.definition.cacheScope ?? "global") === "user") {
    return `user:${input.scopeUserId ?? "anonymous"}`;
  }
  return "global";
}

function redisKey(input: RedisCacheInput) {
  return `${redisPrefix()}:${cacheScope(input)}:${input.cacheKey}`;
}

function staleWindowMs(definition: TopicDefinition) {
  return Math.max(0, resolveTopicStaleWindowMs(definition));
}

function redisTtlMs(definition: TopicDefinition) {
  return Math.max(1_000, definition.ttlMs + staleWindowMs(definition));
}

function parseRecord(raw: string | null, input: RedisCacheInput, nowMs: number): RedisCacheRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RedisCacheRecord;
    if (parsed.schemaVersion !== REDIS_SCHEMA_VERSION) return null;
    if (!parsed.envelope || (input.topic && parsed.envelope.topic !== input.topic)) return null;
    if (!Number.isFinite(parsed.expiresAtMs) || !Number.isFinite(parsed.staleUntilMs)) return null;
    if (nowMs > parsed.staleUntilMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readDataHubRedisCache(input: RedisCacheInput): Promise<TopicEnvelope | null> {
  if (!shouldCacheInRedis(input)) return null;
  try {
    const client = await getReadyClient();
    if (!client) return null;
    const raw = await client.get(redisKey(input));
    const record = parseRecord(raw, input, Date.now());
    if (!record) return null;
    emitObservabilityEvent({
      domain: "datahub",
      event: "redis_cache_hit",
      meta: { topic: input.topic, source: input.definition.source },
    });
    return record.envelope;
  } catch (error) {
    emitObservabilityEvent({
      domain: "datahub",
      level: "warn",
      event: "redis_cache_read_failed",
      meta: { topic: input.topic, message: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
}

export async function writeDataHubRedisCache(input: RedisCacheInput, envelope: TopicEnvelope) {
  if (!shouldCacheInRedis(input)) return;
  try {
    const client = await getReadyClient();
    if (!client) return;
    const cachedAtMs = Date.now();
    const expiresAtMs = new Date(envelope.expiresAt).getTime();
    const staleUntilMs = expiresAtMs + staleWindowMs(input.definition);
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(staleUntilMs)) return;
    const record: RedisCacheRecord = {
      schemaVersion: REDIS_SCHEMA_VERSION,
      envelope,
      cachedAtMs,
      expiresAtMs,
      staleUntilMs,
      tags: input.definition.tags,
    };
    await client.set(redisKey(input), JSON.stringify(record), "PX", redisTtlMs(input.definition));
    emitObservabilityEvent({
      domain: "datahub",
      event: "redis_cache_write",
      meta: { topic: input.topic, source: input.definition.source, ttlMs: redisTtlMs(input.definition) },
    });
  } catch (error) {
    emitObservabilityEvent({
      domain: "datahub",
      level: "warn",
      event: "redis_cache_write_failed",
      meta: { topic: input.topic, message: error instanceof Error ? error.message : String(error) },
    });
  }
}

function recordMatches(record: RedisCacheRecord, input: InvalidateInput) {
  const topics = new Set((input.topics ?? []).map((item) => decodeURIComponent(item).trim()).filter(Boolean));
  const tags = new Set((input.tags ?? []).map((item) => item.trim()).filter(Boolean));
  const prefixes = (input.prefixes ?? []).map((item) => decodeURIComponent(item).trim()).filter(Boolean);
  const topic = record.envelope.topic;
  return (
    (topics.size > 0 && topics.has(topic)) ||
    (tags.size > 0 && record.tags.some((tag) => tags.has(tag))) ||
    (prefixes.length > 0 && prefixes.some((prefix) => topic.startsWith(prefix)))
  );
}

export async function invalidateDataHubRedisCache(input: InvalidateInput) {
  if (!isRedisEnabled()) return 0;
  if (!input.topics?.length && !input.tags?.length && !input.prefixes?.length) return 0;
  try {
    const client = await getReadyClient();
    if (!client) return 0;
    let cursor = "0";
    let removed = 0;
    const pattern = `${redisPrefix()}:*`;
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = nextCursor;
      for (const key of keys) {
        const record = parseRecord(await client.get(key), {
          cacheKey: key,
          topic: "",
          scopeUserId: null,
          definition: {
            id: "",
            ttlMs: 1,
            minIntervalMs: 1,
            source: "datahub",
            version: "v1",
            tags: [],
            match: () => ({ ok: false }),
            resolve: async () => null,
          },
        }, Date.now());
        if (record && recordMatches(record, input)) {
          removed += await client.del(key);
        }
      }
    } while (cursor !== "0");
    emitObservabilityEvent({
      domain: "datahub",
      event: "redis_cache_invalidate",
      meta: { removed },
    });
    return removed;
  } catch (error) {
    emitObservabilityEvent({
      domain: "datahub",
      level: "warn",
      event: "redis_cache_invalidate_failed",
      meta: { message: error instanceof Error ? error.message : String(error) },
    });
    return 0;
  }
}
