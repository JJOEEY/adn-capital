import type { TopicDefinition } from "./types";

export type TopicFamily =
  | "market_public"
  | "brief"
  | "research"
  | "signal_public"
  | "portfolio_private"
  | "broker_private"
  | "workflow_admin"
  | "misc";

const DEFAULT_STALE_MS_BY_FAMILY: Record<TopicFamily, number> = {
  market_public: 90_000,
  brief: 30 * 60_000,
  research: 10 * 60_000,
  signal_public: 3 * 60_000,
  portfolio_private: 90_000,
  broker_private: 90_000,
  workflow_admin: 60_000,
  misc: 60_000,
};

export function resolveTopicFamily(definition: TopicDefinition): TopicFamily {
  const id = definition.id;
  const tags = new Set(definition.tags);

  if (tags.has("broker") || id.startsWith("broker:")) return "broker_private";
  if (tags.has("portfolio") || id.startsWith("portfolio:")) return "portfolio_private";
  if (tags.has("brief") || id.startsWith("brief:") || id.startsWith("news:")) return "brief";
  if (tags.has("workflow") || tags.has("admin") || id.startsWith("workflow:")) return "workflow_admin";
  if (tags.has("signal") || id.startsWith("signal:")) return "signal_public";
  if (tags.has("research") || id.startsWith("research:") || id.startsWith("vn:")) return "research";
  if (tags.has("market") || id.startsWith("vn:index:")) return "market_public";
  return "misc";
}

export function resolveTopicStaleWindowMs(definition: TopicDefinition): number {
  if (typeof definition.staleWhileRevalidateMs === "number") {
    return definition.staleWhileRevalidateMs;
  }
  const family = resolveTopicFamily(definition);
  return DEFAULT_STALE_MS_BY_FAMILY[family];
}

export function isTradingSensitiveTopicFamily(family: TopicFamily): boolean {
  return family === "market_public" || family === "signal_public" || family === "portfolio_private" || family === "broker_private";
}
