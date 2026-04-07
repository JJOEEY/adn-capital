"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { FileText } from "lucide-react";
import { mockArticles, mockCategories, type MockArticle } from "@/lib/mock-articles";

// ── Placeholder fallback ──
const PLACEHOLDER_IMG = "/data/placeholder-news.svg";

function ImgWithFallback({
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const handleError = useCallback(() => setImgSrc(PLACEHOLDER_IMG), []);
  return (
    <Image
      src={imgSrc || PLACEHOLDER_IMG}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      onError={handleError}
    />
  );
}

// ── Helpers ──
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
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {sentiment}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
//  HERO CARD — Bài nổi bật trên cùng cột chính
// ═══════════════════════════════════════════════════════════
function HeroCard({ article }: { article: MockArticle }) {
  return (
    <Link href={`/khac/tin-tuc/${article.slug}`} className="group block mb-5">
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 65vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-white/90 bg-blue-500/80 px-2 py-0.5 rounded uppercase tracking-wider">
              {article.categoryName}
            </span>
            <SentimentBadge sentiment={article.sentiment} />
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">AI</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight mb-2 group-hover:text-blue-300 transition-colors line-clamp-3 drop-shadow-lg">
            {article.title}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed line-clamp-2 mb-2 hidden md:block">
            {article.aiSummary}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-white/50">
            <span>{article.authorName}</span>
            <span>·</span>
            <span>{timeAgo(article.publishedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════
//  ARTICLE ROW — Thumbnail trái, nội dung phải
// ═══════════════════════════════════════════════════════════
function ArticleRow({ article }: { article: MockArticle }) {
  return (
    <Link
      href={`/khac/tin-tuc/${article.slug}`}
      className="group flex gap-3.5 py-3.5 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors rounded-lg -mx-1 px-1"
    >
      <div className="relative w-[100px] h-[72px] md:w-[120px] md:h-[80px] flex-shrink-0 rounded-xl overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="120px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">{article.categoryName}</span>
          <SentimentBadge sentiment={article.sentiment} />
        </div>
        <h3 className="text-[13px] md:text-sm font-bold text-slate-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
          {article.sourceUrl && (
            <>
              <span>{new URL(article.sourceUrl).hostname.replace("www.", "")}</span>
              <span>·</span>
            </>
          )}
          <span>{timeAgo(article.publishedAt)}</span>
          {article.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-blue-400/50">#{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════
//  RESEARCH PDF CARD — Sidebar báo cáo phân tích
// ═══════════════════════════════════════════════════════════
function ResearchPdfCard({ article }: { article: MockArticle }) {
  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.06] last:border-b-0">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
        <FileText className="w-5 h-5 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/khac/tin-tuc/${article.slug}`}
          className="text-[13px] font-semibold text-slate-200 leading-snug hover:text-blue-400 transition-colors line-clamp-2 block"
        >
          {article.title}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-bold text-slate-500">{article.authorName}</span>
          <span className="text-[9px] text-slate-600">·</span>
          <span className="text-[9px] text-slate-500">{timeAgo(article.publishedAt)}</span>
        </div>
        {article.pdfUrl && (
          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="w-3 h-3" />
            Tải PDF
          </a>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT — Grid 7:3 CafeF Style
// ═══════════════════════════════════════════════════════════
export function NewsListClient() {
  const [activeCategory, setActiveCategory] = useState<string>("tat-ca");

  const publishedArticles = useMemo(
    () => mockArticles.filter((a) => a.status === "PUBLISHED"),
    []
  );

  const filtered = useMemo(() => {
    if (activeCategory === "tat-ca") return publishedArticles;
    return publishedArticles.filter((a) => a.categorySlug === activeCategory);
  }, [activeCategory, publishedArticles]);

  const researchArticles = useMemo(
    () => publishedArticles.filter((a) => a.pdfUrl),
    [publishedArticles]
  );

  const hero = filtered[0];
  const restArticles = filtered.slice(1);

  const dateStr = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Tin tức Tài chính
          </h1>
          <p className="text-sm text-slate-500 mt-1">Cập nhật liên tục · AI tổng hợp &amp; phân tích</p>
        </div>
        <div className="text-right text-[13px] text-slate-500 hidden md:block">{dateStr}</div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-5 scrollbar-hide border-b border-white/[0.06]">
        <TabButton active={activeCategory === "tat-ca"} onClick={() => setActiveCategory("tat-ca")}>
          Tất cả
        </TabButton>
        {mockCategories.map((cat) => (
          <TabButton key={cat.id} active={activeCategory === cat.slug} onClick={() => setActiveCategory(cat.slug)}>
            {cat.name}
          </TabButton>
        ))}
      </div>

      {/* ── Main Grid 7:3 ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">Chưa có bài viết nào trong mục này</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8">
          {/* Cột chính (70%) */}
          <div className="lg:col-span-7">
            {hero && <HeroCard article={hero} />}
            <div>
              {restArticles.map((article) => (
                <ArticleRow key={article.id} article={article} />
              ))}
            </div>
          </div>

          {/* Cột Sidebar (30%) */}
          <div className="lg:col-span-3">
            {researchArticles.length > 0 && (
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-bold text-white">Báo cáo Phân Tích Mới Nhất</h3>
                </div>
                <div>
                  {researchArticles.slice(0, 5).map((article) => (
                    <ResearchPdfCard key={article.id} article={article} />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
              <h3 className="text-sm font-bold text-white mb-3">📈 Đọc nhiều nhất</h3>
              <div className="space-y-3">
                {publishedArticles.slice(0, 5).map((article, idx) => (
                  <Link key={article.id} href={`/khac/tin-tuc/${article.slug}`} className="flex gap-3 group">
                    <span className={`text-2xl font-black w-8 text-center flex-shrink-0 ${
                      idx === 0 ? "text-red-400" : idx === 1 ? "text-orange-400" : idx === 2 ? "text-amber-400" : "text-slate-600"
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-300 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                        {article.title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">{timeAgo(article.publishedAt)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Button ──
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200
        ${
          active
            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
        }
      `}
    >
      {children}
    </button>
  );
}
