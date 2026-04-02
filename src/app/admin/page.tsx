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
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  ADMIN CRM — Quản lý đăng ký khóa học
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

export default function AdminPage() {
  const { status } = useSession();
  const { isAdmin, isLoading: userLoading } = useCurrentDbUser();
  const router = useRouter();
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Registration>>({});

  // Redirect non-admin users
  useEffect(() => {
    console.log("[Admin] Auth check:", { userLoading, status, isAdmin });
    if (!userLoading && status !== "loading" && !isAdmin) {
      console.warn("[Admin] Không có quyền → redirect /");
      router.replace("/");
    }
  }, [userLoading, status, isAdmin, router]);

  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/registrations");
      if (res.status === 403) {
        setError("Bạn không có quyền truy cập trang này.");
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data);
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) fetchData();
    else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, isAdmin, fetchData]);

  // Show nothing while checking permissions (avoid flash)
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

  /* ── Actions ────────────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xóa đăng ký này?")) return;
    const res = await fetch(`/api/admin/registrations/${id}`, {
      method: "DELETE",
    });
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

  const cancelEdit = () => {
    setEditId(null);
    setEditData({});
  };

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

  /* ── Filter ─────────────────────────────────────────────────── */
  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.zalo.includes(search)
  );

  /* ── Badge helpers ──────────────────────────────────────────── */
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
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Quản Lý Đăng Ký</h1>
              <p className="text-xs text-neutral-500">
                {rows.length} bản ghi · Admin CRM
              </p>
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
            <button
              onClick={fetchData}
              className="p-2 rounded-lg border border-neutral-700 hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Table */}
        {!error && (
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
                      <p className="text-xs text-neutral-600 mt-2">Đang tải...</p>
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
                    <tr
                      key={row.id}
                      className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-neutral-600 font-mono">
                        {i + 1}
                      </td>

                      {/* Tên */}
                      <td className="px-4 py-3">
                        {editId === row.id ? (
                          <input
                            value={editData.name ?? ""}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white w-32"
                          />
                        ) : (
                          <span className="text-sm text-white font-medium">{row.name}</span>
                        )}
                      </td>

                      {/* Zalo */}
                      <td className="px-4 py-3">
                        {editId === row.id ? (
                          <input
                            value={editData.zalo ?? ""}
                            onChange={(e) => setEditData({ ...editData, zalo: e.target.value })}
                            className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white w-28"
                          />
                        ) : (
                          <span className="text-xs text-neutral-300 font-mono">{row.zalo}</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        {editId === row.id ? (
                          <select
                            value={editData.status ?? ""}
                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                            className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white"
                          >
                            <option value="CHUA_MO_TK">Chưa mở TK</option>
                            <option value="DA_MO_TK">Đã mở TK</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge(
                              row.status
                            )}`}
                          >
                            {row.status === "DA_MO_TK" ? "Đã mở TK" : "Chưa mở TK"}
                          </span>
                        )}
                      </td>

                      {/* VIP */}
                      <td className="px-4 py-3">
                        {editId === row.id ? (
                          <select
                            value={editData.vipStatus ?? ""}
                            onChange={(e) => setEditData({ ...editData, vipStatus: e.target.value })}
                            className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-white"
                          >
                            <option value="NONE">NONE</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="EXPIRED">EXPIRED</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${vipBadge(
                              row.vipStatus
                            )}`}
                          >
                            {row.vipStatus}
                          </span>
                        )}
                      </td>

                      {/* Ngày */}
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {new Date(row.createdAt).toLocaleDateString("vi-VN")}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {editId === row.id ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                title="Lưu"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1.5 rounded-md bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-400 transition-colors"
                                title="Hủy"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(row)}
                                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                                title="Sửa"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {row.status !== "DA_MO_TK" && (
                                <button
                                  onClick={() => handleApprove(row.id)}
                                  className="p-1.5 rounded-md hover:bg-emerald-500/10 text-neutral-500 hover:text-emerald-400 transition-colors"
                                  title="Duyệt (Mở TK + VIP)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(row.id)}
                                className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        )}
      </div>
    </MainLayout>
  );
}
