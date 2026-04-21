"use client";

import { useState } from "react";
import { LogIn, X } from "lucide-react";

type DnseLoginModalProps = {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
};

export function DnseLoginModal({ open, onCancel, onSuccess }: DnseLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu DNSE.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/user/dnse/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Đăng nhập DNSE thất bại.");
      }
      setPassword("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập DNSE thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3">
      <div
        className="w-full max-w-lg rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
              Đăng nhập DNSE
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Đăng nhập tài khoản DNSE để lấy danh sách tài khoản thật và liên kết an toàn.
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

        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Tên đăng nhập DNSE
            </label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ví dụ: 064C0Z8EU7"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Mật khẩu DNSE
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu DNSE"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {error ? (
            <div
              className="rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(192,57,43,0.25)",
                color: "var(--danger)",
                background: "rgba(192,57,43,0.08)",
              }}
            >
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                background: "var(--surface)",
              }}
            >
              Hủy
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              <LogIn className="h-4 w-4" />
              {submitting ? "Đang đăng nhập..." : "Đăng nhập DNSE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
