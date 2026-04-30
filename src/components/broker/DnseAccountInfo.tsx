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
  hasActiveSession: boolean;
  needsRelogin: boolean;
  accountId?: string | null;
  accountName?: string | null;
  subAccountId?: string | null;
  sessionExpiresAt?: string | null;
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
  hasActiveSession,
  needsRelogin,
  accountId,
  accountName,
  subAccountId,
  sessionExpiresAt,
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {needsRelogin ? (
              <button
                onClick={onOpenLogin}
                className="rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  borderColor: "rgba(245,158,11,0.25)",
                  color: "#b45309",
                  background: "rgba(245,158,11,0.08)",
                }}
                title="Đăng nhập lại DNSE để làm mới phiên và tổng tài sản ròng"
              >
                Đăng nhập lại DNSE
              </button>
            ) : null}

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
          </div>
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
              Tài khoản: {accountId ?? "--"}
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
              <ShieldCheck className="h-3.5 w-3.5" /> Chế độ an toàn đang bật
            </span>
          </div>

          {linked ? (
            <div
              className="grid gap-2 text-xs md:grid-cols-2"
              style={{ color: "var(--text-secondary)" }}
            >
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
                Quyền truy cập hết hạn:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {fmtDateTime(accessTokenExpiresAt)}
                </span>
              </p>
              <p>
                Phiên đăng nhập DNSE:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {hasActiveSession ? fmtDateTime(sessionExpiresAt) : "Đã hết hạn"}
                </span>
              </p>
              <p>
                Đồng bộ gần nhất:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {fmtDateTime(lastSyncedAt)}
                </span>
              </p>
              <p>
                Trạng thái dữ liệu dự phòng:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {hasApiKeyConfigured ? "Đã cấu hình" : "Chưa cấu hình"}
                </span>
              </p>

              {tokenExpired || needsRelogin ? (
                <p className="md:col-span-2" style={{ color: "var(--danger)" }}>
                  Phiên DNSE đã hết hạn hoặc không còn hiệu lực trong trình duyệt. Vui lòng bấm
                  {" "}"Đăng nhập lại DNSE" để làm mới tổng tài sản ròng, sức mua và danh mục.
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
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Đăng nhập trên DNSE trước, sau đó quay lại để đồng bộ tài khoản.
                </span>
              </div>

              <div
                className="grid gap-2 rounded-xl border p-3 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-secondary)",
                }}
              >
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Trạng thái kết nối DNSE
                </p>
                <p>1. Hệ thống chỉ dùng tài khoản DNSE khách hàng đã liên kết.</p>
                <p>2. Khi tài khoản được xác minh, tổng tài sản ròng và danh mục sẽ tự động đồng bộ.</p>
                <p>3. Nếu chưa có dữ liệu mới nhất, vui lòng đăng nhập lại DNSE rồi làm mới trang.</p>
              </div>

              {!hasApiKeyConfigured ? (
                <div
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{
                    borderColor: "rgba(192,57,43,0.25)",
                    color: "var(--danger)",
                    background: "rgba(192,57,43,0.08)",
                  }}
                >
                  Chưa đủ cấu hình kết nối DNSE trên máy chủ.
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {submitSessionMessage(unlinkError)}
    </div>
  );
}

function submitSessionMessage(unlinkError: string | null) {
  if (!unlinkError) return null;

  return (
    <div
      className="mt-3 rounded-xl border px-3 py-2 text-xs"
      style={{
        borderColor: "rgba(192,57,43,0.25)",
        color: "var(--danger)",
        background: "rgba(192,57,43,0.10)",
      }}
    >
      {unlinkError}
    </div>
  );
}
