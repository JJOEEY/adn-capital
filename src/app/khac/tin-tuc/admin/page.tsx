"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { mockArticles, mockCategories, type MockArticle } from "@/lib/mock-articles";

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "Nháp", bg: "bg-slate-500/15", text: "text-slate-400" },
  PENDING_APPROVAL: { label: "Chờ duyệt", bg: "bg-amber-500/15", text: "text-amber-400" },
  PUBLISHED: { label: "Đã xuất bản", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  REJECTED: { label: "Từ chối", bg: "bg-red-500/15", text: "text-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// Create some mock "pending" articles for demo
const allMockArticles: (MockArticle & { status: string })[] = [
  ...mockArticles,
  {
    ...mockArticles[0],
    id: "pending-1",
    title: "[PENDING] Phân tích kỹ thuật VN-Index tuần 07-11/4/2026",
    slug: "phan-tich-ky-thuat-vn-index-tuan-07-11-4-2026",
    status: "PENDING_APPROVAL",
    authorName: "Writer Demo",
  },
  {
    ...mockArticles[1],
    id: "pending-2",
    title: "[PENDING] Top 5 cổ phiếu tiềm năng tháng 4/2026",
    slug: "top-5-co-phieu-tiem-nang-thang-4-2026",
    status: "PENDING_APPROVAL",
    authorName: "Writer Demo",
  },
  {
    ...mockArticles[2],
    id: "draft-1",
    title: "[DRAFT] Nhận định thị trường phiên sáng 8/4",
    slug: "nhan-dinh-thi-truong-phien-sang-8-4",
    status: "DRAFT",
    authorName: "Writer Demo",
  },
];

export default function AdminArticlesPage() {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const filtered = useMemo(() => {
    let list = allMockArticles;
    if (filterStatus !== "ALL") list = list.filter((a) => a.status === filterStatus);
    if (filterCategory !== "ALL") list = list.filter((a) => a.categorySlug === filterCategory);
    return list;
  }, [filterStatus, filterCategory]);

  const pendingCount = allMockArticles.filter((a) => a.status === "PENDING_APPROVAL").length;

  const handleApprove = (id: string) => {
    alert(`[Mock] Đã duyệt bài viết ${id} → PUBLISHED`);
  };

  const handleReject = (id: string) => {
    alert(`[Mock] Đã từ chối bài viết ${id} → REJECTED`);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý Bài viết</h1>
            <p className="text-sm text-slate-500 mt-1">CMS — Duyệt bài, quản lý nội dung</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-medium text-amber-400">{pendingCount} bài chờ duyệt</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="PENDING_APPROVAL">Chờ duyệt</option>
            <option value="DRAFT">Nháp</option>
            <option value="REJECTED">Từ chối</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="ALL">Tất cả chuyên mục</option>
            {mockCategories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <span className="text-sm text-slate-500">{filtered.length} bài viết</span>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Bài viết</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Tác giả</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Chuyên mục</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Trạng thái</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((article) => (
                  <tr key={article.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/khac/tin-tuc/${article.slug}`}
                        className="text-sm font-medium text-slate-200 hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {article.title}
                      </Link>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(article.publishedAt).toLocaleDateString("vi-VN")}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-400">{article.authorName}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-blue-400">{article.categoryName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {article.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => handleApprove(article.id)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            >
                              ✓ Duyệt
                            </button>
                            <button
                              onClick={() => handleReject(article.id)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                            >
                              ✗ Từ chối
                            </button>
                          </>
                        )}
                        <Link
                          href={`/khac/tin-tuc/${article.slug}`}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          Xem
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Luồng duyệt bài:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500" /> WRITER tạo bài → DRAFT
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Gửi duyệt → PENDING
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> ADMIN duyệt → PUBLISHED
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" /> ADMIN từ chối → REJECTED
          </span>
        </div>
      </div>
    </div>
  );
}
