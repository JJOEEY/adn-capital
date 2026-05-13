"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { formatPrice } from "@/lib/utils";

type WatchlistItem = {
  id: string;
  ticker: string;
  source: string | null;
  updatedAt: string;
  signal: {
    id: string;
    status: string;
    tier: string | null;
    type: string | null;
    entryPrice: number | null;
    currentPrice: number | null;
    currentPnl: number | null;
    target: number | null;
    stoploss: number | null;
    updatedAt: string;
  } | null;
};

type WatchlistPayload = {
  items: WatchlistItem[];
  error?: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Không tải được Watchlist");
  return data as WatchlistPayload;
};

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function WatchlistContent() {
  const searchParams = useSearchParams();
  const initialTicker = normalizeTicker(searchParams.get("ticker") ?? "");
  const [tickerInput, setTickerInput] = useState(initialTicker);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data, mutate, isLoading, isValidating } = useSWR<WatchlistPayload>("/api/watchlist", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  useEffect(() => {
    if (initialTicker) setTickerInput(initialTicker);
  }, [initialTicker]);

  const items = data?.items ?? [];
  const activeCount = useMemo(
    () => items.filter((item) => item.signal?.status === "ACTIVE" || item.signal?.status === "HOLD_TO_DIE").length,
    [items],
  );

  async function addTicker(ticker: string, source = "manual") {
    const normalized = normalizeTicker(ticker);
    if (!normalized) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: normalized, source }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Không thêm được mã");
      await mutate(payload, { revalidate: false });
      setTickerInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được mã");
    } finally {
      setSaving(false);
    }
  }

  async function removeTicker(ticker: string) {
    setError("");
    const res = await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setError(payload?.error || "Không xóa được mã");
      return;
    }
    await mutate(payload, { revalidate: false });
  }

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-6 md:px-6">
        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
                Watchlist
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Theo dõi mã từ Radar và kế hoạch giao dịch, không tự quét thêm dữ liệu theo từng khách.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void mutate()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              aria-label="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
            </button>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void addTicker(tickerInput);
            }}
          >
            <input
              value={tickerInput}
              onChange={(event) => setTickerInput(normalizeTicker(event.target.value))}
              placeholder="Nhập mã: SSI, HPG..."
              autoCapitalize="characters"
              autoCorrect="off"
              className="h-11 min-w-0 flex-1 rounded-xl border px-3 text-[16px] font-bold uppercase outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            />
            <button
              type="submit"
              disabled={saving || !tickerInput}
              className="flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              <Plus className="h-4 w-4" />
              Thêm
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}>
              {error}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{items.length}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Mã theo dõi</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{activeCount}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Đang ACTIVE</p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-2xl" style={{ background: "var(--surface)" }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Chưa có mã theo dõi.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Vào Radar và bấm Theo dõi, hoặc nhập mã ở phía trên.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const pnl = item.signal?.currentPnl;
              const positive = typeof pnl === "number" && pnl >= 0;
              const displayPrice = item.signal?.currentPrice ?? item.signal?.entryPrice ?? null;
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/stock/${item.ticker}`} className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-mono text-xl font-black" style={{ color: "var(--text-primary)" }}>
                          {item.ticker}
                        </h2>
                        {item.signal?.status && (
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-black"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            {item.signal.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        Giá: <span className="font-bold" style={{ color: "var(--text-primary)" }}>{displayPrice ? formatPrice(displayPrice) : "--"}</span>
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeTicker(item.ticker)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      aria-label={`Xóa ${item.ticker}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>P/L</p>
                      <p className="flex items-center gap-1 font-black" style={{ color: positive ? "#16a34a" : "#ef4444" }}>
                        {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {formatPercent(pnl)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Target</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>{item.signal?.target ? formatPrice(item.signal.target) : "--"}</p>
                    </div>
                    <div>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Stoploss</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>{item.signal?.stoploss ? formatPrice(item.signal.stoploss) : "--"}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={null}>
      <WatchlistContent />
    </Suspense>
  );
}
