"use client";

import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";

type TopicHydration = {
  topic: string;
  source: string;
  freshness: string;
  hasValue: boolean;
  error: { code?: string; message?: string } | null;
  updatedAt: string;
  expiresAt: string;
};

type DebugPayload = {
  ok: boolean;
  message?: string;
  runtime: {
    mode: string;
    flags: Record<string, unknown>;
    dependencies: Record<string, boolean>;
    blockers?: string[];
    canRunStagingSafeFlow?: boolean;
  };
  targetUser?: {
    id: string;
    email: string;
    name: string | null;
    dnseId: string | null;
    dnseVerified: boolean;
  };
  topics?: {
    expected: string[];
    hydrated: TopicHydration[];
  };
  readModel?: {
    latest: Record<string, unknown>;
    events: Array<Record<string, unknown>>;
  };
};

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h3 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <pre
        className="max-h-[420px] overflow-auto rounded-xl border p-3 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export default function AdminDnseExecutionPage() {
  const [targetUserId, setTargetUserId] = useState("");
  const [payload, setPayload] = useState<DebugPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fetchDebug = async (force = false) => {
    setLoading(true);
    setErrorText(null);
    try {
      const params = new URLSearchParams();
      if (targetUserId.trim()) params.set("targetUserId", targetUserId.trim());
      if (force) params.set("withTopics", "1");
      const res = await fetch(`/api/admin/system/dnse-execution?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as DebugPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "fetch_failed");
      setPayload(data);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "fetch_failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDebug(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topicsTable = useMemo(() => payload?.topics?.hydrated ?? [], [payload]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 md:p-6">
        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                DNSE Execution Debug
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Phase 5.2 staging-safe read model cho parse/validate/preview/submit + broker topic hydration.
              </p>
              <p className="mt-1 text-xs font-semibold" style={{ color: payload?.runtime?.canRunStagingSafeFlow ? "var(--success)" : "var(--danger)" }}>
                Readiness: {payload?.runtime?.canRunStagingSafeFlow ? "READY_FOR_STAGING_SAFE_SMOKE" : "BLOCKED"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="Target userId (optional)"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <button
                onClick={() => void fetchDebug(true)}
                disabled={loading}
                className="rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                {loading ? "Đang tải..." : "Làm mới"}
              </button>
            </div>
          </div>
          {errorText ? (
            <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
              {errorText}
            </p>
          ) : null}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <JsonCard title="Runtime Audit" value={payload?.runtime ?? null} />
          <JsonCard title="Target User" value={payload?.targetUser ?? null} />
        </div>

        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            Broker Topic Hydration
          </h3>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th className="pb-2 pr-3">Topic</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Freshness</th>
                  <th className="pb-2 pr-3">Has Value</th>
                  <th className="pb-2 pr-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {topicsTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3" style={{ color: "var(--text-muted)" }}>
                      No hydrated topics.
                    </td>
                  </tr>
                ) : (
                  topicsTable.map((row) => (
                    <tr key={row.topic} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>{row.topic}</td>
                      <td className="py-2 pr-3">{row.source}</td>
                      <td className="py-2 pr-3">{row.freshness}</td>
                      <td className="py-2 pr-3">{row.hasValue ? "yes" : "no"}</td>
                      <td className="py-2 pr-3" style={{ color: row.error ? "var(--danger)" : "var(--text-muted)" }}>
                        {row.error ? `${row.error.code ?? "error"}: ${row.error.message ?? ""}` : "--"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <JsonCard title="Latest Read Model" value={payload?.readModel?.latest ?? null} />
          <JsonCard title="Audit Events" value={payload?.readModel?.events ?? []} />
        </div>
      </div>
    </MainLayout>
  );
}
