"use client";

import { useMemo, useState } from "react";
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
  accounts: BrokerAccount[];
  defaultAccountNo?: string | null;
  onCancel: () => void;
  onSuccess: (accountNo: string) => void;
};

function normalizeAccountNo(value: string) {
  return value.trim().toUpperCase();
}

export function DnseAccountSelector({
  open,
  accounts,
  defaultAccountNo,
  onCancel,
  onSuccess,
}: DnseAccountSelectorProps) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualAccountNo, setManualAccountNo] = useState("");
  const [selectedAccountNo, setSelectedAccountNo] = useState<string | null>(
    defaultAccountNo?.trim() || null,
  );

  const sortedAccounts = useMemo(() => {
    const unique = new Map<string, BrokerAccount>();
    accounts.forEach((item) => {
      const key = normalizeAccountNo(item.accountNo);
      if (!key) return;
      if (!unique.has(key)) {
        unique.set(key, { ...item, accountNo: key });
      }
    });
    return Array.from(unique.values());
  }, [accounts]);

  if (!open) return null;

  async function linkAccount(accountNoRaw: string) {
    const accountNo = normalizeAccountNo(accountNoRaw);
    if (accountNo.length < 3) {
      setError("Vui lòng nhập/chọn tài khoản DNSE hợp lệ.");
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
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Liên kết tài khoản DNSE thất bại.");
      }
      onSuccess(accountNo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Liên kết tài khoản DNSE thất bại.");
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
              Sau khi liên kết, hệ thống sẽ dùng tài khoản này để đồng bộ NAV/holdings và tạo phiếu lệnh.
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
          {sortedAccounts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Tài khoản có sẵn
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {sortedAccounts.map((account) => (
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
              Không đọc được danh sách tài khoản tự động. Bạn vẫn có thể nhập số tài khoản DNSE để liên kết thủ công.
            </div>
          )}

          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Liên kết thủ công
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={manualAccountNo}
                onChange={(event) => setManualAccountNo(event.target.value.toUpperCase())}
                placeholder="Ví dụ: 0001386718"
                className="min-w-[220px] flex-1 rounded-xl border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={() => void linkAccount(manualAccountNo)}
                disabled={linking}
                className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                {linking ? "Đang liên kết..." : "Liên kết thủ công"}
              </button>
            </div>
          </div>

          {error ? (
            <div
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(192,57,43,0.25)",
                color: "var(--danger)",
                background: "rgba(192,57,43,0.08)",
              }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

