"use client";

import { useEffect, useMemo, useState } from "react";

type WorkflowDefinitionItem = {
  workflowKey: string;
  title: string;
  enabled: boolean;
  trigger: { type: string; config?: Record<string, unknown> };
  actions: Array<{ type: string; actionKey?: string; continueOnError?: boolean }>;
  retryPolicy: { maxAttempts?: number; delayMs?: number } | null;
  tags: string[];
  lastRun: {
    id: string;
    status: string;
    message: string | null;
    createdAt: string;
    duration: number | null;
  } | null;
};

type WorkflowRunItem = {
  id: string;
  workflowKey: string;
  status: string;
  message: string | null;
  duration: number | null;
  createdAt: string;
  execution?: {
    triggerType?: string;
    triggerSource?: string;
    retries?: number;
    actions?: Array<{
      actionKey: string;
      type: string;
      status: string;
      attempts: number;
      warning?: string | null;
      error?: string | null;
    }>;
  } | null;
};

export default function AdminWorkflowsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<WorkflowDefinitionItem[]>([]);
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);

  async function loadData() {
    setError(null);
    try {
      const [defRes, runRes] = await Promise.all([
        fetch("/api/admin/system/workflows", { cache: "no-store" }),
        fetch("/api/admin/system/workflows/runs?limit=60", { cache: "no-store" }),
      ]);

      if (!defRes.ok) {
        const msg = await defRes.text();
        throw new Error(`definitions_http_${defRes.status}: ${msg}`);
      }
      if (!runRes.ok) {
        const msg = await runRes.text();
        throw new Error(`runs_http_${runRes.status}: ${msg}`);
      }

      const defJson = (await defRes.json()) as { definitions: WorkflowDefinitionItem[] };
      const runJson = (await runRes.json()) as { runs: WorkflowRunItem[] };
      setDefinitions(Array.isArray(defJson.definitions) ? defJson.definitions : []);
      setRuns(Array.isArray(runJson.runs) ? runJson.runs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 45_000);
    return () => clearInterval(timer);
  }, []);

  const runMap = useMemo(() => {
    const map = new Map<string, WorkflowRunItem[]>();
    for (const run of runs) {
      const current = map.get(run.workflowKey) ?? [];
      current.push(run);
      map.set(run.workflowKey, current);
    }
    return map;
  }, [runs]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Workflow Runtime</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Registry-driven, JSON-first runtime for trigger/action automation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadData();
          }}
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
          Đang tải workflow runtime...
        </div>
      ) : null}

      {!loading && definitions.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Chưa có workflow definition nào.
        </div>
      ) : null}

      {definitions.map((definition) => {
        const relatedRuns = runMap.get(definition.workflowKey) ?? [];
        return (
          <section
            key={definition.workflowKey}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 md:p-5"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{definition.title}</h2>
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {definition.workflowKey}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  definition.enabled
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                    : "bg-gray-400/20 text-gray-600 dark:text-gray-300"
                }`}
              >
                {definition.enabled ? "enabled" : "disabled"}
              </span>
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                trigger: {definition.trigger.type}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--line)] p-3">
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Actions</p>
                <ul className="space-y-1 text-sm text-[var(--text-muted)]">
                  {definition.actions.map((action, idx) => (
                    <li key={`${definition.workflowKey}-action-${idx}`}>
                      {idx + 1}. {action.type}
                      {action.continueOnError ? " (continueOnError)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-[var(--line)] p-3 text-sm text-[var(--text-muted)]">
                <p className="mb-2 font-medium text-[var(--text-primary)]">Last Run</p>
                {definition.lastRun ? (
                  <div className="space-y-1">
                    <div>Status: {definition.lastRun.status}</div>
                    <div>At: {new Date(definition.lastRun.createdAt).toLocaleString("vi-VN")}</div>
                    <div>Duration: {definition.lastRun.duration ?? 0}ms</div>
                    <div>Message: {definition.lastRun.message ?? "-"}</div>
                  </div>
                ) : (
                  <div>Chưa có run.</div>
                )}
              </div>
            </div>

            {relatedRuns.length > 0 ? (
              <div className="mt-4 rounded-lg border border-[var(--line)] p-3">
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Recent Runs</p>
                <div className="space-y-2">
                  {relatedRuns.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="rounded-md border border-[var(--line)] bg-[var(--bg-secondary)] p-2 text-xs text-[var(--text-muted)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{run.status}</span>
                        <span>{new Date(run.createdAt).toLocaleString("vi-VN")}</span>
                        <span>{run.duration ?? 0}ms</span>
                        <span>retries: {run.execution?.retries ?? 0}</span>
                      </div>
                      <div className="mt-1">{run.message ?? "-"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

