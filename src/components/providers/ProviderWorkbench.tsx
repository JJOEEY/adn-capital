"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  fetchBacktestManifest,
  fetchScannerManifest,
  runBacktestProvider,
  runScannerProvider,
} from "@/lib/providers/client";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";
import type {
  BacktestManifestResponse,
  BacktestProviderManifest,
  ProviderDateRangeValue,
  ProviderField,
  ProviderInputValue,
  ProviderRunResponse,
  ScannerManifestResponse,
  ScannerProviderManifest,
} from "@/types/provider-manifest";

type ProviderMode = "backtest" | "scanner";
type FormValues = Record<string, ProviderInputValue>;

function defaultByFieldType(field: ProviderField): ProviderInputValue {
  if (field.default !== undefined) return field.default;
  if (field.type === "number") return 0;
  if (field.type === "boolean") return false;
  if (field.type === "multiselect") return [];
  if (field.type === "dateRange") return { start: "", end: "" };
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  return "";
}

function normalizeDateRange(value: ProviderInputValue): ProviderDateRangeValue {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "start" in value &&
    "end" in value &&
    typeof value.start === "string" &&
    typeof value.end === "string"
  ) {
    return value;
  }
  return { start: "", end: "" };
}

function buildInitialValues(provider: BacktestProviderManifest | ScannerProviderManifest | null): FormValues {
  if (!provider) return {};
  return provider.fields.reduce<FormValues>((acc, field) => {
    const providerDefault = provider.defaults?.[field.key];
    acc[field.key] = providerDefault !== undefined ? providerDefault : defaultByFieldType(field);
    return acc;
  }, {});
}

