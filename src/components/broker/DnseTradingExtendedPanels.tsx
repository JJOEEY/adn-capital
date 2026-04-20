"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTopics } from "@/hooks/useTopics";

type AccountsTopic = {
  connected: boolean;
  source?: string;
  reason?: string;
  accounts?: Array<{
    accountNo: string;
    accountName: string | null;
    custodyCode: string | null;
    accountType: string;
    status: string;
  }>;
};

type LoanPackagesTopic = {
  connected: boolean;
  source?: string;
  reason?: string;
  loanPackages?: Array<{
    loanPackageId: string;
    loanPackageName: string;
    interestRate?: number | null;
    maxLoanRatio?: number | null;
    minAmount?: number | null;
    description?: string | null;
  }>;
};

type OrderHistoryTopic = {
  connected: boolean;
  source?: string;
  reason?: string;
  orderHistory?: Array<{
    ticker?: string | null;
    side?: string | null;
    quantity?: number | null;
    price?: number | null;
    status?: string | null;
    submittedAt?: string | null;
    brokerOrderId?: string | null;
  }>;
};

type PpseTopic = {
  connected: boolean;
  source?: string;
  reason?: string;
  ppse?: {
    symbol?: string | null;
    buyingPower?: number | null;
    sellingPower?: number | null;
    maxBuyQty?: number | null;
    maxSellQty?: number | null;
  } | null;
};

function fmtMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

function fmtNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString("vi-VN");
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

export function DnseTradingExtendedPanels() {
  const searchParams = useSearchParams();
  const defaultTicker = (searchParams.get("ticker") ?? "HPG").trim().toUpperCase();
  const [ticker, setTicker] = useState(defaultTicker.length > 0 ? defaultTicker : "HPG");

  const normalizedTicker = (ticker || "HPG").trim().toUpperCase();
  const topicKeys = useMemo(
    () => [
      "broker:dnse:current-user:accounts",
      "broker:dnse:current-user:loan-packages",
      "broker:dnse:current-user:order-history",
      `broker:dnse:current-user:ppse:${normalizedTicker}`,
    ],
    [normalizedTicker],
  );

  const topicState = useTopics(topicKeys, {
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const accountsTopic = topicState.byTopic.get("broker:dnse:current-user:accounts")
    ?.value as AccountsTopic | null | undefined;
  const loanPackagesTopic = topicState.byTopic.get("broker:dnse:current-user:loan-packages")
    ?.value as LoanPackagesTopic | null | undefined;
  const orderHistoryTopic = topicState.byTopic.get("broker:dnse:current-user:order-history")
    ?.value as OrderHistoryTopic | null | undefined;
  const ppseTopic = topicState.byTopic.get(`broker:dnse:current-user:ppse:${normalizedTicker}`)
    ?.value as PpseTopic | null | undefined;

  const accounts = accountsTopic?.accounts ?? [];
  const loanPackages = loanPackagesTopic?.loanPackages ?? [];
  const orderHistory = orderHistoryTopic?.orderHistory ?? [];
  const ppse = ppseTopic?.ppse ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 pb-4 md:px-6">
      <div className="grid gap-3 lg:grid-cols-3">
        <section
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h3
            className="mb-2 text-sm font-black uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Tài khoản giao dịch
          </h3>
          {accounts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có dữ liệu tài khoản từ DNSE API.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.accountNo}
                  className="rounded-xl border p-2 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  <p style={{ color: "var(--text-primary)", fontWeight: 700 }}>{account.accountNo}</p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    {account.accountName || "--"} · {account.accountType}
                  </p>
                  <p style={{ color: "var(--text-muted)" }}>
                    {account.custodyCode || "--"} · {account.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h3
            className="mb-2 text-sm font-black uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Gói vay margin
          </h3>
          {loanPackages.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có dữ liệu gói vay khả dụng.
            </p>
          ) : (
            <div className="space-y-2">
              {loanPackages.slice(0, 5).map((pkg) => (
                <div
                  key={pkg.loanPackageId}
                  className="rounded-xl border p-2 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  <p style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                    {pkg.loanPackageName}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    Lãi suất: {pkg.interestRate != null ? `${pkg.interestRate}%/năm` : "--"}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    Max loan ratio:{" "}
                    {pkg.maxLoanRatio != null ? `${pkg.maxLoanRatio}%` : "--"}
                  </p>
                  <p style={{ color: "var(--text-muted)" }}>
                    Min: {fmtMoney(pkg.minAmount ?? null)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h3
            className="mb-2 text-sm font-black uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            PPSE / Sức mua theo mã
          </h3>
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            placeholder="Nhập mã cổ phiếu"
            className="mb-2 w-full rounded-xl border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          />
          {ppse ? (
            <div
              className="rounded-xl border p-2 text-xs"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <p style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                Mã: {ppse.symbol ?? normalizedTicker}
              </p>
              <p style={{ color: "var(--text-secondary)" }}>Sức mua: {fmtMoney(ppse.buyingPower)}</p>
              <p style={{ color: "var(--text-secondary)" }}>Sức bán: {fmtMoney(ppse.sellingPower)}</p>
              <p style={{ color: "var(--text-secondary)" }}>KL mua tối đa: {fmtNumber(ppse.maxBuyQty)}</p>
              <p style={{ color: "var(--text-secondary)" }}>KL bán tối đa: {fmtNumber(ppse.maxSellQty)}</p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Chưa có dữ liệu PPSE cho mã này.
            </p>
          )}
        </section>
      </div>

      <section
        className="rounded-2xl border p-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3
          className="mb-2 text-sm font-black uppercase tracking-wide"
          style={{ color: "var(--text-primary)" }}
        >
          Lịch sử lệnh DNSE
        </h3>
        {orderHistory.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Chưa có lịch sử lệnh.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th className="px-2 py-1 text-left font-semibold">Thời gian</th>
                  <th className="px-2 py-1 text-left font-semibold">Mã</th>
                  <th className="px-2 py-1 text-left font-semibold">Side</th>
                  <th className="px-2 py-1 text-right font-semibold">KL</th>
                  <th className="px-2 py-1 text-right font-semibold">Giá</th>
                  <th className="px-2 py-1 text-left font-semibold">Trạng thái</th>
                  <th className="px-2 py-1 text-left font-semibold">Order ID</th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.slice(0, 12).map((order, index) => (
                  <tr key={`${order.brokerOrderId ?? order.ticker ?? "history"}-${index}`}>
                    <td className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
                      {fmtDateTime(order.submittedAt)}
                    </td>
                    <td className="px-2 py-1" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                      {order.ticker ?? "--"}
                    </td>
                    <td className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
                      {order.side ?? "--"}
                    </td>
                    <td className="px-2 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
                      {fmtNumber(order.quantity)}
                    </td>
                    <td className="px-2 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
                      {fmtNumber(order.price)}
                    </td>
                    <td className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
                      {order.status ?? "--"}
                    </td>
                    <td className="px-2 py-1" style={{ color: "var(--text-muted)" }}>
                      {order.brokerOrderId ?? "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

