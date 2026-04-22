"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LogIn,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type BrokerAccount = {
  accountNo: string;
  accountName: string | null;
  custodyCode: string | null;
  accountType: string;
  status: string;
};

type DnseAccountInfoProps = {
  loading: boolean;
  linked: boolean;
  accountId?: string | null;
  accountName?: string | null;
  subAccountId?: string | null;
  accessTokenExpiresAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  hasApiKeyConfigured: boolean;
  accounts: BrokerAccount[];
  onOpenLogin: () => void;
  onOpenLinkSelector: () => void;
  onChangedAccount: () => void;
};

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

export function DnseAccountInfo({
  loading,
  linked,
  accountId,
  accountName,
  subAccountId,
  accessTokenExpiresAt,
  lastSyncedAt,
  lastError,
  hasApiKeyConfigured,
  accounts,
  onOpenLogin,
  onOpenLinkSelector,
  onChangedAccount,
}: DnseAccountInfoProps) {
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const tokenExpired =
    Boolean(accessTokenExpiresAt) &&
    !Number.isNaN(new Date(accessTokenExpiresAt as string).getTime()) &&
    new Date(accessTokenExpiresAt as string).getTime() <= Date.now();

  async function handleChangeAccount() {
    const confirmed = window.confirm(
      `Đổi tài khoản DNSE\n\nBạn có chắc muốn gỡ liên kết tài khoản hiện tại (${accountId ?? "--"}) để liên kết tài khoản khác không?`,
    );
    if (!confirmed) return;

    setUnlinking(true);
    setUnlinkError(null);
    try {
      const response = await fetch("/api/user/dnse/link", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Không thể đổi tài khoản DNSE.");
      }
      onChangedAccount();
    } catch (error) {
      setUnlinkError(
        error instanceof Error ? error.message : "Không thể đổi tài khoản DNSE.",
      );
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div
      className="rounded-2xl border p-4 md:col-span-2"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h2
            className="text-sm font-black uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Tài khoản DNSE chính
          </h2>
        </div>
        {linked ? (
          <button
            onClick={() => void handleChangeAccount()}
            disabled={unlinking}
            className="rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "rgba(37,99,235,0.25)",
              color: "#1d4ed8",
              background: "rgba(37,99,235,0.08)",
            }}
            title="Gỡ liên kết và chọn tài khoản DNSE khác"
          >
            {unlinking ? "Đang xử lý..." : "Đổi tài khoản"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Đang tải thông tin kết nối DNSE...
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              ID: {accountId ?? "--"}
            </span>
            {linked ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
                style={{
                  borderColor: "rgba(22,163,74,0.25)",
                  color: "#16a34a",
                  background: "rgba(22,163,74,0.10)",
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã liên kết tài khoản
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
                style={{
                  borderColor: "rgba(245,158,11,0.25)",
                  color: "#f59e0b",
                  background: "rgba(245,158,11,0.10)",
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Chưa liên kết tài khoản
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
              style={{
                borderColor: "rgba(37,99,235,0.25)",
                color: "#1d4ed8",
                background: "rgba(37,99,235,0.10)",
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Pilot Guard bật
            </span>
          </div>

          {linked ? (
            <div className="grid gap-2 text-xs md:grid-cols-2" style={{ color: "var(--text-secondary)" }}>
              <p>
                Chủ tài khoản:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {accountName || "--"}
                </span>
              </p>
              <p>
                Tiểu khoản:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {subAccountId || "--"}
                </span>
              </p>
              <p>
                Access token hết hạn:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {fmtDateTime(accessTokenExpiresAt)}
                </span>
              </p>
              <p>
                Đồng bộ gần nhất:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {fmtDateTime(lastSyncedAt)}
                </span>
              </p>
              {tokenExpired ? (
                <p className="md:col-span-2" style={{ color: "var(--danger)" }}>
                  Phiên DNSE đã hết hạn. Vui lòng đăng nhập DNSE lại để làm mới NAV, sức mua và danh mục.
                </p>
              ) : null}
              {lastError ? (
                <p className="md:col-span-2" style={{ color: "var(--danger)" }}>
                  Lỗi gần nhất: {lastError}
                </p>
              ) : null}
              {accounts.length > 0 ? (
                <div className="md:col-span-2">
                  <p
                    className="mb-1 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Danh sách tài khoản giao dịch
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {accounts.map((account) => (
                      <span
                        key={account.accountNo}
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          borderColor:
                            account.accountNo === accountId
                              ? "rgba(22,163,74,0.35)"
                              : "var(--border)",
                          color:
                            account.accountNo === accountId
                              ? "#15803d"
                              : "var(--text-secondary)",
                          background:
                            account.accountNo === accountId
                              ? "rgba(22,163,74,0.10)"
                              : "var(--surface-2)",
                        }}
                      >
                        {account.accountNo}
                        {account.accountType ? ` · ${account.accountType}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{
                    borderColor: "rgba(37,99,235,0.25)",
                    color: "#1d4ed8",
                    background: "rgba(37,99,235,0.10)",
                  }}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Đăng nhập DNSE
                </button>
                <button
                  onClick={onOpenLinkSelector}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{
                    borderColor: "rgba(22,163,74,0.25)",
                    color: "#15803d",
                    background: "rgba(22,163,74,0.10)",
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Liên kết tài khoản DNSE
                </button>
              </div>

              <div
                className="rounded-xl border p-3 text-sm"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--surface-2)",
                }}
              >
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Trạng thái kết nối DNSE
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  <li>Bấm “Đăng nhập DNSE” để lấy phiên đăng nhập hợp lệ.</li>
                  <li>Bấm “Liên kết tài khoản DNSE” để chọn đúng tài khoản giao dịch thật.</li>
                  <li>Sau khi liên kết xong, NAV, sức mua và danh mục sẽ tự đồng bộ.</li>
                </ol>
                {!hasApiKeyConfigured ? (
                  <p className="mt-2" style={{ color: "var(--danger)" }}>
                    DNSE API key chưa được cấu hình đầy đủ trên máy chủ.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {unlinkError ? (
            <div
              className="mt-3 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(192,57,43,0.25)",
                color: "var(--danger)",
                background: "rgba(192,57,43,0.08)",
              }}
            >
              {unlinkError}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
