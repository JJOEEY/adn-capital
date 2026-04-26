"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw, PenSquare, Trash2, ExternalLink } from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

const RichTextEditor = dynamic(() => import("@/components/editor/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>,
});

// ── Types ──
interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  aiSummary: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  pdfUrl: string | null;
  status: string;
  tags: string[];
  sentiment: string | null;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null } | null;
  category: { id: string; name: string; slug: string } | null;
}
interface Category {
  id: string;
  name: string;
  slug: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "Nháp", bg: "bg-slate-500/15", text: "text-slate-400" },
  PENDING_APPROVAL: { label: "Chờ duyệt", bg: "bg-amber-500/15", text: "text-amber-400" },
  PUBLISHED: { label: "Đã xuất bản", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  REJECTED: { label: "Từ chối", bg: "bg-red-500/15", text: "text-red-400" },
};

function parseTagsInput(value: string): string[] {
  return value
    .split(/[,;\n]/g)
    .map((tag) => tag.replace(/^#+/, "").trim())
    .filter(Boolean);
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

export default function AdminArticlesPage() {
  const { isWriter, isLoading: authLoading } = useCurrentDbUser();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Write article form ──
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeCategoryId, setWriteCategoryId] = useState("");
  const [writeImageUrl, setWriteImageUrl] = useState("");
  const [writeTags, setWriteTags] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSubmitting, setWriteSubmitting] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      const [artRes, catRes] = await Promise.all([
        fetch("/api/articles?status=ALL&limit=50").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
      ]);
      setArticles(artRes.articles ?? []);
      setCategories(catRes.categories ?? []);
    } catch (e) {
      console.error("Fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const filtered = useMemo(() => {
    let list = articles;
    if (filterStatus !== "ALL") list = list.filter((a) => a.status === filterStatus);
    if (filterCategory !== "ALL") list = list.filter((a) => a.category?.slug === filterCategory);
    return list;
  }, [articles, filterStatus, filterCategory]);

  const pendingCount = articles.filter((a) => a.status === "PENDING_APPROVAL").length;

  // ── Actions ──
  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setArticles((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: newStatus, publishedAt: newStatus === "PUBLISHED" ? new Date().toISOString() : a.publishedAt }
              : a
          )
        );
      }
    } catch (e) {
      console.error("Status update failed:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Xóa bài viết: "${title}"?`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCrawl = async () => {
    setCrawling(true);
    setCrawlResult(null);
    try {
      const res = await fetch("/api/crawler/run", { method: "POST" });
      const data = await res.json();
      setCrawlResult(data.message ?? data.error ?? "Hoàn tất");
      await fetchArticles();
    } catch (e) {
      setCrawlResult("Lỗi crawl: " + String(e));
    } finally {
      setCrawling(false);
    }
  };

  const handleWriteSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) return;
    setWriteSubmitting(true);
    setWriteError(null);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: writeTitle.trim(),
          content: writeContent.trim(),
          categoryId: writeCategoryId || null,
          imageUrl: writeImageUrl.trim() || null,
          tags: parseTagsInput(writeTags),
        }),
      });
      if (res.ok) {
        setWriteTitle("");
        setWriteContent("");
        setWriteCategoryId("");
        setWriteImageUrl("");
        setWriteTags("");
        setShowWriteForm(false);
        await fetchArticles();
      } else {
        const data = await res.json().catch(() => null);
        setWriteError(data?.error || "Không thể tạo bài viết. Vui lòng kiểm tra lại nội dung.");
      }
    } catch (e) {
      console.error("Write failed:", e);
      setWriteError("Không thể tạo bài viết do lỗi kết nối máy chủ.");
    } finally {
      setWriteSubmitting(false);
    }
  };

  // ── Auth guard ──
  const router = useRouter();
  useEffect(() => {
    if (!authLoading && !isWriter) {
      router.replace("/khac/tin-tuc");
    }
  }, [authLoading, isWriter, router]);

  if (authLoading || !isWriter) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] p-6">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý Bài viết</h1>
            <p className="text-sm text-slate-500 mt-1">CMS — Duyệt bài, quản lý nội dung</p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-medium text-amber-400">{pendingCount} bài chờ duyệt</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Action Bar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setShowWriteForm(!showWriteForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors text-sm font-medium"
          >
            <PenSquare className="w-4 h-4" />
            Viết bài mới
          </button>
          <button
            onClick={handleCrawl}
            disabled={crawling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {crawling ? "Đang crawl..." : "Crawl tin mới"}
          </button>
          {crawlResult && (
            <span className="text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg">{crawlResult}</span>
          )}
        </div>

        {/* ── Write Article Form ── */}
        {showWriteForm && (
          <div className="mb-6 p-5 rounded-xl bg-white/[0.03] border border-white/10">
            <h3 className="text-sm font-bold text-white mb-4">Viết bài mới</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tiêu đề bài viết"
                value={writeTitle}
                onChange={(e) => setWriteTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={writeCategoryId}
                  onChange={(e) => setWriteCategoryId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">Chọn chuyên mục</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="url"
                  placeholder="URL hình ảnh (tùy chọn)"
                  value={writeImageUrl}
                  onChange={(e) => setWriteImageUrl(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <input
                type="text"
                placeholder="Hashtag SEO, ví dụ: #chung-khoan, #tai-chinh, #VNIndex"
                value={writeTags}
                onChange={(e) => setWriteTags(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <textarea
                placeholder="Nội dung bài viết (hỗ trợ HTML)"
                value={writeContent}
                onChange={(e) => setWriteContent(e.target.value)}
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-y hidden"
              />
              <RichTextEditor
                content={writeContent}
                onChange={setWriteContent}
                uploadEndpoint="/api/articles/upload-image"
                onImageUploaded={(url) => setWriteImageUrl((current) => current || url)}
                placeholder="Nội dung bài viết... (hỗ trợ copy-paste hình ảnh, kéo-thả file ảnh)"
              />
              {writeError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {writeError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleWriteSubmit}
                  disabled={writeSubmitting || !writeTitle.trim() || !writeContent.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {writeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
                  Tạo bài viết
                </button>
                <button
                  onClick={() => setShowWriteForm(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition-colors"
                >
                  Hủy
                </button>
                <span className="text-[11px] text-slate-500">Bài sẽ ở trạng thái &quot;Chờ duyệt&quot;</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ── */}
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
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <span className="text-sm text-slate-500">{filtered.length} bài viết</span>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-4">Bài viết</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-4 hidden md:table-cell">Tác giả</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-4 hidden sm:table-cell">Chuyên mục</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-4">Trạng thái</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                        Chưa có bài viết nào. Nhấn &quot;Crawl tin mới&quot; hoặc &quot;Viết bài mới&quot; để bắt đầu.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((article) => (
                      <tr key={article.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/khac/tin-tuc/${article.slug}`}
                            className="text-sm font-medium text-slate-200 hover:text-blue-400 transition-colors line-clamp-1"
                          >
                            {article.title}
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            {article.createdAt && (
                              <span>{new Date(article.createdAt).toLocaleDateString("vi-VN")}</span>
                            )}
                            {article.sourceUrl && (
                              <a
                                href={article.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-400/60 hover:text-blue-400"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Nguồn
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className="text-sm text-slate-400">{article.author?.name ?? "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="text-xs text-blue-400">{article.category?.name ?? "—"}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={article.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {actionLoading === article.id ? (
                              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                              <>
                                {article.status === "PENDING_APPROVAL" && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(article.id, "PUBLISHED")}
                                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      ✓ Duyệt
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(article.id, "REJECTED")}
                                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                    >
                                      ✗ Từ chối
                                    </button>
                                  </>
                                )}
                                {article.status === "DRAFT" && (
                                  <button
                                    onClick={() => handleStatusChange(article.id, "PENDING_APPROVAL")}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                  >
                                    Gửi duyệt
                                  </button>
                                )}
                                {article.status === "REJECTED" && (
                                  <button
                                    onClick={() => handleStatusChange(article.id, "PENDING_APPROVAL")}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                  >
                                    Gửi lại
                                  </button>
                                )}
                                {article.status === "PUBLISHED" && (
                                  <button
                                    onClick={() => handleStatusChange(article.id, "DRAFT")}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20 transition-colors"
                                  >
                                    Gỡ xuống
                                  </button>
                                )}
                                <Link
                                  href={`/khac/tin-tuc/${article.slug}`}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-colors"
                                >
                                  Xem
                                </Link>
                                <button
                                  onClick={() => handleDelete(article.id, article.title)}
                                  className="text-xs font-medium p-1.5 rounded-lg bg-red-500/5 text-red-400/60 border border-red-500/10 hover:bg-red-500/15 hover:text-red-400 transition-colors"
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
          </div>
        )}

        {/* ── Workflow Legend ── */}
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
