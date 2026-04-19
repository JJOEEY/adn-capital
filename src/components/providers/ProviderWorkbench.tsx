"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  fetchBacktestManifest,
  fetchScannerManifest,
  runBacktestProvider,
  runScannerProvider,
} from "@/lib/providers/client";
import type {
  BacktestProviderManifest,
  ProviderField,
  ProviderRunResponse,
  ScannerProviderManifest,
} from "@/types/provider-manifest";

type ProviderMode = "backtest" | "scanner";
type FormValues = Record<string, string | number | boolean>;

function getDefaultValue(field: ProviderField): string | number | boolean {
  if (field.default !== undefined) return field.default;
  if (field.type === "number") return 0;
  if (field.type === "boolean") return false;
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  return "";
}

function buildInitialValues(provider: BacktestProviderManifest | ScannerProviderManifest | null): FormValues {
  if (!provider) return {};
  return provider.parameters.reduce<FormValues>((acc, field) => {
    acc[field.key] = getDefaultValue(field);
    return acc;
  }, {});
}

function coerceValue(field: ProviderField, rawValue: string, checked: boolean): string | number | boolean {
  if (field.type === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (field.type === "boolean") {
    return checked;
  }
  return rawValue;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ProviderField;
  value: string | number | boolean | undefined;
  onChange: (next: string | number | boolean) => void;
}) {
  if (field.type === "select") {
    return (
      <select
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      >
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-emerald-600"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>Enable</span>
      </label>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      min={field.min}
      max={field.max}
      step={field.step}
      value={String(value ?? "")}
      onChange={(event) => onChange(coerceValue(field, event.target.value, event.target.checked))}
      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
    />
  );
}

export function ProviderWorkbench() {
  const [mode, setMode] = useState<ProviderMode>("backtest");
  const [loading, setLoading] = useState(true);

  const [backtestProviders, setBacktestProviders] = useState<BacktestProviderManifest[]>([]);
  const [scannerProviders, setScannerProviders] = useState<ScannerProviderManifest[]>([]);
  const [backtestSource, setBacktestSource] = useState<"bridge" | "fallback">("fallback");
  const [scannerSource, setScannerSource] = useState<"bridge" | "fallback">("fallback");

  const [backtestProviderId, setBacktestProviderId] = useState("");
  const [scannerProviderId, setScannerProviderId] = useState("");
  const [values, setValues] = useState<FormValues>({});

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<ProviderRunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const [backtestManifest, scannerManifest] = await Promise.all([
          fetchBacktestManifest(),
          fetchScannerManifest(),
        ]);
        if (!mounted) return;

        setBacktestProviders(backtestManifest.providers);
        setScannerProviders(scannerManifest.providers);
        setBacktestSource(backtestManifest.source);
        setScannerSource(scannerManifest.source);

        const firstBacktest = backtestManifest.providers[0] ?? null;
        const firstScanner = scannerManifest.providers[0] ?? null;
        setBacktestProviderId(firstBacktest?.provider ?? "");
        setScannerProviderId(firstScanner?.provider ?? "");
        setValues(buildInitialValues(firstBacktest));
      } catch (error) {
        if (!mounted) return;
        setRunError(error instanceof Error ? error.message : "Cannot load provider manifests");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  const activeProviders = mode === "backtest" ? backtestProviders : scannerProviders;
  const activeProviderId = mode === "backtest" ? backtestProviderId : scannerProviderId;
  const activeSource = mode === "backtest" ? backtestSource : scannerSource;
  const activeProvider = useMemo(
    () => activeProviders.find((item) => item.provider === activeProviderId) ?? null,
    [activeProviderId, activeProviders],
  );

  useEffect(() => {
    setValues(buildInitialValues(activeProvider));
    setRunResult(null);
    setRunError(null);
  }, [activeProvider?.provider]);

  const onRun = async () => {
    if (!activeProvider) return;
    setRunning(true);
    setRunError(null);
    try {
      const payload = {
        provider: activeProvider.provider,
        params: values,
      };
      const result =
        mode === "backtest"
          ? await runBacktestProvider(payload)
          : await runScannerProvider(payload);
      startTransition(() => {
        setRunResult(result);
      });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Provider execution failed");
      setRunResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
            Provider Workbench
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Manifest-driven backtest/scanner runtime.
          </p>
        </div>
        <div className="inline-flex rounded-lg border p-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <button
            className="rounded-md px-3 py-1 text-xs font-semibold"
            style={mode === "backtest" ? { background: "var(--primary-light)", color: "var(--primary)" } : { color: "var(--text-secondary)" }}
            onClick={() => setMode("backtest")}
          >
            Backtest
          </button>
          <button
            className="rounded-md px-3 py-1 text-xs font-semibold"
            style={mode === "scanner" ? { background: "var(--primary-light)", color: "var(--primary)" } : { color: "var(--text-secondary)" }}
            onClick={() => setMode("scanner")}
          >
            Scanner
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
        Source: <strong style={{ color: "var(--text-primary)" }}>{activeSource}</strong>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--bg-hover)]" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-[var(--bg-hover)]" />
        </div>
      ) : !activeProvider ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          No provider available.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Provider
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              value={activeProviderId}
              onChange={(event) => {
                const next = event.target.value;
                if (mode === "backtest") {
                  setBacktestProviderId(next);
                } else {
                  setScannerProviderId(next);
                }
              }}
            >
              {activeProviders.map((provider) => (
                <option key={provider.provider} value={provider.provider}>
                  {provider.label} ({provider.version})
                </option>
              ))}
            </select>
            {activeProvider.description ? (
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {activeProvider.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {activeProvider.parameters.map((field) => (
              <div key={field.key} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <div className="mt-1">
                  <FieldInput
                    field={field}
                    value={values[field.key]}
                    onChange={(nextValue) => setValues((prev) => ({ ...prev, [field.key]: nextValue }))}
                  />
                </div>
                {field.helpText ? (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {field.helpText}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <button
            onClick={onRun}
            disabled={running}
            className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            {running ? "Running..." : "Run Provider"}
          </button>

          {runError ? (
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--danger)", background: "rgba(192,57,43,0.08)", color: "var(--text-primary)" }}>
              {runError}
            </div>
          ) : null}

          {runResult ? (
            <pre
              className="max-h-[360px] overflow-auto rounded-xl border p-3 text-xs"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {JSON.stringify(runResult, null, 2)}
            </pre>
          ) : null}
        </div>
      )}
    </section>
  );
}
