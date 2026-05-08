"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Hash,
  ImagePlus,
  Loader2,
  PenSquare,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { NEWS_PRIMARY_CATEGORIES, sortNewsCategories } from "@/lib/articles/category-priority";

const RichTextEditor = dynamic(() => import("@/components/editor/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  ),
});

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
  sortOrder?: number | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nháp", className: "border-slate-500/20 bg-slate-500/10 text-slate-300" },
  PENDING_APPROVAL: { label: "Chờ duyệt", className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  PUBLISHED: { label: "Đã đăng", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  REJECTED: { label: "Từ chối", className: "border-red-500/25 bg-red-500/10 text-red-300" },
};

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTag(value: string) {
  return value.replace(/^#+/, "").trim();
}

function getTopicDescription(slug: string) {
  if (slug === "adn-report") return "Báo cáo, nhận định chuyên sâu";
  if (slug === "phan-tich-co-phieu") return "Bài phân tích theo mã cổ phiếu";
  return "Tin thị trường và vĩ mô";
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

function TopicCard({
  category,
  active,
  onClick,
}: {
  category: Category;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-emerald-400/45 bg-emerald-500/15 text-white shadow-[0_18px_50px_rgba(16,185,129,0.12)]"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">{category.name}</p>
          <p className="mt-1 text-xs text-slate-400">{getTopicDescription(category.slug)}</p>
        </div>
        {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />}
      </div>
    </button>
  );
}

function ArticleCard({
  article,
  actionLoading,
  onStatusChange,
  onDelete,
}: {
  article: Article;
  actionLoading: string | null;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const tags = Array.isArray(article.tags) ? article.tags : [];

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="h-36 w-full overflow-hidden rounded-xl bg-slate-900 lg:h-28 lg:w-44 lg:shrink-0">
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.imageUrl} alt={article.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-wider text-slate-500">
              ADN Capital
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={article.status} />
            {article.category?.name && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {article.category.name}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {new Date(article.createdAt).toLocaleDateString("vi-VN")}
            </span>
          </div>
          <Link
            href={`/khac/tin-tuc/${article.slug}`}
            className="line-clamp-2 text-base font-bold text-white hover:text-emerald-300"
          >
            {article.title}
          </Link>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 5).map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:w-[360px] lg:justify-end">
          {actionLoading === article.id ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <>
              {article.status === "PENDING_APPROVAL" && (
                <>
                  <button
                    type="button"
                    onClick={() => onStatusChange(article.id, "PUBLISHED")}
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300"
                  >
                    Duyệt đăng
                  </button>
                  <button
                    type="button"
                    onClick={() => onStatusChange(article.id, "REJECTED")}
                    className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300"
                  >
                    Từ chối
                  </button>
                </>
              )}
              {article.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => onStatusChange(article.id, "PENDING_APPROVAL")}
                  className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
                >
                  Gửi duyệt
                </button>
              )}
              {article.status === "PUBLISHED" && (
                <button
                  type="button"
                  onClick={() => onStatusChange(article.id, "DRAFT")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300"
                >
                  Gỡ xuống
                </button>
              )}
              <Link
                href={`/khac/tin-tuc/${article.slug}`}
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Xem
              </Link>
              <button
                type="button"
                onClick={() => onDelete(article.id, article.title)}
                className="rounded-xl border border-red-500/15 bg-red-500/5 p-2 text-red-300"
                aria-label="Xóa bài viết"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const { isAdmin, isWriter, isLoading: authLoading } = useCurrentDbUser();
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showComposer, setShowComposer] = useState(true);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeCategoryId, setWriteCategoryId] = useState("");
  const [writeImageUrl, setWriteImageUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [writeTags, setWriteTags] = useState<string[]>([]);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);
  const [writeSubmitting, setWriteSubmitting] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      const [articleResponse, categoryResponse] = await Promise.all([
        fetch("/api/articles?status=ALL&limit=50", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/categories", { cache: "no-store" }).then((response) => response.json()),
      ]);
      setArticles(articleResponse.articles ?? []);
      setCategories(sortNewsCategories(categoryResponse.categories ?? []));
    } catch (error) {
      console.error("[AdminArticlesPage] Fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    if (!authLoading && !isWriter) {
      router.replace("/khac/tin-tuc");
    }
  }, [authLoading, isWriter, router]);

  const primaryCategories = useMemo(() => {
    const bySlug = new Map(categories.map((category) => [category.slug, category]));
    return NEWS_PRIMARY_CATEGORIES.map((primary) => bySlug.get(primary.slug)).filter(Boolean) as Category[];
  }, [categories]);

  const selectedCategory = categories.find((category) => category.id === writeCategoryId) ?? null;

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      const statusMatched = filterStatus === "ALL" || article.status === filterStatus;
      const categoryMatched = filterCategory === "ALL" || article.category?.slug === filterCategory;
      return statusMatched && categoryMatched;
    });
  }, [articles, filterCategory, filterStatus]);

  const pendingCount = articles.filter((article) => article.status === "PENDING_APPROVAL").length;
  const hasContent = htmlToText(writeContent).length > 0;
  const canSubmit = Boolean(writeTitle.trim() && hasContent && writeCategoryId);

  const resetComposer = () => {
    setWriteTitle("");
    setWriteContent("");
    setWriteCategoryId("");
    setWriteImageUrl("");
    setWriteTags([]);
    setTagInput("");
    setWriteError(null);
  };

  const addTag = (rawTag: string) => {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    setWriteTags((current) => {
      if (current.some((item) => item.toLowerCase() === tag.toLowerCase())) return current;
      return [...current, tag];
    });
    setTagInput("");
  };

  const uploadCoverImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setCoverUploading(true);
    setWriteError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/articles/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Không thể tải ảnh lên");
      }
      setWriteImageUrl(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải ảnh lên";
      setWriteError(message);
    } finally {
      setCoverUploading(false);
    }
  };

  const handleComposerPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0 || writeImageUrl) return;
    void uploadCoverImage(files[0]);
  };

  const handleCoverDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files ?? []).find((item) => item.type.startsWith("image/"));
    if (file) void uploadCoverImage(file);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchArticles();
      }
    } catch (error) {
      console.error("[AdminArticlesPage] Status update failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Xóa bài viết: "${title}"?`)) return;
    setActionLoading(id);
    try {
      const response = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (response.ok) {
        setArticles((current) => current.filter((article) => article.id !== id));
      }
    } catch (error) {
      console.error("[AdminArticlesPage] Delete failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCrawl = async () => {
    setCrawling(true);
    setCrawlResult(null);
    try {
      const response = await fetch("/api/crawler/run", { method: "POST" });
      const data = await response.json().catch(() => null);
      setCrawlResult(data?.message ?? data?.error ?? "Đã chạy crawl tin");
      await fetchArticles();
    } catch (error) {
      setCrawlResult("Không chạy được crawler lúc này");
      console.error("[AdminArticlesPage] Crawl failed:", error);
    } finally {
      setCrawling(false);
    }
  };

  const handleWriteSubmit = async (status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED") => {
    setWriteError(null);
    setWriteSuccess(null);

    if (!writeCategoryId) {
      setWriteError("Chọn chủ đề trước khi đăng bài.");
      return;
    }
    if (!writeTitle.trim()) {
      setWriteError("Nhập tiêu đề bài viết.");
      return;
    }
    if (!hasContent) {
      setWriteError("Nhập nội dung bài viết.");
      return;
    }

    const finalStatus = status === "PUBLISHED" && !isAdmin ? "PENDING_APPROVAL" : status;
    setWriteSubmitting(finalStatus);

    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: writeTitle.trim(),
          content: writeContent.trim(),
          categoryId: writeCategoryId,
          imageUrl: writeImageUrl || null,
          tags: writeTags,
          status: finalStatus,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Không thể tạo bài viết. Vui lòng kiểm tra lại nội dung.");
      }

      resetComposer();
      setShowComposer(false);
      setWriteSuccess(
        finalStatus === "PUBLISHED"
          ? "Bài viết đã được đăng."
          : finalStatus === "DRAFT"
            ? "Đã lưu nháp."
            : "Bài viết đã được gửi duyệt.",
      );
      await fetchArticles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tạo bài viết do lỗi kết nối.";
      setWriteError(message);
    } finally {
      setWriteSubmitting(null);
    }
  };

  if (authLoading || !isWriter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">ADN CMS</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">Quản lý bài viết</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Viết bài, thêm ảnh, gắn hashtag và duyệt nội dung trước khi hiển thị trên trang Tin Tức.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300">
                {pendingCount} bài chờ duyệt
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowComposer((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              <PenSquare className="h-4 w-4" />
              Viết bài mới
            </button>
            <button
              type="button"
              onClick={handleCrawl}
              disabled={crawling}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Crawl tin mới
            </button>
          </div>
        </header>

        {(crawlResult || writeSuccess) && (
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {writeSuccess ?? crawlResult}
          </div>
        )}

        {showComposer && (
          <section
            className="mb-6 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.24)] sm:p-5"
            onPaste={handleComposerPaste}
          >
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Tạo bài viết</h2>
                <p className="mt-1 text-sm text-slate-400">Chọn chủ đề trước, sau đó viết bài và đăng/gửi duyệt.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetComposer();
                  setShowComposer(false);
                }}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300"
              >
                <X className="h-4 w-4" />
                Đóng
              </button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-3">
              {primaryCategories.map((category) => (
                <TopicCard
                  key={category.id}
                  category={category}
                  active={writeCategoryId === category.id}
                  onClick={() => setWriteCategoryId(category.id)}
                />
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Tiêu đề bài viết"
                  value={writeTitle}
                  onChange={(event) => setWriteTitle(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-xl font-black text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
                />

                <RichTextEditor
                  content={writeContent}
                  onChange={setWriteContent}
                  uploadEndpoint="/api/articles/upload-image"
                  onImageUploaded={(url) => setWriteImageUrl((current) => current || url)}
                  placeholder="Viết nội dung bài viết. Có thể dán ảnh trực tiếp vào đây..."
                />
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="text-sm font-black text-white">Ảnh bìa</h3>
                  <p className="mt-1 text-xs text-slate-400">Upload, kéo thả hoặc paste ảnh vào khung viết.</p>
                  <div
                    className="relative mt-3 flex min-h-[190px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/20"
                    onDrop={handleCoverDrop}
                    onDragOver={(event) => event.preventDefault()}
                  >
                    {writeImageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={writeImageUrl} alt="Ảnh bìa bài viết" className="h-full min-h-[190px] w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setWriteImageUrl("")}
                          className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white"
                          aria-label="Xóa ảnh bìa"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={coverUploading}
                        className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm font-semibold text-slate-300 disabled:opacity-50"
                      >
                        {coverUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                        Thêm ảnh bìa
                      </button>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadCoverImage(file);
                    }}
                  />
                  <input
                    type="url"
                    value={writeImageUrl}
                    onChange={(event) => setWriteImageUrl(event.target.value)}
                    placeholder="Hoặc dán URL ảnh bìa"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white">
                    <Hash className="h-4 w-4" />
                    Hashtag
                  </h3>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    onBlur={() => addTag(tagInput)}
                    placeholder="Nhập hashtag rồi Enter"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {writeTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setWriteTags((current) => current.filter((item) => item !== tag))}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                      >
                        #{tag}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="text-sm font-black text-white">Trạng thái</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-400">
                    <p>
                      Chủ đề: <span className="font-semibold text-slate-200">{selectedCategory?.name ?? "Chưa chọn"}</span>
                    </p>
                    <p>
                      Vai trò: <span className="font-semibold text-slate-200">{isAdmin ? "Admin" : "Writer"}</span>
                    </p>
                  </div>
                  {writeError && (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {writeError}
                    </div>
                  )}
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => void handleWriteSubmit("DRAFT")}
                      disabled={!canSubmit || !!writeSubmitting}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {writeSubmitting === "DRAFT" ? "Đang lưu..." : "Lưu nháp"}
                    </button>
                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleWriteSubmit("PENDING_APPROVAL")}
                        disabled={!canSubmit || !!writeSubmitting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Send className="h-4 w-4" />
                        {writeSubmitting === "PENDING_APPROVAL" ? "Đang gửi..." : "Gửi duyệt"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleWriteSubmit("PUBLISHED")}
                        disabled={!canSubmit || !!writeSubmitting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {writeSubmitting === "PUBLISHED" ? "Đang đăng..." : "Đăng bài"}
                      </button>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Danh sách bài viết</h2>
              <p className="mt-1 text-sm text-slate-500">{filtered.length} bài đang hiển thị</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#151a21] px-3 py-2 text-sm text-slate-200 focus:outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PUBLISHED">Đã đăng</option>
                <option value="PENDING_APPROVAL">Chờ duyệt</option>
                <option value="DRAFT">Nháp</option>
                <option value="REJECTED">Từ chối</option>
              </select>
              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#151a21] px-3 py-2 text-sm text-slate-200 focus:outline-none"
              >
                <option value="ALL">Tất cả chủ đề</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-14 text-center text-slate-400">
              Chưa có bài viết phù hợp.
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  actionLoading={actionLoading}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
