"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleOff, Link2, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { OrderTicketPanel } from "@/components/broker/OrderTicketPanel";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useTopics } from "@/hooks/useTopics";

type BrokerPosition = {
  ticker: string;
  entryPrice: number | null;
  currentPrice: number | null;
  pnlPercent: number | null;
  target: number | null;
  stoploss: number | null;
  navAllocation: number | null;
  type: string | null;
  tier: string | null;
};

type BrokerBalanceTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  navAllocatedPct?: number;
  navRemainingPct?: number;
  maxActiveNavPct?: number;
};

type BrokerHoldingsTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  holdings?: BrokerPosition[];
  positions?: BrokerPosition[];
};

type BrokerOrdersTopic = {
  connected: boolean;
  reason?: string;
  source?: string;
  orders?: Array<{
    ticker?: string;
    side?: string;
    quantity?: number;
    price?: number | null;
    status?: string;
    submittedAt?: string | null;
    brokerOrderId?: string | null;
  }>;
};

const DNSE_LOGIN_URL = process.env.NEXT_PUBLIC_DNSE_LOGIN_URL || "https://banggia.dnse.com.vn/";

function fmtPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("vi-VN");
}

function pnlTone(value: number | null | undefined) {
  const num = Number(value ?? 0);
  if (num >= 0) return { color: "#16a34a", bg: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.25)" };
  return { color: "var(--danger)", bg: "rgba(192,57,43,0.10)", border: "rgba(192,57,43,0.25)" };
}

