"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { FileText, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { getArticleFallbackImage } from "@/lib/articles/image-fallback";

// ── Types from API ──
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
  author: { id: string; name: string | null; image: string | null } | null;
  category: { id: string; name: string; slug: string } | null;
}

// Detail page: hide image entirely on error (no grey placeholder)
function HeroImage({ src, fallbackSrc, alt }: { src: string; fallbackSrc?: string; alt: string }) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const resolvedSrc =
    src && !failedSrcs.includes(src)
      ? src
      : fallbackSrc && !failedSrcs.includes(fallbackSrc)
        ? fallbackSrc
        : "";
  const handleError = useCallback(() => {
    if (!resolvedSrc) return;
    setFailedSrcs((current) => current.includes(resolvedSrc) ? current : [...current, resolvedSrc]);
  }, [resolvedSrc]);
  if (!resolvedSrc) return null;
  return (
    <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-8">
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 800px"
        priority
        onError={handleError}
      />
    </div>
  );
}

// Related card: fallback gradient on error
function ImgWithFallback({ src, fallbackSrc, alt, fill, className, sizes, priority }: {
  src: string; fallbackSrc?: string; alt: string; fill?: boolean; className?: string; sizes?: string; priority?: boolean;
}) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const resolvedSrc =
    src && !failedSrcs.includes(src)
      ? src
      : fallbackSrc && !failedSrcs.includes(fallbackSrc)
        ? fallbackSrc
        : "";
  const handleError = useCallback(() => {
    if (!resolvedSrc) return;
    setFailedSrcs((current) => current.includes(resolvedSrc) ? current : [...current, resolvedSrc]);
  }, [resolvedSrc]);
  if (!resolvedSrc) {
    return (
      <div className={`${fill ? "absolute inset-0" : ""} bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center`}>
        <span className="text-[11px] font-bold text-slate-500 uppercase">ADN</span>
      </div>
    );
  }
  return <Image src={resolvedSrc} alt={alt} fill={fill} className={className} sizes={sizes} priority={priority} onError={handleError} />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    "Tích cực": { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
    "Tiêu cực": { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
    "Trung tính": { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  };
  const s = map[sentiment] ?? map["Trung tính"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {sentiment}
    </span>
  );
}

function RelatedCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/khac/tin-tuc/${article.slug}`}
      className="group flex gap-3 py-3 border-b border-white/5 last:border-b-0"
    >
      <div className="relative w-24 h-16 flex-shrink-0 rounded-lg overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl ?? ""}
          fallbackSrc={getArticleFallbackImage(article)}
          alt={article.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="96px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-slate-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
          {article.title}
        </h4>
        <span className="text-[11px] text-slate-500 mt-1 block">{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
      </div>
    </Link>
  );
}

export function ArticleDetailClient({ slug }: { slug: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/articles/by-slug/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setArticle(data.article);
          setRelated(data.related ?? []);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (notFound || !article) {
    return (
      <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Không tìm thấy bài viết</h1>
        <p className="text-slate-400 mb-6">Bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
        <Link href="/khac/tin-tuc" className="text-blue-400 hover:underline">
          ← Quay lại trang tin tức
        </Link>
      </div>
      </MainLayout>
    );
  }

  const authorName = article.author?.name ?? "ADN Capital";
  const categoryName = article.category?.name ?? "";
  const publishDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <MainLayout>
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/khac/tin-tuc" className="hover:text-blue-400 transition-colors">
          Tin tức
        </Link>
        <span>/</span>
        <span className="text-blue-400">{categoryName}</span>
      </nav>

      {/* ── Title ── */}
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
        {article.title}
      </h1>

      {/* ── Meta: Author, Date, Sentiment ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {authorName.charAt(0)}
          </div>
          <span className="font-medium text-slate-300">{authorName}</span>
        </div>
        <span className="text-slate-600">|</span>
        <span>{publishDate}</span>
        <span className="text-slate-600">|</span>
        {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
        {article.sourceUrl && (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">
              Nguồn: <span className="text-blue-400">{new URL(article.sourceUrl).hostname}</span>
            </span>
          </>
        )}
      </div>

      {/* ── Tags ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {article.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* ── AI Summary Box ── */}
      {article.aiSummary && (
        <div className="relative mb-8 p-5 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              AI Tóm tắt
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {article.aiSummary}
          </p>
        </div>
      )}

      {/* ── PDF Download ── */}
      {article.pdfUrl && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <FileText className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-400">Báo cáo Research PDF</p>
            <p className="text-xs text-slate-400 mt-0.5">Tải xuống để xem chi tiết phân tích đầy đủ</p>
          </div>
          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-bold text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
          >
            Tải PDF
          </a>
        </div>
      )}

      {/* ── Hero Image (hidden if broken) ── */}
      <HeroImage src={article.imageUrl ?? ""} fallbackSrc={getArticleFallbackImage(article)} alt={article.title} />

      {/* ── Article Body ── */}
      <article
        className="prose prose-invert prose-lg max-w-none
          prose-headings:text-white prose-headings:font-bold
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-strong:text-white
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
          mb-12"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* ── Divider ── */}
      <div className="border-t border-white/10 my-8" />

      {/* ── Related Articles ── */}
      {related.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Tin liên quan
          </h3>
          <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4">
            {related.map((r) => (
              <RelatedCard key={r.id} article={r} />
            ))}
          </div>
        </div>
      )}

      {/* ── Back Link ── */}
      <div className="mt-8 text-center">
        <Link
          href="/khac/tin-tuc"
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Quay lại trang tin tức
        </Link>
      </div>
    </div>
    </MainLayout>
  );
}
