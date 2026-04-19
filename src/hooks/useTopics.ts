"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { TopicEnvelope } from "@/lib/datahub/types";

type UseTopicsOptions = {
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
  forceRefresh?: boolean;
  refreshInterval?: number;
  pollMs?: number;
  revalidateOnFocus?: boolean;
  dedupingInterval?: number;
};

type BatchResponse<T = unknown> = {
  count: number;
  items: Array<TopicEnvelope<T>>;
  generatedAt: string;
};

async function batchFetcher<T>(topics: string[], force = false): Promise<BatchResponse<T>> {
  const res = await fetch("/api/hub/topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topics, force }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as BatchResponse<T>;
}

export function useTopics<T = unknown>(topicKeys: string[], options?: UseTopicsOptions) {
  const normalizedTopics = useMemo(
    () => Array.from(new Set(topicKeys.map((item) => item.trim()).filter(Boolean))),
    [topicKeys],
  );
  const forceByDefault = options?.forceRefresh === true;

  const key =
    options?.enabled === false || normalizedTopics.length === 0
      ? null
      : ["hub-topics", forceByDefault ? "force" : "cached", ...normalizedTopics];
  const swr = useSWR<BatchResponse<T>>(
    key,
    () => batchFetcher<T>(normalizedTopics, forceByDefault),
    {
      keepPreviousData: true,
      revalidateIfStale: options?.staleWhileRevalidate ?? true,
      refreshInterval: options?.pollMs ?? options?.refreshInterval ?? 0,
      revalidateOnFocus: options?.revalidateOnFocus ?? false,
      dedupingInterval: options?.dedupingInterval ?? 10_000,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      errorRetryInterval: 3_000,
    },
  );

  const byTopic = useMemo(() => {
    const map = new Map<string, TopicEnvelope<T>>();
    for (const item of swr.data?.items ?? []) {
      map.set(item.topic, item);
    }
    return map;
  }, [swr.data?.items]);

  const refresh = useCallback(
    async (force = forceByDefault) => {
      const next = await batchFetcher<T>(normalizedTopics, force);
      await swr.mutate(next, { revalidate: false });
      return next;
    },
    [forceByDefault, normalizedTopics, swr],
  );

  return {
    envelopes: swr.data?.items ?? [],
    byTopic,
    generatedAt: swr.data?.generatedAt ?? null,
    error: swr.error ?? null,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    refresh,
    mutate: swr.mutate,
  };
}
