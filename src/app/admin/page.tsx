"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useTheme } from "@/components/providers/ThemeProvider";
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

const VIP_PRESETS = [
  { label: "7 ngày", days: 7, tier: "VIP" },
  { label: "2 tuần", days: 14, tier: "VIP" },
  { label: "1 tháng", days: 30, tier: "VIP" },
  { label: "3 tháng", days: 90, tier: "VIP" },
  { label: "6 tháng", days: 180, tier: "PREMIUM" },
  { label: "12 tháng", days: 365, tier: "PREMIUM" },
] as const;

export default function AdminPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-6 h-6 animate-spin text-neutral-600" />
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!userLoading && status !== "loading" && !isAdmin) {
      router.replace("/");
    }
  }, [userLoading, status, isAdmin, router]);

  if (userLoading || status === "loading") {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className={`w-6 h-6 animate-spin ${isDark ? "text-neutral-600" : "text-slate-400"}`} />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20">
            <ShieldX className="w-8 h-8 text-red-400" />
          </div>
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Không có quyền truy cập</h2>
          <p className={`text-sm ${isDark ? "text-white/40" : "text-slate-500"}`}>Trang này chỉ dành cho Admin.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* ── Tab Navigation ──────────────────────────────────────── */}
        <div className={`flex items-center gap-1 p-1 rounded-xl border w-fit flex-wrap backdrop-blur-xl ${
          isDark ? "bg-white/[0.04] border-white/[0.1]" : "bg-white/60 border-white/50"
        }`}>
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "users"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : isDark ? "text-neutral-500 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users & DNSE
          </button>
          <button
            onClick={() => setTab("registrations")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "registrations"
                ? "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                : isDark ? "text-neutral-500 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Đăng Ký Khóa Học
          </button>
          <button
            onClick={() => setTab("margin")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "margin"
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                : isDark ? "text-neutral-500 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Tư Vấn Margin
          </button>
          <button
            onClick={() => setTab("journals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "journals"
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                : isDark ? "text-neutral-500 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
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
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    role?: string;
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const handleSetRole = async (userId: string, role?: string, vipDays?: number, systemRole?: string) => {
    const data: Record<string, unknown> = {};
    if (systemRole !== undefined) {
      data.systemRole = systemRole;
    }
    if (role !== undefined) {
      data.role = role;
      if (role === "VIP" && vipDays) {
        data.vipUntil = new Date(Date.now() + vipDays * 86400000).toISOString();
      }
      if (role === "FREE") {
        data.vipUntil = null;
      }
    }
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((u) => u.map((x) => (x.id === userId ? updated : x)));
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
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black dark:text-white text-slate-900">Quản Lý Users & DNSE</h1>
            <p className="text-xs dark:text-neutral-500 text-slate-500">
              {users.length} users · {pendingCount > 0 && (
                <span className="text-amber-400">{pendingCount} chờ duyệt DNSE</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex items-center gap-1 dark:bg-white/[0.04] bg-white/60 rounded-lg dark:border-white/[0.1] border-white/50 border p-0.5">
            {(["all", "pending", "verified"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-[12px] font-bold transition-all cursor-pointer ${
                  filter === f
                    ? f === "pending"
                      ? "bg-amber-500/15 text-amber-400"
                      : f === "verified"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "dark:bg-white/[0.08] bg-slate-100 dark:text-white text-slate-900"
                    : "dark:text-neutral-500 text-slate-500 dark:hover:text-white hover:text-slate-900"
                }`}
              >
                {f === "all" ? "Tất cả" : f === "pending" ? `Chờ duyệt (${pendingCount})` : "Đã xác minh"}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Tìm email / tên / DNSE ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900 dark:placeholder-neutral-500 placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 w-56"
            />
          </div>
          <button
            onClick={fetchUsers}
            className="p-2 rounded-lg dark:border-white/[0.1] border-slate-200 dark:hover:border-white/20 hover:border-slate-300 dark:text-neutral-400 text-slate-500 dark:hover:text-white hover:text-slate-900 transition-colors cursor-pointer border"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl dark:border-white/[0.08] border-white/50 dark:bg-white/[0.03] bg-white/60 backdrop-blur-xl border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b dark:border-white/[0.06] border-slate-200 text-[12px] uppercase tracking-wider dark:text-neutral-500 text-slate-500">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">Email</th>
              <th className="px-4 py-3 font-bold">Tên</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Quyền</th>
              <th className="px-4 py-3 font-bold">VIP đến</th>
              <th className="px-4 py-3 font-bold">DNSE ID</th>
              <th className="px-4 py-3 font-bold">DNSE Status</th>
              <th className="px-4 py-3 font-bold">Ngày ĐK</th>
              <th className="px-4 py-3 font-bold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <RefreshCw className="w-5 h-5 text-neutral-600 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-xs text-neutral-600">
                  Không có user nào.
                </td>
              </tr>
            ) : (
              filtered.map((user, i) => (
                <tr
                  key={user.id}
                  className={`border-b dark:border-white/[0.04] border-slate-100 dark:hover:bg-white/[0.03] hover:bg-slate-50/50 transition-colors ${
                    user.dnseId && !user.dnseVerified ? "bg-amber-500/[0.03]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{i + 1}</td>

                  <td className="px-4 py-3">
                    <span className="text-xs dark:text-white text-slate-900 font-mono">{user.email}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs dark:text-neutral-300 text-slate-600">{user.name ?? "—"}</span>
                  </td>

                  <td className="px-4 py-3">
                    {(() => {
                      if (user.role !== "VIP") return (
                        <span className="inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold bg-neutral-500/10 text-neutral-400 border-neutral-500/20">FREE</span>
                      );
                      const daysLeft = user.vipUntil ? Math.ceil((new Date(user.vipUntil).getTime() - Date.now()) / 86400000) : 0;
                      const isPremium = daysLeft > 90;
                      return (
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold ${
                          isPremium
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}>
                          {isPremium ? "PREMIUM" : "VIP"}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold ${
                      user.systemRole === "ADMIN"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-neutral-500/10 text-neutral-500 border-neutral-500/20"
                    }`}>
                      {user.systemRole === "ADMIN" ? "ADMIN" : "USER"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {user.vipUntil ? (
                      <div className="flex items-center gap-1.5">
                        <span>{new Date(user.vipUntil).toLocaleDateString("vi-VN")}</span>
                        {(() => {
                          const daysLeft = Math.ceil((new Date(user.vipUntil).getTime() - Date.now()) / 86400000);
                          const tier = daysLeft > 90 ? "PREMIUM" : "VIP";
                          return (
                            <span className={`text-[11px] font-bold px-1 py-0.5 rounded border ${
                              tier === "PREMIUM"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                            }`}>
                              {tier}
                            </span>
                          );
                        })()}
                      </div>
                    ) : "—"}
                  </td>

                  <td className="px-4 py-3">
                    {user.dnseId ? (
                      <span className="text-xs text-cyan-400 font-mono font-bold">
                        {user.dnseId}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-600">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {!user.dnseId ? (
                      <span className="text-xs text-neutral-600">—</span>
                    ) : user.dnseVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Xác minh
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse">
                        <Clock className="w-3 h-3" />
                        Chờ duyệt
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs dark:text-neutral-500 text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Duyệt DNSE */}
                      {user.dnseId && !user.dnseVerified && (
                        <>
                          <button
                            onClick={() => handleVerifyDNSE(user.id)}
                            className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                            title="Duyệt DNSE"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRejectDNSE(user.id)}
                            className="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
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
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            user.role === "VIP"
                              ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                              : "hover:bg-purple-500/10 text-neutral-500 hover:text-purple-400"
                          }`}
                          title="Cấp VIP / Premium"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>

                        {vipMenuUser === user.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-56 dark:bg-[#0a0a0a]/95 bg-white/95 backdrop-blur-3xl border dark:border-white/[0.12] border-slate-200 rounded-xl shadow-2xl p-2 space-y-1">
                            <p className="text-[12px] dark:text-neutral-500 text-slate-400 px-2 pt-1 pb-0.5 font-bold uppercase tracking-wider">Chọn gói thời gian</p>
                            {VIP_PRESETS.map((preset) => (
                              <button
                                key={preset.days}
                                onClick={() => {
                                  setConfirmAction({
                                    userId: user.id,
                                    email: user.email,
                                    role: "VIP",
                                    days: preset.days,
                                    label: `Cấp ${preset.tier} ${preset.label}`,
                                  });
                                  setVipMenuUser(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs dark:hover:bg-white/[0.06] hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <span className="dark:text-neutral-200 text-slate-700">{preset.label}</span>
                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                                  preset.tier === "PREMIUM"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                    : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                                }`}>
                                  {preset.tier}
                                </span>
                              </button>
                            ))}
                            <div className="border-t dark:border-white/[0.06] border-slate-200 pt-1.5 mt-1 px-1">
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  value={customDays}
                                  onChange={(e) => setCustomDays(e.target.value)}
                                  placeholder="Số ngày..."
                                  min={1}
                                  max={3650}
                                  className="flex-1 px-2 py-1 rounded-md dark:bg-white/[0.06] bg-slate-50 border dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900 dark:placeholder-neutral-500 placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 w-20"
                                />
                                <button
                                  onClick={() => {
                                    const d = parseInt(customDays);
                                    if (d > 0) {
                                      setConfirmAction({
                                        userId: user.id,
                                        email: user.email,
                                        role: "VIP",
                                        days: d,
                                        label: `Cấp VIP ${d} ngày (tùy chọn)`,
                                      });
                                      setVipMenuUser(null);
                                      setCustomDays("");
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                            {user.role === "VIP" && (
                              <>
                                <div className="border-t dark:border-white/[0.06] border-slate-200 pt-1.5 mt-1">
                                  <button
                                    onClick={() => {
                                      setConfirmAction({
                                        userId: user.id,
                                        email: user.email,
                                        role: "FREE",
                                        label: "Hạ về FREE",
                                      });
                                      setVipMenuUser(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
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
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          user.systemRole === "ADMIN"
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "hover:bg-emerald-500/10 text-neutral-500 hover:text-emerald-400"
                        }`}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dark:bg-[#0a0a0a]/90 bg-white/90 backdrop-blur-3xl dark:border-white/[0.1] border-white/50 border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                confirmAction.role === "FREE" || confirmAction.systemRole === "USER"
                  ? "bg-red-500/10 border border-red-500/20"
                  : confirmAction.systemRole === "ADMIN"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-purple-500/10 border border-purple-500/20"
              }`}>
                {confirmAction.role === "FREE" || confirmAction.systemRole === "USER" ? (
                  <ShieldX className="w-5 h-5 text-red-400" />
                ) : confirmAction.systemRole === "ADMIN" ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Crown className="w-5 h-5 text-purple-400" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold dark:text-white text-slate-900">Xác nhận thay đổi</h3>
                <p className="text-[12px] dark:text-neutral-500 text-slate-400">Hành động không thể hoàn tác tự động</p>
              </div>
            </div>
            <div className="dark:bg-white/[0.04] bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
              <p className="dark:text-neutral-400 text-slate-500">
                User: <span className="dark:text-white text-slate-900 font-mono">{confirmAction.email}</span>
              </p>
              <p className="text-neutral-400">
                Thao tác:{" "}
                <span className={`font-bold ${
                  confirmAction.role === "FREE" || confirmAction.systemRole === "USER" ? "text-red-400" : confirmAction.systemRole === "ADMIN" ? "text-emerald-400" : "text-purple-400"
                }`}>
                  {confirmAction.label}
                </span>
              </p>
              {confirmAction.days && (
                <p className="text-neutral-400">
                  VIP đến:{" "}
                  <span className="text-emerald-400 font-semibold">
                    {new Date(Date.now() + confirmAction.days * 86400000).toLocaleDateString("vi-VN")}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border dark:border-white/[0.1] border-slate-200 text-xs font-bold dark:text-neutral-400 text-slate-500 dark:hover:text-white hover:text-slate-900 dark:hover:border-white/20 hover:border-slate-300 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  handleSetRole(confirmAction.userId, confirmAction.role, confirmAction.days, confirmAction.systemRole);
                  setConfirmAction(null);
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  confirmAction.role === "FREE" || confirmAction.systemRole === "USER"
                    ? "bg-red-500 hover:bg-red-400 text-white"
                    : confirmAction.systemRole === "ADMIN"
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                    : "bg-purple-500 hover:bg-purple-400 text-white"
                }`}
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

  const statusBadge = (s: string) =>
    s === "DA_MO_TK"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  const vipBadge = (v: string) => {
    if (v === "ACTIVE") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (v === "EXPIRED") return "bg-red-500/10 text-red-400 border-red-500/20";
    return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <CreditCard className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-black dark:text-white text-slate-900">Quản Lý Đăng Ký Khóa Học</h1>
            <p className="text-xs dark:text-neutral-500 text-slate-500">{rows.length} bản ghi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Tìm tên / Zalo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900 dark:placeholder-neutral-500 placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 w-48"
            />
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg border dark:border-white/[0.1] border-slate-200 dark:hover:border-white/20 hover:border-slate-300 dark:text-neutral-400 text-slate-500 dark:hover:text-white hover:text-slate-900 transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl dark:border-white/[0.08] border-white/50 dark:bg-white/[0.03] bg-white/60 backdrop-blur-xl border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b dark:border-white/[0.06] border-slate-200 text-[12px] uppercase tracking-wider dark:text-neutral-500 text-slate-500">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">Tên</th>
              <th className="px-4 py-3 font-bold">Zalo</th>
              <th className="px-4 py-3 font-bold">Trạng Thái</th>
              <th className="px-4 py-3 font-bold">VIP</th>
              <th className="px-4 py-3 font-bold">Ngày ĐK</th>
              <th className="px-4 py-3 font-bold text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <RefreshCw className="w-5 h-5 text-neutral-600 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-xs text-neutral-600">
                  Không có bản ghi nào.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id} className="border-b dark:border-white/[0.04] border-slate-100 dark:hover:bg-white/[0.03] hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input value={editData.name ?? ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="px-2 py-1 rounded dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900 w-32" />
                    ) : (
                      <span className="text-sm dark:text-white text-slate-900 font-medium">{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input value={editData.zalo ?? ""} onChange={(e) => setEditData({ ...editData, zalo: e.target.value })} className="px-2 py-1 rounded dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900 w-28" />
                    ) : (
                      <span className="text-xs dark:text-neutral-300 text-slate-600 font-mono">{row.zalo}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <select value={editData.status ?? ""} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="px-2 py-1 rounded dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900">
                        <option value="CHUA_MO_TK">Chưa mở TK</option>
                        <option value="DA_MO_TK">Đã mở TK</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold ${statusBadge(row.status)}`}>
                        {row.status === "DA_MO_TK" ? "Đã mở TK" : "Chưa mở TK"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <select value={editData.vipStatus ?? ""} onChange={(e) => setEditData({ ...editData, vipStatus: e.target.value })} className="px-2 py-1 rounded dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 text-xs dark:text-white text-slate-900">
                        <option value="NONE">NONE</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[12px] font-bold ${vipBadge(row.vipStatus)}`}>{row.vipStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs dark:text-neutral-500 text-slate-500">{new Date(row.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === row.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer" title="Lưu"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelEdit} className="p-1.5 rounded-md bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-400 transition-colors cursor-pointer" title="Hủy"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)} className="p-1.5 rounded-md dark:hover:bg-white/[0.06] hover:bg-slate-100 dark:text-neutral-500 text-slate-400 dark:hover:text-white hover:text-slate-900 transition-colors cursor-pointer" title="Sửa"><Edit3 className="w-3.5 h-3.5" /></button>
                          {row.status !== "DA_MO_TK" && (
                            <button onClick={() => handleApprove(row.id)} className="p-1.5 rounded-md hover:bg-emerald-500/10 dark:text-neutral-500 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer" title="Duyệt"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-md hover:bg-red-500/10 dark:text-neutral-500 text-slate-400 hover:text-red-400 transition-colors cursor-pointer" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
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
    s === "NEW" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : s === "CONTACTED" ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  const statusLabel = (s: string) =>
    s === "NEW" ? "Mới" : s === "CONTACTED" ? "Đã liên hệ" : "Hoàn thành";

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 text-neutral-600 animate-spin" />
    </div>
  );
  if (error) return <p className="text-sm text-red-400 py-8 text-center">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black dark:text-white text-slate-900">Tư Vấn Margin</h2>
          <p className="text-xs dark:text-neutral-500 text-slate-500">{rows.length} yêu cầu</p>
        </div>
        <button
          onClick={fetchRows}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 border dark:hover:border-white/20 hover:border-slate-300 text-xs dark:text-neutral-300 text-slate-600 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Làm mới
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 dark:text-neutral-600 text-slate-400 text-sm">Chưa có yêu cầu nào.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="dark:bg-white/[0.03] bg-white/60 backdrop-blur-xl border dark:border-white/[0.08] border-white/50 rounded-2xl p-4 sm:p-5 space-y-3">
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black dark:text-white text-slate-900">{row.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs dark:text-neutral-500 text-slate-500">
                    <span>{row.phone}</span>
                    {row.email && <span>{row.email}</span>}
                    {row.company && <span>· {row.company}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${statusColor(row.status)}`}>
                    {statusLabel(row.status)}
                  </span>
                  <span className="text-[12px] dark:text-neutral-600 text-slate-400">
                    {new Date(row.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="dark:text-neutral-600 text-slate-400 mb-0.5">Mã CK</p>
                  <p className="dark:text-neutral-200 text-slate-700 font-mono font-medium">{row.tickers}</p>
                </div>
                <div>
                  <p className="dark:text-neutral-600 text-slate-400 mb-0.5">Tỉ lệ ký quỹ</p>
                  <p className="dark:text-neutral-200 text-slate-700">{row.marginRatio}</p>
                </div>
                <div>
                  <p className="dark:text-neutral-600 text-slate-400 mb-0.5">Hạn mức vay</p>
                  <p className="dark:text-neutral-200 text-slate-700">{row.loanAmount}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t dark:border-white/[0.06] border-slate-200">
                {/* Status selector */}
                <select
                  value={row.status}
                  onChange={(e) => updateRow(row.id, { status: e.target.value })}
                  disabled={saving === row.id}
                  className="px-2.5 py-1.5 rounded-lg dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 border text-xs dark:text-white text-slate-900 focus:outline-none cursor-pointer disabled:opacity-50"
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
                  className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg dark:bg-white/[0.06] bg-white dark:border-white/[0.1] border-slate-200 border text-xs dark:text-white text-slate-900 dark:placeholder-neutral-600 placeholder-slate-400 focus:outline-none"
                />
                <button
                  onClick={() => {
                    const note = editNote[row.id] ?? row.note ?? "";
                    updateRow(row.id, { note });
                  }}
                  disabled={saving === row.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
        <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
          Nhật ký giao dịch khách hàng
        </h2>
        <span className={`text-xs ${isDark ? "text-neutral-500" : "text-slate-400"}`}>
          {total} bản ghi
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg border text-xs ${
            isDark ? "bg-white/[0.06] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          <option value="">Tất cả khách hàng</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Search className={`w-3.5 h-3.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`} />
          <input
            type="text"
            placeholder="Lọc mã CK..."
            value={filterTicker}
            onChange={(e) => { setFilterTicker(e.target.value.toUpperCase()); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg border text-xs w-32 ${
              isDark ? "bg-white/[0.06] border-white/[0.1] text-white placeholder-neutral-600" : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>
        <button
          onClick={fetchJournals}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-neutral-500 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className={`text-sm text-center py-12 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>
          Không có nhật ký nào.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${isDark ? "border-white/[0.06]" : "border-slate-200"}`}>
                <th className={`text-left py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Ngày</th>
                <th className={`text-left py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Khách hàng</th>
                <th className={`text-left py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Mã CK</th>
                <th className={`text-center py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Lệnh</th>
                <th className={`text-right py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Giá</th>
                <th className={`text-right py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>KL</th>
                <th className={`text-right py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Giá trị</th>
                <th className={`text-left py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Tâm lý</th>
                <th className={`text-left py-2 px-3 font-bold ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`border-b ${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"}`}>
                  <td className={`py-2 px-3 ${isDark ? "text-neutral-300" : "text-slate-700"}`}>{fmtDate(e.tradeDate || e.createdAt)}</td>
                  <td className="py-2 px-3">
                    <div>
                      <span className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>{e.user.name || "—"}</span>
                      <span className={`block text-[11px] ${isDark ? "text-neutral-500" : "text-slate-400"}`}>{e.user.email}</span>
                    </div>
                  </td>
                  <td className={`py-2 px-3 font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{e.ticker}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      e.action === "BUY"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}>
                      {e.action === "BUY" ? "MUA" : "BÁN"}
                    </span>
                  </td>
                  <td className={`py-2 px-3 text-right ${isDark ? "text-neutral-300" : "text-slate-700"}`}>{fmtPrice(e.price)}</td>
                  <td className={`py-2 px-3 text-right ${isDark ? "text-neutral-300" : "text-slate-700"}`}>{fmtPrice(e.quantity)}</td>
                  <td className={`py-2 px-3 text-right font-medium ${isDark ? "text-neutral-200" : "text-slate-800"}`}>
                    {fmtPrice(e.price * e.quantity)}
                  </td>
                  <td className="py-2 px-3">
                    {e.psychologyTag && (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${isDark ? "bg-white/[0.06] text-neutral-300" : "bg-slate-100 text-slate-600"}`}>
                        {e.psychologyTag}
                      </span>
                    )}
                  </td>
                  <td className={`py-2 px-3 max-w-[200px] truncate ${isDark ? "text-neutral-400" : "text-slate-500"}`}>
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
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-30 ${
              isDark ? "bg-white/[0.06] text-white hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            ← Trước
          </button>
          <span className={`text-xs ${isDark ? "text-neutral-400" : "text-slate-500"}`}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-30 ${
              isDark ? "bg-white/[0.06] text-white hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
}
