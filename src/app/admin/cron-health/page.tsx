"use client";

import { useEffect, useState } from "react";

type CronJob = {
  cronType: string;
  aliases: string[];
  sourceOfTruth: string;
  usesLegacyAliasInLastRun: boolean;
  staleGraceMinutes: number;
  expectedSlot: string | null;
  staleReason: string;
  isStale: boolean;
  minutesSinceLastRun: number | null;
  lastRun: { cronName: string; at: string; status: string; message: string | null; durationMs: number | null } | null;
  lastSuccess: { cronName: string; at: string; message: string | null; durationMs: number | null } | null;
  lastError: { cronName: string; at: string; message: string | null; durationMs: number | null } | null;
};

type CronStatusPayload = {
  now: string;
  isStale: boolean;
  sourceOfTruth: string;
  jobs: CronJob[];
};

type TopicHealthPayload = {
  now: string;
  definitionsCount: number;
  cacheEntries: number;
  staleCount: number;
  cacheByFamily: Record<string, number>;
};

export default function AdminCronHealthPage() {
  const [cron, setCron] = useState<CronStatusPayload | null>(null);
  const [topic, setTopic] = useState<TopicHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cronRes, topicRes] = await Promise.all([
        fetch("/api/admin/system/cron-status", { cache: "no-store" }),
        fetch("/api/admin/system/topic-health", { cache: "no-store" }),
      ]);
      if (!cronRes.ok) throw new Error(`cron_status_http_${cronRes.status}`);
      if (!topicRes.ok) throw new Error(`topic_health_http_${topicRes.status}`);
      setCron((await cronRes.json()) as CronStatusPayload);
      setTopic((await topicRes.json()) as TopicHealthPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Cron & Topic Health</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Canonical cron matrix health and DataHub freshness snapshot for operations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          Làm mới
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Đang tải health snapshots...
        </div>
      ) : null}

      {!loading && cron ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-[var(--text-primary)]">Cron status</span>
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
              source: {cron.sourceOfTruth}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                cron.isStale
                  ? "bg-red-500/20 text-red-600 dark:text-red-300"
                  : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
              }`}
            >
              {cron.isStale ? "stale_detected" : "healthy"}
            </span>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-xs text-[var(--text-secondary)]">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--text-muted)]">
                  <th className="py-2 pr-3">Cron</th>
                  <th className="py-2 pr-3">Stale</th>
                  <th className="py-2 pr-3">Expected Slot</th>
                  <th className="py-2 pr-3">Last Run</th>
                  <th className="py-2 pr-3">Last Success</th>
                  <th className="py-2 pr-3">Legacy Alias</th>
                </tr>
              </thead>
              <tbody>
                {cron.jobs.map((job) => (
                  <tr key={job.cronType} className="border-b border-[var(--line)]">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-[var(--text-primary)]">{job.cronType}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{job.aliases.join(", ")}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={job.isStale ? "text-red-500" : "text-emerald-600"}>
                        {job.isStale ? "yes" : "no"}
                      </span>
                      <div className="text-[11px] text-[var(--text-muted)]">{job.staleReason}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {job.expectedSlot ?? "--"}{" "}
                      <span className="text-[11px] text-[var(--text-muted)]">(+{job.staleGraceMinutes}m)</span>
                    </td>
                    <td className="py-2 pr-3">
                      {job.lastRun ? new Date(job.lastRun.at).toLocaleString("vi-VN") : "--"}
                      <div className="text-[11px] text-[var(--text-muted)]">{job.minutesSinceLastRun ?? "--"} phút</div>
                    </td>
                    <td className="py-2 pr-3">
                      {job.lastSuccess ? new Date(job.lastSuccess.at).toLocaleString("vi-VN") : "--"}
                    </td>
                    <td className="py-2 pr-3">{job.usesLegacyAliasInLastRun ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && topic ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Topic health summary</div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-secondary)] p-3 text-sm">
              <div className="text-[var(--text-muted)]">definitions</div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">{topic.definitionsCount}</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-secondary)] p-3 text-sm">
              <div className="text-[var(--text-muted)]">cache entries</div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">{topic.cacheEntries}</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-secondary)] p-3 text-sm">
              <div className="text-[var(--text-muted)]">stale/error/expired</div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">{topic.staleCount}</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-secondary)] p-3 text-sm">
              <div className="text-[var(--text-muted)]">families</div>
              <div className="text-[var(--text-primary)]">{Object.keys(topic.cacheByFamily ?? {}).length}</div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
