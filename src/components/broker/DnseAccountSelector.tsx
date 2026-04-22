"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type BrokerAccount = {
  accountNo: string;
  accountName: string | null;
  custodyCode: string | null;
  accountType: string;
  status: string;
};

type DnseAccountSelectorProps = {
  open: boolean;
  defaultAccountNo?: string | null;
  onCancel: () => void;
  onSuccess: (accountNo: string) => void;
};

type ApiErrorPayload = {
  code?: string;
  error?: string;
};

function normalizeAccountNo(value: string) {
  return value.trim().toUpperCase();
}

function normalizeApiError(message: string) {
  if (/authorization field missing|oa-400|unauthorized|forbidden|token|jwt/i.test(message)) {
    return "Phiên đăng nhập DNSE không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập DNSE lại rồi thử liên kết.";
  }
  if (/no route matched|endpoint|http_404|not found/i.test(message)) {
    return "Endpoint DNSE chưa đúng cấu hình. Vui lòng liên hệ admin kiểm tra lại.";
  }
  return message;
}

function toUiError(payload: ApiErrorPayload | null, fallback: string) {
  const code = payload?.code?.trim();
  const message = payload?.error?.trim();
  if (message) return normalizeApiError(message);
  if (!code) return fallback;
  return `${fallback} (mã lỗi: ${code})`;
}

export function DnseAccountSelector({
  open,
  defaultAccountNo,
  onCancel,
  onSuccess,
}: DnseAccountSelectorProps) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAccounts, setServerAccounts] = useState<BrokerAccount[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingServerAccounts, setLoadingServerAccounts] = useState(false);
  const [selectedAccountNo, setSelectedAccountNo] = useState<string | null>(
    defaultAccountNo?.trim() || null,
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadAccountsFromServer() {
      setLoadingServerAccounts(true);
      setServerError(null);
      try {
        const response = await fetch("/api/user/dnse/link/accounts", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { code?: string; accounts?: BrokerAccount[]; error?: string }
          | null;

        if (!response.ok) {
          if (payload?.code === "dnse_login_required") {
            throw new Error("Bạn cần đăng nhập DNSE trước khi chọn tài khoản.");
          }
          if (payload?.code === "dnse_endpoint_mismatch") {
            throw new Error(
              "Không đọc được danh sách tài khoản từ DNSE do endpoint chưa đúng. Vui lòng liên hệ admin kiểm tra lại.",
            );
          }
          throw new Error(toUiError(payload, "Không thể tải danh sách tài khoản DNSE."));
        }

        const rows = Array.isArray(payload?.accounts) ? payload.accounts : [];
        if (!cancelled) {
          setServerAccounts(rows);
          if (!selectedAccountNo && rows.length > 0) {
            setSelectedAccountNo(rows[0].accountNo);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setServerAccounts([]);
          setServerError(
            err instanceof Error
              ? normalizeApiError(err.message)
              : "Không thể tải danh sách tài khoản DNSE.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingServerAccounts(false);
        }
      }
    }

    void loadAccountsFromServer();
    return () => {
      cancelled = true;
    };
  }, [open, selectedAccountNo]);

  if (!open) return null;

  async function linkAccount(accountNoRaw: string) {
    const accountNo = normalizeAccountNo(accountNoRaw);
    if (accountNo.length < 3) {
      setError("Vui lòng chọn tài khoản DNSE hợp lệ.");
      return;
    }

    setLinking(true);
    setError(null);
    try {
      const response = await fetch("/api/user/dnse/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNo }),
      });
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
      if (!response.ok) {
        throw new Error(toUiError(payload, "Liên kết tài khoản DNSE thất bại."));
      }
      onSuccess(accountNo);
    } catch (err) {
      setError(
        err instanceof Error
          ? normalizeApiError(err.message)
          : "Liên kết tài khoản DNSE thất bại.",
      );
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3">
      <div
        className="w-full max-w-2xl rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
              Chọn tài khoản DNSE để liên kết
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Chỉ liên kết tài khoản đã xác thực từ máy chủ. Không cho nhập tay để tránh giả mạo.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg border p-2"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {loadingServerAccounts ? (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
                background: "var(--surface-2)",
              }}
            >
              Đang tải danh sách tài khoản DNSE từ máy chủ...
            </div>
          ) : null}

          {serverError ? (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(245,158,11,0.25)",
                color: "#92400e",
                background: "rgba(245,158,11,0.10)",
              }}
            >
              {serverError}
            </div>
          ) : null}

          {serverAccounts.length > 0 ? (
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Tài khoản khả dụng
              </p>

              <div className="grid gap-2 md:grid-cols-2">
                {serverAccounts.map((account) => (
                  <button
                    key={account.accountNo}
                    onClick={() => setSelectedAccountNo(account.accountNo)}
                    className="rounded-xl border p-3 text-left"
                    style={{
                      borderColor:
                        selectedAccountNo === account.accountNo
                          ? "rgba(22,163,74,0.35)"
                          : "var(--border)",
                      background:
                        selectedAccountNo === account.accountNo
                          ? "rgba(22,163,74,0.10)"
                          : "var(--surface-2)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                        {account.accountNo}
                      </span>
                      {selectedAccountNo === account.accountNo ? (
                        <CheckCircle2 className="h-4 w-4" style={{ color: "#16a34a" }} />
                      ) : null}
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {account.accountName || "Tài khoản DNSE"}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {account.accountType || "SPOT"}
                      {account.custodyCode ? ` · ${account.custodyCode}` : ""}
                    </p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => void linkAccount(selectedAccountNo ?? "")}
                disabled={!selectedAccountNo || linking}
                className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                {linking ? "Đang liên kết..." : "Liên kết tài khoản đã chọn"}
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(245,158,11,0.25)",
                color: "#92400e",
                background: "rgba(245,158,11,0.10)",
              }}
            >
              Không đọc được danh sách tài khoản DNSE đã xác thực. Vui lòng đăng nhập DNSE và thử
              lại.
            </div>
          )}

          {error ? (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(192,57,43,0.25)",
                color: "var(--danger)",
                background: "rgba(192,57,43,0.08)",
              }}
            >
              <div className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
