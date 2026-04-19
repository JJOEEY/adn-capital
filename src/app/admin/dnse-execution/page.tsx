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
    rollout?: Record<string, unknown>;
    dependencies: Record<string, boolean>;
    blockers?: string[];
    warnings?: string[];
    canRunStagingSafeFlow?: boolean;
    expectedSubmitStatus?: string;
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
    chains?: Array<Record<string, unknown>>;
    filters?: Record<string, unknown>;
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
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterTicker, setFilterTicker] = useState("");
  const [filterActions, setFilterActions] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [payload, setPayload] = useState<DebugPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fetchDebug = async (force = false) => {
    setLoading(true);
    setErrorText(null);
    try {
      const params = new URLSearchParams();
      if (targetUserId.trim()) params.set("targetUserId", targetUserId.trim());
      if (filterAccountId.trim()) params.set("accountId", filterAccountId.trim());
      if (filterTicker.trim()) params.set("ticker", filterTicker.trim().toUpperCase());
      if (filterActions.trim()) params.set("actions", filterActions.trim());
      if (filterFrom.trim()) params.set("from", filterFrom.trim());
      if (filterTo.trim()) params.set("to", filterTo.trim());
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

  const runtimeRollout = payload?.runtime?.rollout ?? {};
  const killSwitchEnabled = runtimeRollout && runtimeRollout.killSwitchEnabled === true;
  const allowlistEnforced = runtimeRollout && runtimeRollout.allowlistEnforced === true;
  const allowlistMatched = runtimeRollout && runtimeRollout.allowlistMatched === true;
  const topicsTable = useMemo(() => payload?.topics?.hydrated ?? [], [payload]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1760px] space-y-4 p-4 md:p-6">
        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
            <div>
              <h1 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                DNSE Execution Debug
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Controlled-pilot debug: runtime readiness, kill switch, allowlist rollout, and decision chain.
              </p>
              <p className="mt-1 text-xs font-semibold" style={{ color: payload?.runtime?.canRunStagingSafeFlow ? "var(--success)" : "var(--danger)" }}>
                Readiness: {payload?.runtime?.canRunStagingSafeFlow ? "READY" : "BLOCKED"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
                <span
                  className="rounded-full border px-2 py-0.5"
                  style={{
                    borderColor: killSwitchEnabled ? "var(--danger)" : "var(--success)",
                    color: killSwitchEnabled ? "var(--danger)" : "var(--success)",
                  }}
                >
                  Kill Switch: {killSwitchEnabled ? "ON" : "OFF"}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5"
                  style={{
                    borderColor: allowlistEnforced ? "var(--warning)" : "var(--border)",
                    color: allowlistEnforced ? "var(--warning)" : "var(--text-secondary)",
                  }}
                >
                  Allowlist: {allowlistEnforced ? (allowlistMatched ? "MATCHED" : "NO MATCH") : "DISABLED"}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Expected Submit: {payload?.runtime?.expectedSubmitStatus ?? "--"}
                </span>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="Target userId"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <input
                value={filterAccountId}
                onChange={(event) => setFilterAccountId(event.target.value)}
                placeholder="Filter accountId"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <input
                value={filterTicker}
                onChange={(event) => setFilterTicker(event.target.value)}
                placeholder="Filter ticker"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <input
                value={filterActions}
                onChange={(event) => setFilterActions(event.target.value)}
                placeholder="Actions CSV"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <input
                value={filterFrom}
                onChange={(event) => setFilterFrom(event.target.value)}
                placeholder="From YYYY-MM-DD"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <input
                value={filterTo}
                onChange={(event) => setFilterTo(event.target.value)}
                placeholder="To YYYY-MM-DD"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              />
              <button
                onClick={() => void fetchDebug(true)}
                disabled={loading}
                className="rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60 md:col-span-2"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                {loading ? "Loading..." : "Refresh"}
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
          <JsonCard title="Latest Decision Read Model" value={payload?.readModel?.latest ?? null} />
          <JsonCard title="Decision Chains" value={payload?.readModel?.chains ?? []} />
        </div>

        <JsonCard title="Audit Events" value={payload?.readModel?.events ?? []} />
      </div>
    </MainLayout>
  );
}