export function DnseTradingClient() {
  const { dbUser, isLoading } = useCurrentDbUser();
  const searchParams = useSearchParams();
  const queryTicker = (searchParams.get("ticker") ?? "").trim().toUpperCase();

  const [ticker, setTicker] = useState(queryTicker || "HPG");
  const [dnseIdInput, setDnseIdInput] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (queryTicker) setTicker(queryTicker);
  }, [queryTicker]);

  useEffect(() => {
    if (dbUser?.dnseId) setDnseIdInput(dbUser.dnseId);
  }, [dbUser?.dnseId]);

  const topicKeys = useMemo(
    () => [
      "broker:dnse:current-user:balance",
      "broker:dnse:current-user:holdings",
      "broker:dnse:current-user:positions",
      "broker:dnse:current-user:orders",
    ],
    [],
  );

  const brokerTopics = useTopics(topicKeys, {
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const balanceTopic = brokerTopics.byTopic.get("broker:dnse:current-user:balance")?.value as BrokerBalanceTopic | null | undefined;
  const holdingsTopic = brokerTopics.byTopic.get("broker:dnse:current-user:holdings")?.value as BrokerHoldingsTopic | null | undefined;
  const positionsTopic = brokerTopics.byTopic.get("broker:dnse:current-user:positions")?.value as BrokerHoldingsTopic | null | undefined;
  const ordersTopic = brokerTopics.byTopic.get("broker:dnse:current-user:orders")?.value as BrokerOrdersTopic | null | undefined;

  const holdings = useMemo(() => {
    const fromHoldings = holdingsTopic?.holdings ?? [];
    if (fromHoldings.length > 0) return fromHoldings;
    return holdingsTopic?.positions ?? positionsTopic?.positions ?? [];
  }, [holdingsTopic?.holdings, holdingsTopic?.positions, positionsTopic?.positions]);

  useEffect(() => {
    if (!queryTicker && holdings.length > 0) {
      setTicker((prev) => (prev ? prev : holdings[0].ticker));
    }
  }, [holdings, queryTicker]);

  const isConnected = Boolean(dbUser?.dnseId && dbUser?.dnseVerified);

  async function handleSaveDnseId() {
    const next = dnseIdInput.trim();
    if (!next) {
      setSubmitError("Vui lòng nhập ID DNSE hợp lệ.");
      setSubmitMessage(null);
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitMessage(null);
    try {
      const res = await fetch("/api/user/dnse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dnseId: next }),
      });
      const payload = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Không thể liên kết ID DNSE.");
      }
      setSubmitMessage(payload.message ?? "Đã gửi yêu cầu liên kết DNSE, chờ admin xác minh.");
      await brokerTopics.refresh(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể liên kết ID DNSE.");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            DNSE Trading
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Kết nối tài khoản DNSE của bạn để theo dõi NAV, danh mục nắm giữ và đặt lệnh an toàn.
          </p>
        </div>
        <button
          onClick={() => void brokerTopics.refresh(true)}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${brokerTopics.isValidating ? "animate-spin" : ""}`} />
          Làm mới dữ liệu
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border p-4 md:col-span-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              Liên kết tài khoản DNSE
            </h2>
          </div>

          {isLoading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Đang tải thông tin tài khoản...
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-2 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  ID: {dbUser?.dnseId ?? "--"}
                </span>
                {dbUser?.dnseVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold" style={{ borderColor: "rgba(22,163,74,0.25)", color: "#16a34a", background: "rgba(22,163,74,0.10)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Đã xác minh
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold" style={{ borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b", background: "rgba(245,158,11,0.10)" }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Chờ xác minh
                  </span>
                )}
              </div>

              {dbUser?.dnseVerified ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Tài khoản DNSE đã xác minh. Bạn có thể đặt lệnh trong khu vực bên dưới theo các guard an toàn hệ thống.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Các bước kết nối DNSE</p>
                    <p>1. Bấm “Đăng nhập DNSE” để đăng nhập tài khoản DNSE của bạn ở tab mới.</p>
                    <p>2. Lấy mã tài khoản/tiểu khoản DNSE chính của bạn.</p>
                    <p>3. Dán ID vào ô bên dưới và bấm “Liên kết DNSE”.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={DNSE_LOGIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Đăng nhập DNSE
                    </a>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={dnseIdInput}
                      onChange={(event) => setDnseIdInput(event.target.value)}
                      placeholder="Nhập ID DNSE chính"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={() => void handleSaveDnseId()}
                      disabled={submitLoading}
                      className="rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-60"
                      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                    >
                      {submitLoading ? "Đang liên kết..." : "Liên kết DNSE"}
                    </button>
                  </div>

                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Sau khi liên kết, admin xác minh để kích hoạt luồng đặt lệnh an toàn cho tài khoản của bạn.
                  </p>
                </div>
              )}
            </>
          )}

          {submitMessage ? (
            <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(22,163,74,0.25)", color: "#16a34a", background: "rgba(22,163,74,0.10)" }}>
              {submitMessage}
            </div>
          ) : null}
          {submitError ? (
            <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(192,57,43,0.25)", color: "var(--danger)", background: "rgba(192,57,43,0.10)" }}>
              {submitError}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              NAV & sức mua
            </h2>
          </div>
          {isConnected ? (
            <div className="space-y-2 text-sm">
              <p style={{ color: "var(--text-secondary)" }}>
                NAV đã phân bổ: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{Number(balanceTopic?.navAllocatedPct ?? 0).toFixed(2)}%</span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                NAV còn lại: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{Number(balanceTopic?.navRemainingPct ?? 0).toFixed(2)}%</span>
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                Trần NAV active: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{Number(balanceTopic?.maxActiveNavPct ?? 90).toFixed(0)}%</span>
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Source: {balanceTopic?.source ?? "N/A"}
              </p>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <CircleOff className="h-3.5 w-3.5" /> Chưa có dữ liệu NAV vì tài khoản DNSE chưa xác minh.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr,1fr]">
        <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            Danh mục đang nắm giữ
          </h2>
          {holdings.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có vị thế nắm giữ. Bạn có thể chọn mã từ{" "}
              <Link href="/dashboard/signal-map" style={{ color: "var(--primary)", fontWeight: 700 }}>
                ADN AI Broker
              </Link>{" "}
              để đặt lệnh.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {holdings.map((row) => {
                const pnl = Number(row.pnlPercent ?? 0);
                const tone = pnlTone(pnl);
                return (
                  <button
                    key={`${row.ticker}-${row.entryPrice ?? 0}`}
                    onClick={() => setTicker(row.ticker)}
                    className="rounded-xl border p-3 text-left transition-all hover:translate-y-[-1px]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{row.ticker}</p>
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(2)}%
                      </span>
                    </div>
                    <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <p>Entry: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(row.entryPrice)}</span></p>
                      <p>Hiện tại: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(row.currentPrice)}</span></p>
                      <p>Target / SL: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(row.target)} / {fmtPrice(row.stoploss)}</span></p>
                      <p>NAV: <span style={{ color: "var(--text-primary)" }}>{Number(row.navAllocation ?? 0).toFixed(2)}%</span></p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            Lệnh gần nhất
          </h2>
          {Array.isArray(ordersTopic?.orders) && ordersTopic.orders.length > 0 ? (
            <div className="space-y-2">
              {ordersTopic.orders.slice(0, 6).map((order, index) => (
                <div key={`${order.brokerOrderId ?? order.ticker ?? "order"}-${index}`} className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {order.side ?? "--"} {order.ticker ?? "--"}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{order.status ?? "--"}</span>
                  </div>
                  <p style={{ color: "var(--text-muted)" }}>
                    KL: {order.quantity ?? 0} · Giá: {fmtPrice(order.price ?? null)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có lịch sử lệnh từ DNSE execution audit.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            Đặt lệnh chủ động
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="Nhập mã cổ phiếu"
              className="w-36 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
        <OrderTicketPanel ticker={(ticker || "HPG").trim().toUpperCase()} />
      </div>
    </div>
  );
}
