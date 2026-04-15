"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import {
  Trash2,
  CheckCircle2,
  Edit3,
  RefreshCw,
  ShieldAlert,
  Users,
  Search,
  X,
  Save,
  ShieldX,
  ShieldCheck,
  Clock,
  CreditCard,
  Crown,
  BookOpen,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  ADMIN CRM — Quản lý đăng ký + Quản lý Users/DNSE
 * ═══════════════════════════════════════════════════════════════════════════ */

interface Registration {
  id: string;
  name: string;
  zalo: string;
  status: string;
  vipStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  systemRole: string;
  vipUntil: string | null;
  dnseId: string | null;
  dnseVerified: boolean;
  dnseAppliedAt: string | null;
  chatCount: number;
  createdAt: string;
  receivedEntitlements?: Array<{
    id: string;
    badge: "FREE" | "VIP" | "PREMIUM";
    durationDays: number;
    grantedAt: string;
    expiresAt: string;
    status: string;
    grantedByAdmin: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  }>;
}

type Tab = "registrations" | "users" | "margin" | "journals";

interface MarginRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  tickers: string;
  marginRatio: string;
  loanAmount: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface CronStatusPayload {
  isStale: boolean;
  staleThresholdMinutes: number;
  scanner: {
    lastRun: { at: string; status: string; message: string | null } | null;
    lastSuccess: { at: string; message: string | null } | null;
    lastError: { at: string; message: string | null } | null;
    minutesSinceLastRun: number | null;
  };
  lastSignal: { ticker: string; type: string; createdAt: string } | null;
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </MainLayout>
    }>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { status } = useSession();
  const { isAdmin, isLoading: userLoading } = useCurrentDbUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "users";
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (!userLoading && status !== "loading" && !isAdmin) {
      router.replace("/");
    }
  }, [userLoading, status, isAdmin, router]);

  if (userLoading || status === "loading") {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div
            className="p-3 rounded-full border"
            style={{ background: "rgba(192,57,43,0.10)", borderColor: "rgba(192,57,43,0.20)" }}
          >
            <ShieldX className="w-8 h-8" style={{ color: "var(--danger)" }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Không có quyền truy cập</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Trang này chỉ dành cho Admin.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* ── Tab Navigation ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl border w-fit flex-wrap" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <button
            onClick={() => setTab("users")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={tab === "users"
              ? { background: "rgba(22,163,74,0.15)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.25)" }
              : { color: "var(--text-muted)" }
            }
          >
            <Users className="w-3.5 h-3.5" />
            Users & DNSE
          </button>
          <button
            onClick={() => setTab("registrations")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={tab === "registrations"
              ? { background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }
              : { color: "var(--text-muted)" }
            }
          >
            <CreditCard className="w-3.5 h-3.5" />
            Đăng Ký Khóa Học
          </button>
          <button
            onClick={() => setTab("margin")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={tab === "margin"
              ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }
              : { color: "var(--text-muted)" }
            }
          >
            <Crown className="w-3.5 h-3.5" />
            Tư Vấn Margin
          </button>
          <button
            onClick={() => setTab("journals")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={tab === "journals"
              ? { background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)" }
              : { color: "var(--text-muted)" }
            }
          >
            <BookOpen className="w-3.5 h-3.5" />
            Nhật Ký KH
          </button>
        </div>

        {tab === "users" && <UsersTab />}
        {tab === "registrations" && <RegistrationsTab />}
        {tab === "margin" && <MarginTab />}
        {tab === "journals" && <JournalsTab />}
      </div>
    </MainLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 1: USERS & DNSE MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════ */
function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified">("all");
  const [vipMenuUser, setVipMenuUser] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [customBadge, setCustomBadge] = useState<"VIP" | "PREMIUM">("VIP");
  const [cronStatus, setCronStatus] = useState<CronStatusPayload | null>(null);
  const [cronLoading, setCronLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    badge?: "FREE" | "VIP" | "PREMIUM";
    systemRole?: string;
    days?: number;
    label: string;
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      setError("Không thể tải danh sách users.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCronStatus = useCallback(async () => {
    setCronLoading(true);
    try {
      const res = await fetch("/api/admin/system/cron-status");
      if (!res.ok) throw new Error();
      setCronStatus(await res.json());
    } catch {
      setCronStatus(null);
    } finally {
      setCronLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchCronStatus();
  }, [fetchCronStatus]);

  /* ── Actions ────────────────────────────────────────────────── */
  const handleVerifyDNSE = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dnseVerified: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((u) => u.map((x) => (x.id === userId ? updated : x)));
    }
  };

  const handleRejectDNSE = async (userId: string) => {
    if (!confirm("Xác nhận từ chối và xóa ID DNSE này?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dnseId: null, dnseVerified: false }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((u) => u.map((x) => (x.id === userId ? updated : x)));
    }
  };

  const handleSetSystemRole = async (userId: string, systemRole: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemRole }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((u) => u.map((x) => (x.id === userId ? { ...x, ...updated } : x)));
    }
  };

  const handleSetEntitlement = async (userId: string, badge: "FREE" | "VIP" | "PREMIUM", durationDays?: number) => {
    const days = badge === "FREE" ? 0 : Math.max(1, Number(durationDays ?? 0));
    const res = await fetch(`/api/admin/users/${userId}/entitlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        badge,
        durationDays: days,
      }),
    });
    if (res.ok) {
      await fetchUsers();
    }
  };

  /* ── Filter ─────────────────────────────────────────────────── */
  const filtered = users.filter((u) => {
    const matchSearch =
      (u.email?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (u.name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (u.dnseId ?? "").includes(search);

    if (filter === "pending") return matchSearch && u.dnseId && !u.dnseVerified;
    if (filter === "verified") return matchSearch && u.dnseId && u.dnseVerified;
    return matchSearch;
  });

  const pendingCount = users.filter((u) => u.dnseId && !u.dnseVerified).length;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg border"
            style={{ background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.20)" }}
          >
            <Users className="w-5 h-5" style={{ color: "#16a34a" }} />
          </div>
          <div>
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Quản Lý Users & DNSE</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {users.length} users · {pendingCount > 0 && (
                <span style={{ color: "#f59e0b" }}>{pendingCount} chờ duyệt DNSE</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div
            className="flex items-center gap-1 rounded-lg border p-0.5"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            {(["all", "pending", "verified"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-md text-[12px] font-bold transition-all cursor-pointer"
                style={filter === f
                  ? f === "pending"
                    ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b" }
                    : f === "verified"
                    ? { background: "rgba(22,163,74,0.15)", color: "#16a34a" }
                    : { background: "var(--bg-hover)", color: "var(--text-primary)" }
                  : { color: "var(--text-muted)" }
                }
              >
                {f === "all" ? "Tất cả" : f === "pending" ? `Chờ duyệt (${pendingCount})` : "Đã xác minh"}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Tìm email / tên / DNSE ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none w-56"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <button
            onClick={() => {
              fetchUsers();
              fetchCronStatus();
            }}
            className="p-2 rounded-lg transition-colors cursor-pointer border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-[11px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--text-muted)" }}>
            Trạng thái Scanner
          </p>
          {cronLoading ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Đang tải...</p>
          ) : cronStatus ? (
            <p
              className="text-sm font-bold"
              style={{ color: cronStatus.isStale ? "var(--danger)" : "#16a34a" }}
            >
              {cronStatus.isStale ? "STALE" : "RUNNING"}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--danger)" }}>Không lấy được trạng thái</p>
          )}
        </div>

        <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-[11px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--text-muted)" }}>
            Lần quét gần nhất
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {cronStatus?.scanner.lastRun?.at
              ? new Date(cronStatus.scanner.lastRun.at).toLocaleString("vi-VN")
              : "—"}
          </p>
          {cronStatus?.scanner.minutesSinceLastRun != null && (
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              {cronStatus.scanner.minutesSinceLastRun} phút trước
            </p>
          )}
        </div>

        <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-[11px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--text-muted)" }}>
            Tín hiệu mới nhất
          </p>
          {cronStatus?.lastSignal ? (
            <>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {cronStatus.lastSignal.ticker} · {cronStatus.lastSignal.type}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {new Date(cronStatus.lastSignal.createdAt).toLocaleString("vi-VN")}
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu</p>
          )}
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-3 rounded-xl p-4 border"
          style={{ background: "rgba(192,57,43,0.08)", borderColor: "rgba(192,57,43,0.20)" }}
        >
          <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: "var(--danger)" }} />
          <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-[12px] uppercase tracking-wider" style={{ borderColor: "var(--border)" }}>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>#</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Email</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Tên</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Role</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Quyền</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Cấp quyền</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Thời gian</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Cấp bởi</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>DNSE ID</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>DNSE Status</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Ngày ĐK</th>
              <th className="px-4 py-3 font-bold text-right" style={{ color: "var(--text-muted)" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--text-muted)" }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Không có user nào.
                </td>
              </tr>
            ) : (
              filtered.map((user, i) => (
                <tr
                  key={user.id}
                  className="border-b transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    background: user.dnseId && !user.dnseVerified ? "rgba(245,158,11,0.03)" : undefined,
                  }}
                >
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{i + 1}</td>

                  <td className="px-4 py-3">
                    <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{user.email}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{user.name ?? "—"}</span>
                  </td>

                  <td className="px-4 py-3">
                    {(() => {
                      const latestGrant = user.receivedEntitlements?.[0];
                      const badge = latestGrant?.badge ?? (user.role === "VIP" ? "VIP" : "FREE");
                      if (badge === "FREE") return (
                        <span className="inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold" style={{ background: "rgba(100,116,139,0.10)", color: "var(--text-muted)", borderColor: "rgba(100,116,139,0.20)" }}>FREE</span>
                      );
                      return (
                        <span className="inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold" style={{
                          background: badge === "PREMIUM" ? "rgba(245,158,11,0.10)" : "rgba(168,85,247,0.10)",
                          color: badge === "PREMIUM" ? "#f59e0b" : "#a855f7",
                          borderColor: badge === "PREMIUM" ? "rgba(245,158,11,0.20)" : "rgba(168,85,247,0.20)",
                        }}>
                          {badge}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold" style={{
                      background: user.systemRole === "ADMIN" ? "rgba(22,163,74,0.10)" : "rgba(100,116,139,0.10)",
                      color: user.systemRole === "ADMIN" ? "#16a34a" : "var(--text-muted)",
                      borderColor: user.systemRole === "ADMIN" ? "rgba(22,163,74,0.20)" : "rgba(100,116,139,0.20)",
                    }}>
                      {user.systemRole === "ADMIN" ? "ADMIN" : "USER"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {user.receivedEntitlements?.[0]?.badge ?? "—"}
                  </td>

                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {user.receivedEntitlements?.[0]?.grantedAt
                      ? new Date(user.receivedEntitlements[0].grantedAt).toLocaleString("vi-VN")
                      : "—"}
                  </td>

                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {user.receivedEntitlements?.[0]?.grantedByAdmin
                      ? user.receivedEntitlements[0].grantedByAdmin.name || user.receivedEntitlements[0].grantedByAdmin.email
                      : "—"}
                  </td>

                  <td className="px-4 py-3">
                    {user.dnseId ? (
                      <span className="text-xs font-mono font-bold" style={{ color: "#06b6d4" }}>
                        {user.dnseId}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {!user.dnseId ? (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                    ) : user.dnseVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] font-bold" style={{ background: "rgba(22,163,74,0.10)", color: "#16a34a", borderColor: "rgba(22,163,74,0.20)" }}>
                        <ShieldCheck className="w-3 h-3" />
                        Xác minh
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] font-bold animate-pulse" style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.20)" }}>
                        <Clock className="w-3 h-3" />
                        Chờ duyệt
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Duyệt DNSE */}
                      {user.dnseId && !user.dnseVerified && (
                        <>
                          <button
                            onClick={() => handleVerifyDNSE(user.id)}
                            className="p-1.5 rounded-md transition-colors cursor-pointer"
                            style={{ background: "rgba(22,163,74,0.10)", color: "#16a34a" }}
                            title="Duyệt DNSE"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRejectDNSE(user.id)}
                            className="p-1.5 rounded-md transition-colors cursor-pointer"
                            style={{ background: "rgba(192,57,43,0.10)", color: "var(--danger)" }}
                            title="Từ chối DNSE"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Cấp VIP / Premium */}
                      <div className="relative">
                        <button
                          onClick={() => setVipMenuUser(vipMenuUser === user.id ? null : user.id)}
                          className="p-1.5 rounded-md transition-colors cursor-pointer"
                          style={(user.receivedEntitlements?.[0]?.badge === "VIP" || user.receivedEntitlements?.[0]?.badge === "PREMIUM" || user.role === "VIP")
                            ? { background: "rgba(168,85,247,0.10)", color: "#a855f7" }
                            : { color: "var(--text-muted)" }
                          }
                          title="Cấp VIP / Premium"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>

                        {vipMenuUser === user.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-56 border rounded-xl shadow-2xl p-2 space-y-1" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                            <p className="text-[12px] px-2 pt-1 pb-0.5 font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Chọn badge + thời hạn</p>
                            <div className="border-t pt-1.5 mt-1 px-1" style={{ borderColor: "var(--border)" }}>
                              <div className="flex gap-1 mb-1.5">
                                <button
                                  onClick={() => setCustomBadge("VIP")}
                                  className="flex-1 px-2 py-1 rounded-md text-xs font-bold border cursor-pointer"
                                  style={customBadge === "VIP"
                                    ? { background: "rgba(168,85,247,0.10)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" }
                                    : { color: "var(--text-muted)", borderColor: "var(--border)" }
                                  }
                                >
                                  VIP
                                </button>
                                <button
                                  onClick={() => setCustomBadge("PREMIUM")}
                                  className="flex-1 px-2 py-1 rounded-md text-xs font-bold border cursor-pointer"
                                  style={customBadge === "PREMIUM"
                                    ? { background: "rgba(245,158,11,0.10)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)" }
                                    : { color: "var(--text-muted)", borderColor: "var(--border)" }
                                  }
                                >
                                  PREMIUM
                                </button>
                              </div>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  value={customDays}
                                  onChange={(e) => setCustomDays(e.target.value)}
                                  placeholder="Số ngày..."
                                  min={1}
                                  max={3650}
                                  className="flex-1 px-2 py-1 rounded-md text-xs outline-none w-20"
                                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                />
                                <button
                                  onClick={() => {
                                    const d = parseInt(customDays);
                                    if (d > 0) {
                                      setConfirmAction({
                                        userId: user.id,
                                        email: user.email,
                                        badge: customBadge,
                                        days: d,
                                        label: `Cấp ${customBadge} trong ${d} ngày`,
                                      });
                                      setVipMenuUser(null);
                                      setCustomDays("");
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer"
                                  style={{ background: "rgba(22,163,74,0.15)", color: "#16a34a" }}
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                            {(user.receivedEntitlements?.[0]?.badge === "VIP" || user.receivedEntitlements?.[0]?.badge === "PREMIUM" || user.role === "VIP") && (
                              <>
                                <div className="border-t pt-1.5 mt-1" style={{ borderColor: "var(--border)" }}>
                                  <button
                                    onClick={() => {
                                      setConfirmAction({
                                        userId: user.id,
                                        email: user.email,
                                        badge: "FREE",
                                        label: "Hạ về FREE",
                                      });
                                      setVipMenuUser(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                    style={{ color: "var(--danger)" }}
                                  >
                                    <ShieldX className="w-3 h-3" />
                                    Hạ về FREE
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cấp ADMIN (systemRole) */}
                      <button
                        onClick={() =>
                          setConfirmAction(
                            user.systemRole === "ADMIN"
                              ? { userId: user.id, email: user.email, systemRole: "USER", label: "Thu hồi quyền ADMIN → USER" }
                              : { userId: user.id, email: user.email, systemRole: "ADMIN", label: "Cấp quyền ADMIN" }
                          )
                        }
                        className="p-1.5 rounded-md transition-colors cursor-pointer"
                        style={user.systemRole === "ADMIN"
                          ? { background: "rgba(22,163,74,0.10)", color: "#16a34a" }
                          : { color: "var(--text-muted)" }
                        }
                        title={user.systemRole === "ADMIN" ? "Thu hồi ADMIN" : "Cấp quyền ADMIN"}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Confirmation Modal ──────────────────────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.60)" }}>
          <div className="border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl border"
                style={{
                  background: confirmAction.badge === "FREE" || confirmAction.systemRole === "USER"
                    ? "rgba(192,57,43,0.10)" : confirmAction.systemRole === "ADMIN"
                    ? "rgba(22,163,74,0.10)" : "rgba(168,85,247,0.10)",
                  borderColor: confirmAction.badge === "FREE" || confirmAction.systemRole === "USER"
                    ? "rgba(192,57,43,0.20)" : confirmAction.systemRole === "ADMIN"
                    ? "rgba(22,163,74,0.20)" : "rgba(168,85,247,0.20)",
                }}
              >
                {confirmAction.badge === "FREE" || confirmAction.systemRole === "USER" ? (
                  <ShieldX className="w-5 h-5" style={{ color: "var(--danger)" }} />
                ) : confirmAction.systemRole === "ADMIN" ? (
                  <ShieldCheck className="w-5 h-5" style={{ color: "#16a34a" }} />
                ) : (
                  <Crown className="w-5 h-5" style={{ color: "#a855f7" }} />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Xác nhận thay đổi</h3>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Hành động không thể hoàn tác tự động</p>
              </div>
            </div>
            <div className="rounded-xl p-3 space-y-1.5 text-xs" style={{ background: "var(--surface-2)" }}>
              <p style={{ color: "var(--text-muted)" }}>
                User: <span className="font-mono" style={{ color: "var(--text-primary)" }}>{confirmAction.email}</span>
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                Thao tác:{" "}
                <span className="font-bold" style={{
                  color: confirmAction.badge === "FREE" || confirmAction.systemRole === "USER" ? "var(--danger)" : confirmAction.systemRole === "ADMIN" ? "#16a34a" : "#a855f7"
                }}>
                  {confirmAction.label}
                </span>
              </p>
              {confirmAction.days && (
                <p style={{ color: "var(--text-muted)" }}>
                  Hiệu lực đến:{" "}
                  <span className="font-semibold" style={{ color: "#16a34a" }}>
                    {new Date(Date.now() + confirmAction.days * 86400000).toLocaleDateString("vi-VN")}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (confirmAction.systemRole) {
                    handleSetSystemRole(confirmAction.userId, confirmAction.systemRole);
                  } else {
                    handleSetEntitlement(
                      confirmAction.userId,
                      confirmAction.badge ?? "FREE",
                      confirmAction.days
                    );
                  }
                  setConfirmAction(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: confirmAction.badge === "FREE" || confirmAction.systemRole === "USER"
                    ? "var(--danger)" : confirmAction.systemRole === "ADMIN"
                    ? "#16a34a" : "#a855f7",
                  color: "#fff",
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 2: REGISTRATIONS (Khóa học) — giữ nguyên logic cũ
 * ═══════════════════════════════════════════════════════════════════════════ */
function RegistrationsTab() {
  const { isAdmin } = useCurrentDbUser();
  const { status } = useSession();
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Registration>>({});

  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/registrations");
      if (res.status === 403) {
        setError("Bạn không có quyền truy cập.");
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error();
      setRows(await res.json());
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) fetchData();
    else if (status === "unauthenticated") setLoading(false);
  }, [status, isAdmin, fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xóa đăng ký này?")) return;
    const res = await fetch(`/api/admin/registrations/${id}`, { method: "DELETE" });
    if (res.ok) setRows((r) => r.filter((x) => x.id !== id));
  };

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/admin/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DA_MO_TK", vipStatus: "ACTIVE" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((r) => r.map((x) => (x.id === id ? updated : x)));
    }
  };

  const startEdit = (row: Registration) => {
    setEditId(row.id);
    setEditData({ name: row.name, zalo: row.zalo, status: row.status, vipStatus: row.vipStatus });
  };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    if (!editId) return;
    const res = await fetch(`/api/admin/registrations/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((r) => r.map((x) => (x.id === editId ? updated : x)));
      cancelEdit();
    }
  };

  const filtered = rows.filter(
    (r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.zalo.includes(search)
  );

  const statusBadge = (s: string) => {
    if (s === "DA_MO_TK") return { background: "rgba(22,163,74,0.10)", color: "#16a34a", borderColor: "rgba(22,163,74,0.20)" };
    return { background: "rgba(245,158,11,0.10)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.20)" };
  };
  const vipBadge = (v: string) => {
    if (v === "ACTIVE") return { background: "rgba(168,85,247,0.10)", color: "#a855f7", borderColor: "rgba(168,85,247,0.20)" };
    if (v === "EXPIRED") return { background: "rgba(192,57,43,0.10)", color: "var(--danger)", borderColor: "rgba(192,57,43,0.20)" };
    return { background: "rgba(100,116,139,0.10)", color: "var(--text-muted)", borderColor: "rgba(100,116,139,0.20)" };
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg border"
            style={{ background: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.20)" }}
          >
            <CreditCard className="w-5 h-5" style={{ color: "#a855f7" }} />
          </div>
          <div>
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Quản Lý Đăng Ký Khóa Học</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{rows.length} bản ghi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Tìm tên / Zalo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none w-48"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg border transition-colors cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-3 rounded-xl p-4 border"
          style={{ background: "rgba(192,57,43,0.08)", borderColor: "rgba(192,57,43,0.20)" }}
        >
          <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: "var(--danger)" }} />
          <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-[12px] uppercase tracking-wider" style={{ borderColor: "var(--border)" }}>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>#</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Tên</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Zalo</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Trạng Thái</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>VIP</th>
              <th className="px-4 py-3 font-bold" style={{ color: "var(--text-muted)" }}>Ngày ĐK</th>
              <th className="px-4 py-3 font-bold text-right" style={{ color: "var(--text-muted)" }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--text-muted)" }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Không có bản ghi nào.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id} className="border-b transition-colors" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input value={editData.name ?? ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="px-2 py-1 rounded text-xs w-32" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    ) : (
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input value={editData.zalo ?? ""} onChange={(e) => setEditData({ ...editData, zalo: e.target.value })} className="px-2 py-1 rounded text-xs w-28" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    ) : (
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{row.zalo}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <select value={editData.status ?? ""} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="px-2 py-1 rounded text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        <option value="CHUA_MO_TK">Chưa mở TK</option>
                        <option value="DA_MO_TK">Đã mở TK</option>
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold" style={statusBadge(row.status)}>
                        {row.status === "DA_MO_TK" ? "Đã mở TK" : "Chưa mở TK"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <select value={editData.vipStatus ?? ""} onChange={(e) => setEditData({ ...editData, vipStatus: e.target.value })} className="px-2 py-1 rounded text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        <option value="NONE">NONE</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold" style={vipBadge(row.vipStatus)}>{row.vipStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(row.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === row.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 rounded-md transition-colors cursor-pointer" style={{ background: "rgba(22,163,74,0.10)", color: "#16a34a" }} title="Lưu"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelEdit} className="p-1.5 rounded-md transition-colors cursor-pointer" style={{ background: "rgba(100,116,139,0.10)", color: "var(--text-muted)" }} title="Hủy"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)} className="p-1.5 rounded-md transition-colors cursor-pointer" style={{ color: "var(--text-muted)" }} title="Sửa"><Edit3 className="w-3.5 h-3.5" /></button>
                          {row.status !== "DA_MO_TK" && (
                            <button onClick={() => handleApprove(row.id)} className="p-1.5 rounded-md transition-colors cursor-pointer" style={{ color: "var(--text-muted)" }} title="Duyệt"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-md transition-colors cursor-pointer" style={{ color: "var(--text-muted)" }} title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 3: TƯ VẤN MARGIN
 * ═══════════════════════════════════════════════════════════════════════════ */
function MarginTab() {
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<Record<string, string>>({});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/margin");
      if (!res.ok) throw new Error();
      setRows(await res.json());
    } catch {
      setError("Không thể tải danh sách tư vấn margin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const updateRow = async (id: string, patch: { status?: string; note?: string }) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/margin?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } finally {
      setSaving(null);
    }
  };

  const statusColor = (s: string) =>
    s === "NEW" ? { color: "#f59e0b", background: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.20)" }
    : s === "CONTACTED" ? { color: "#3b82f6", background: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.20)" }
    : { color: "#16a34a", background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.20)" };

  const statusLabel = (s: string) =>
    s === "NEW" ? "Mới" : s === "CONTACTED" ? "Đã liên hệ" : "Hoàn thành";

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
    </div>
  );
  if (error) return <p className="text-sm py-8 text-center" style={{ color: "var(--danger)" }}>{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Tư Vấn Margin</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{rows.length} yêu cầu</p>
        </div>
        <button
          onClick={fetchRows}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <RefreshCw className="w-3 h-3" /> Làm mới
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Chưa có yêu cầu nào.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="border rounded-2xl p-4 sm:p-5 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{row.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{row.phone}</span>
                    {row.email && <span>{row.email}</span>}
                    {row.company && <span>· {row.company}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[12px] font-bold px-2 py-0.5 rounded-full border"
                    style={statusColor(row.status)}
                  >
                    {statusLabel(row.status)}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {new Date(row.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="mb-0.5" style={{ color: "var(--text-muted)" }}>Mã CK</p>
                  <p className="font-mono font-medium" style={{ color: "var(--text-secondary)" }}>{row.tickers}</p>
                </div>
                <div>
                  <p className="mb-0.5" style={{ color: "var(--text-muted)" }}>Tỉ lệ ký quỹ</p>
                  <p style={{ color: "var(--text-secondary)" }}>{row.marginRatio}</p>
                </div>
                <div>
                  <p className="mb-0.5" style={{ color: "var(--text-muted)" }}>Hạn mức vay</p>
                  <p style={{ color: "var(--text-secondary)" }}>{row.loanAmount}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                {/* Status selector */}
                <select
                  value={row.status}
                  onChange={(e) => updateRow(row.id, { status: e.target.value })}
                  disabled={saving === row.id}
                  className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none cursor-pointer disabled:opacity-50"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="NEW">Mới</option>
                  <option value="CONTACTED">Đã liên hệ</option>
                  <option value="DONE">Hoàn thành</option>
                </select>

                {/* Note */}
                <input
                  type="text"
                  placeholder="Ghi chú..."
                  value={editNote[row.id] ?? row.note ?? ""}
                  onChange={(e) => setEditNote((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={() => {
                    const note = editNote[row.id] ?? row.note ?? "";
                    updateRow(row.id, { note });
                  }}
                  disabled={saving === row.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.20)", color: "#16a34a" }}
                >
                  {saving === row.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Lưu
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 4: NHẬT KÝ GIAO DỊCH KHÁCH HÀNG
 * ═══════════════════════════════════════════════════════════════════════════ */

interface JournalEntry {
  id: string;
  ticker: string;
  action: "BUY" | "SELL";
  price: number;
  quantity: number;
  psychology: string | null;
  psychologyTag: string | null;
  tradeReason: string | null;
  tradeDate: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

function JournalsTab() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterUser, setFilterUser] = useState("");
  const [filterTicker, setFilterTicker] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (filterUser) params.set("userId", filterUser);
      if (filterTicker) params.set("ticker", filterTicker);
      const res = await fetch(`/api/admin/journals?${params}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      if (data.users) setUsers(data.users);
    } catch {
      console.error("Failed to fetch journals");
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterTicker]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  const totalPages = Math.ceil(total / 30);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const fmtPrice = (p: number) =>
    new Intl.NumberFormat("vi-VN").format(p);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Nhật ký giao dịch khách hàng
        </h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {total} bản ghi
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border text-xs outline-none"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <option value="">Tất cả khách hàng</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Lọc mã CK..."
            value={filterTicker}
            onChange={(e) => { setFilterTicker(e.target.value.toUpperCase()); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border text-xs w-32 outline-none"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>
        <button
          onClick={fetchJournals}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer"
          style={{ background: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.20)", color: "#3b82f6" }}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>
          Không có nhật ký nào.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Ngày</th>
                <th className="text-left py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Khách hàng</th>
                <th className="text-left py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Mã CK</th>
                <th className="text-center py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Lệnh</th>
                <th className="text-right py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Giá</th>
                <th className="text-right py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>KL</th>
                <th className="text-right py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Giá trị</th>
                <th className="text-left py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Tâm lý</th>
                <th className="text-left py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b transition-colors" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2 px-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(e.tradeDate || e.createdAt)}</td>
                  <td className="py-2 px-3">
                    <div>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{e.user.name || "—"}</span>
                      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{e.user.email}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 font-bold" style={{ color: "var(--text-primary)" }}>{e.ticker}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold" style={{
                      background: e.action === "BUY" ? "rgba(22,163,74,0.15)" : "rgba(192,57,43,0.15)",
                      color: e.action === "BUY" ? "#16a34a" : "var(--danger)",
                    }}>
                      {e.action === "BUY" ? "MUA" : "BÁN"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--text-secondary)" }}>{fmtPrice(e.price)}</td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--text-secondary)" }}>{fmtPrice(e.quantity)}</td>
                  <td className="py-2 px-3 text-right font-medium" style={{ color: "var(--text-primary)" }}>
                    {fmtPrice(e.price * e.quantity)}
                  </td>
                  <td className="py-2 px-3">
                    {e.psychologyTag && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px]" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                        {e.psychologyTag}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 max-w-[200px] truncate" style={{ color: "var(--text-muted)" }}>
                    {e.tradeReason || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-30 transition-colors"
            style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
          >
            ← Trước
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-30 transition-colors"
            style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
}
