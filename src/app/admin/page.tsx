"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  vipUntil: string | null;
  dnseId: string | null;
  dnseVerified: boolean;
  dnseAppliedAt: string | null;
  chatCount: number;
  createdAt: string;
}

type Tab = "registrations" | "users";

export default function AdminPage() {
  const { status } = useSession();
  const { isAdmin, isLoading: userLoading } = useCurrentDbUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    if (!userLoading && status !== "loading" && !isAdmin) {
      router.replace("/");
    }
  }, [userLoading, status, isAdmin, router]);

  if (userLoading || status === "loading") {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-6 h-6 text-neutral-600 animate-spin" />
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
          <h2 className="text-lg font-bold text-white">Không có quyền truy cập</h2>
          <p className="text-sm text-neutral-500">Trang này chỉ dành cho Admin.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* ── Tab Navigation ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-neutral-900/60 p-1 rounded-xl border border-neutral-800 w-fit">
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "users"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : "text-neutral-500 hover:text-white"
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
                : "text-neutral-500 hover:text-white"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Đăng Ký Khóa Học
          </button>
        </div>

        {tab === "users" ? <UsersTab /> : <RegistrationsTab />}
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

  const handleSetRole = async (userId: string, role: string, vipDays?: number) => {
    const data: Record<string, unknown> = { role };
    if (role === "VIP" && vipDays) {
      data.vipUntil = new Date(Date.now() + vipDays * 86400000).toISOString();
    }
    if (role === "FREE") {
      data.vipUntil = null;
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
            <h1 className="text-xl font-black text-white">Quản Lý Users & DNSE</h1>
            <p className="text-xs text-neutral-500">
              {users.length} users · {pendingCount > 0 && (
                <span className="text-amber-400">{pendingCount} chờ duyệt DNSE</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-neutral-900 rounded-lg border border-neutral-800 p-0.5">
            {(["all", "pending", "verified"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  filter === f
                    ? f === "pending"
                      ? "bg-amber-500/15 text-amber-400"
                      : f === "verified"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-neutral-800 text-white"
                    : "text-neutral-500 hover:text-white"
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
              className="pl-8 pr-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 w-56"
            />
          </div>
          <button
            onClick={fetchUsers}
            className="p-2 rounded-lg border border-neutral-700 hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">Email</th>
              <th className="px-4 py-3 font-bold">Tên</th>
              <th className="px-4 py-3 font-bold">Role</th>
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
                <td colSpan={9} className="px-4 py-12 text-center">
                  <RefreshCw className="w-5 h-5 text-neutral-600 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-xs text-neutral-600">
                  Không có user nào.
                </td>
              </tr>
            ) : (
              filtered.map((user, i) => (
                <tr
                  key={user.id}
                  className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors ${
                    user.dnseId && !user.dnseVerified ? "bg-amber-500/[0.03]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{i + 1}</td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-white font-mono">{user.email}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-neutral-300">{user.name ?? "—"}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        user.role === "VIP"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {user.vipUntil
                      ? new Date(user.vipUntil).toLocaleDateString("vi-VN")
                      : "—"}
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Xác minh
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse">
                        <Clock className="w-3 h-3" />
                        Chờ duyệt
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-neutral-500">
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

                      {/* VIP 30 ngày */}
                      {user.role !== "VIP" && (
                        <button
                          onClick={() => handleSetRole(user.id, "VIP", 30)}
                          className="p-1.5 rounded-md hover:bg-purple-500/10 text-neutral-500 hover:text-purple-400 transition-colors cursor-pointer"
                          title="Cấp VIP 30 ngày"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Hạ về FREE */}
                      {user.role === "VIP" && (
                        <button
                          onClick={() => handleSetRole(user.id, "FREE")}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Hạ về FREE"
                        >
                          <ShieldX className="w-3.5 h-3.5" />
                        </button>
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
            <h1 className="text-xl font-black text-white">Quản Lý Đăng Ký Khóa Học</h1>
            <p className="text-xs text-neutral-500">{rows.length} bản ghi</p>
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
              className="pl-8 pr-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 w-48"
            />
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg border border-neutral-700 hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer">
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

      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500">
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
                <tr key={row.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input value={editData.name ?? ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white w-32" />
                    ) : (
                      <span className="text-sm text-white font-medium">{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input value={editData.zalo ?? ""} onChange={(e) => setEditData({ ...editData, zalo: e.target.value })} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white w-28" />
                    ) : (
                      <span className="text-xs text-neutral-300 font-mono">{row.zalo}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <select value={editData.status ?? ""} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white">
                        <option value="CHUA_MO_TK">Chưa mở TK</option>
                        <option value="DA_MO_TK">Đã mở TK</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge(row.status)}`}>
                        {row.status === "DA_MO_TK" ? "Đã mở TK" : "Chưa mở TK"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <select value={editData.vipStatus ?? ""} onChange={(e) => setEditData({ ...editData, vipStatus: e.target.value })} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white">
                        <option value="NONE">NONE</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${vipBadge(row.vipStatus)}`}>{row.vipStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{new Date(row.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === row.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer" title="Lưu"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelEdit} className="p-1.5 rounded-md bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-400 transition-colors cursor-pointer" title="Hủy"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)} className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors cursor-pointer" title="Sửa"><Edit3 className="w-3.5 h-3.5" /></button>
                          {row.status !== "DA_MO_TK" && (
                            <button onClick={() => handleApprove(row.id)} className="p-1.5 rounded-md hover:bg-emerald-500/10 text-neutral-500 hover:text-emerald-400 transition-colors cursor-pointer" title="Duyệt"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
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
