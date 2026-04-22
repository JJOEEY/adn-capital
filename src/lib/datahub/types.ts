export type TopicFreshness = "fresh" | "stale" | "expired" | "error";

export type TopicAccess = "public" | "private";
export type TopicCacheScope = "global" | "user";

export interface TopicError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface TopicEnvelope<T = unknown> {
  topic: string;
  value: T | null;
  updatedAt: string;
  expiresAt: string;
  freshness: TopicFreshness;
  source: string;
  version: string;
  tags?: string[];
  error?: TopicError;
}

export interface TopicContext {
  force?: boolean;
  userId?: string | null;
  userRole?: string | null;
  systemRole?: string | null;
  dnseSessionToken?: string | null;
  dnseSessionExpiresAt?: string | null;
}

export interface TopicDefinition {
  id: string;
  ttlMs: number;
  minIntervalMs: number;
  staleWhileRevalidateMs?: number;
  source: string;
  version: string;
  tags: string[];
  access?: TopicAccess;
  cacheScope?: TopicCacheScope;
  match: (topicKey: string) => { ok: true; params?: Record<string, string> } | { ok: false };
  resolve: (topicKey: string, context: TopicContext, params: Record<string, string>) => Promise<unknown>;
}