function coerceInputValue(field: ProviderField, rawValue: string, checked: boolean): ProviderInputValue {
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
  value: ProviderInputValue | undefined;
  onChange: (next: ProviderInputValue) => void;
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        rows={4}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
        value={typeof value === "string" ? value : ""}
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

  if (field.type === "multiselect") {
    return (
      <select
        multiple
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(event) => {
          const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
          onChange(selected);
        }}
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

  if (field.type === "dateRange") {
    const range = normalizeDateRange(value ?? null);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="date"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
          value={range.start}
          onChange={(event) => onChange({ ...range, start: event.target.value })}
        />
        <input
          type="date"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
          value={range.end}
          onChange={(event) => onChange({ ...range, end: event.target.value })}
        />
      </div>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      min={field.min}
      max={field.max}
      step={field.step}
      placeholder={field.placeholder}
      value={
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : field.type === "number"
          ? "0"
          : ""
      }
      onChange={(event) => onChange(coerceInputValue(field, event.target.value, event.target.checked))}
      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
    />
  );
}

export function ProviderWorkbench() {
  const [mode, setMode] = useState<ProviderMode>("backtest");
  const [loading, setLoading] = useState(true);

  const [backtestManifest, setBacktestManifest] = useState<BacktestManifestResponse | null>(null);
  const [scannerManifest, setScannerManifest] = useState<ScannerManifestResponse | null>(null);
  const [backtestProviderKey, setBacktestProviderKey] = useState("");
  const [scannerProviderKey, setScannerProviderKey] = useState("");
  const [values, setValues] = useState<FormValues>({});
  const [requestInsight, setRequestInsight] = useState(true);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<ProviderRunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const [backtestData, scannerData] = await Promise.all([
          fetchBacktestManifest(),
          fetchScannerManifest(),
        ]);
        if (!mounted) return;

        setBacktestManifest(backtestData);
        setScannerManifest(scannerData);

        const firstBacktest = backtestData.providers[0] ?? null;
        const firstScanner = scannerData.providers[0] ?? null;
        setBacktestProviderKey(firstBacktest?.providerKey ?? "");
        setScannerProviderKey(firstScanner?.providerKey ?? "");
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

  const activeProviders = mode === "backtest" ? backtestManifest?.providers ?? [] : scannerManifest?.providers ?? [];
  const activeProviderKey = mode === "backtest" ? backtestProviderKey : scannerProviderKey;
  const activeManifestMeta = mode === "backtest" ? backtestManifest : scannerManifest;
  const activeProvider = useMemo(
    () => activeProviders.find((item) => item.providerKey === activeProviderKey) ?? null,
    [activeProviderKey, activeProviders],
  );

  useEffect(() => {
    setValues(buildInitialValues(activeProvider));
    setRunResult(null);
    setRunError(null);
    setRequestInsight(activeProvider?.supportsInsight ?? false);
  }, [activeProvider?.providerKey]);

  const onRun = async () => {
    if (!activeProvider) return;
    setRunning(true);
    setRunError(null);
    try {
      const payload = {
        providerKey: activeProvider.providerKey,
        inputs: values,
        requestInsight: activeProvider.supportsInsight ? requestInsight : false,
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
            Bảng chạy thử nhà cung cấp
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Cấu hình chạy thử bộ quy tắc và bộ quét theo manifest nội bộ.
          </p>
        </div>
        <div className="inline-flex rounded-lg border p-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <button
            className="rounded-md px-3 py-1 text-xs font-semibold"
            style={mode === "backtest" ? { background: "var(--primary-light)", color: "var(--primary)" } : { color: "var(--text-secondary)" }}
            onClick={() => setMode("backtest")}
          >
            {PRODUCT_NAMES.backtest}
          </button>
          <button
            className="rounded-md px-3 py-1 text-xs font-semibold"
            style={mode === "scanner" ? { background: "var(--primary-light)", color: "var(--primary)" } : { color: "var(--text-secondary)" }}
            onClick={() => setMode("scanner")}
          >
            Bộ quét
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
        Source: <strong style={{ color: "var(--text-primary)" }}>{activeManifestMeta?.source ?? "fallback"}</strong>
        {" | "}
        Mode: <strong style={{ color: "var(--text-primary)" }}>{activeManifestMeta?.mode ?? "CONTRACT_FIRST_FALLBACK_MODE"}</strong>
      </div>
      {(activeManifestMeta?.warnings ?? []).length > 0 ? (
        <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.08)", color: "var(--text-primary)" }}>
          <p className="font-semibold">Manifest warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {(activeManifestMeta?.warnings ?? []).map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

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
              value={activeProviderKey}
              onChange={(event) => {
                const next = event.target.value;
                if (mode === "backtest") {
                  setBacktestProviderKey(next);
                } else {
                  setScannerProviderKey(next);
                }
              }}
            >
              {activeProviders.map((provider) => (
                <option key={provider.providerKey} value={provider.providerKey}>
                  {provider.title} ({provider.version})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {activeProvider.description || "No provider description."}
            </p>
          </div>

          <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Execution mode: <strong style={{ color: "var(--text-primary)" }}>{activeProvider.executionMode}</strong>
            </p>
            <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
              Capabilities:{" "}
              <strong style={{ color: "var(--text-primary)" }}>{activeProvider.capabilities.join(", ") || "none"}</strong>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {activeProvider.fields.map((field) => (
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

          {activeProvider.supportsInsight ? (
            <label className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={requestInsight}
                onChange={(event) => setRequestInsight(event.target.checked)}
              />
              <span>Request AI summary/insight after deterministic result</span>
            </label>
          ) : null}

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
            <div className="space-y-2">
              <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                <p>
                  Status: <strong style={{ color: "var(--text-primary)" }}>{runResult.status}</strong>
                </p>
                <p>
                  Deterministic:{" "}
                  <strong style={{ color: runResult.deterministic ? "var(--primary)" : "var(--danger)" }}>
                    {String(runResult.deterministic)}
                  </strong>
                </p>
                <p>
                  Source: <strong style={{ color: "var(--text-primary)" }}>{runResult.source}</strong>
                </p>
                {runResult.summary ? (
                  <p className="mt-2" style={{ color: "var(--text-primary)" }}>
                    Summary: {runResult.summary}
                  </p>
                ) : null}
                {runResult.insight ? (
                  <p className="mt-2" style={{ color: "var(--text-primary)" }}>
                    Insight: {runResult.insight}
                  </p>
                ) : null}
              </div>
              {runResult.warnings.length > 0 ? (
                <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.08)", color: "var(--text-primary)" }}>
                  <p className="font-semibold">Warnings</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {runResult.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {runResult.errors.length > 0 ? (
                <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--danger)", background: "rgba(192,57,43,0.08)", color: "var(--text-primary)" }}>
                  <p className="font-semibold">Errors</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {runResult.errors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <pre
                className="max-h-[360px] overflow-auto rounded-xl border p-3 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {JSON.stringify(runResult.result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
