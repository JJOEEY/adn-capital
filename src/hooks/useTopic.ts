"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { TopicEnvelope } from "@/lib/datahub/types";

type UseTopicOptions = {
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
  forceRefresh?: boolean;
  refreshInterval?: number;
  pollMs?: number;
  timeoutMs?: number;
  revalidateOnFocus?: boolean;
  dedupingInterval?: number;
};

async function topicFetcher<T>(url: string, timeoutMs = 30_000): Promise<TopicEnvelope<T>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (![200, 206, 401, 404, 503].includes(res.status)) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as TopicEnvelope<T>;
}

export function useTopic<T = unknown>(topicKey: string, options?: UseTopicOptions) {
  const normalizedTopicKey = topicKey.trim();
  const encoded = encodeURIComponent(normalizedTopicKey);
  const forceByDefault = options?.forceRefresh === true;
  const url = `/api/hub/topic/${encoded}${forceByDefault ? "?force=1" : ""}`;
  const swrKey = options?.enabled === false || !normalizedTopicKey ? null : url;
  const timeoutMs = options?.timeoutMs ?? 30_000;

  const swr = useSWR<TopicEnvelope<T>>(
    swrKey,
    (nextUrl: string) => topicFetcher<T>(nextUrl, timeoutMs),
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

  const refresh = useCallback(
    async (force = forceByDefault) => {
      const nextUrl = force ? `/api/hub/topic/${encoded}?force=1` : `/api/hub/topic/${encoded}`;
      const next = await topicFetcher<T>(nextUrl, timeoutMs);
      await swr.mutate(next, { revalidate: false });
      return next;
    },
    [encoded, forceByDefault, swr, timeoutMs],
  );

  return {
    envelope: swr.data ?? null,
    data: swr.data?.value ?? null,
    source: swr.data?.source ?? null,
    freshness: swr.data?.freshness ?? null,
    error: swr.error ?? swr.data?.error ?? null,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    refresh,
    mutate: swr.mutate,
  };
}
