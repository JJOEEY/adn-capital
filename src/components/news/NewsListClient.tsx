"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { FileText, Loader2, Settings } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

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
interface Category {
  id: string;
  name: string;
  slug: string;
}

interface NewsListClientProps {
  initialArticles?: Article[];
  initialCategories?: Category[];
}

// ── Image with Fallback ── renders gradient placeholder on error
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
  const [hasError, setHasError] = useState(false);
  const handleError = useCallback(() => setHasError(true), []);

  if (hasError || !src) {
    return (
      <div className={`${fill ? "absolute inset-0" : ""} bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center`}>
        <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">ADN Capital</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
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
    "Tích cực": { bg: "rgba(16,185,129,0.15)", text: "#10b981", dot: "#10b981" },
    "Tiêu cực": { bg: "rgba(239,68,68,0.15)", text: "#ef4444", dot: "#ef4444" },
    "Trung tính": { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
  };
  const s = map[sentiment] ?? map["Trung tính"];
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {sentiment}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
//  HERO CARD — Bài nổi bật trên cùng cột chính
// ═══════════════════════════════════════════════════════════
function HeroCard({ article }: { article: Article }) {
  const authorName = article.author?.name ?? "ADN Capital";
  const categoryName = article.category?.name ?? "";
  return (
    <Link href={`/khac/tin-tuc/${article.slug}`} className="group block mb-5">
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl ?? ""}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 65vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-bold px-2 py-0.5 rounded uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.90)", background: "rgba(59,130,246,0.80)" }}>
              {categoryName}
            </span>
            {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#10b981", background: "rgba(16,185,129,0.20)" }}>AI</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold leading-tight mb-2 group-hover:text-blue-300 transition-colors line-clamp-3 drop-shadow-lg" style={{ color: "#fff" }}>
            {article.title}
          </h2>
          {article.aiSummary && (
            <p className="text-sm leading-relaxed line-clamp-2 mb-2 hidden md:block" style={{ color: "rgba(255,255,255,0.70)" }}>
              {article.aiSummary}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>
            <span>{authorName}</span>
            <span>·</span>
            <span>{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════
//  ARTICLE ROW — Thumbnail trái, nội dung phải
// ═══════════════════════════════════════════════════════════
function ArticleRow({ article }: { article: Article }) {
  const categoryName = article.category?.name ?? "";
  return (
    <Link
      href={`/khac/tin-tuc/${article.slug}`}
      className="group flex gap-3.5 py-3.5 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors rounded-lg -mx-1 px-1"
    >
      <div className="relative w-[100px] h-[72px] md:w-[120px] md:h-[80px] flex-shrink-0 rounded-xl overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl ?? ""}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="120px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#60a5fa" }}>{categoryName}</span>
          {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
        </div>
        <h3 className="text-[15px] md:text-sm font-bold text-slate-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-[12px] text-slate-500">
          {article.sourceUrl && (
            <>
              <span>{new URL(article.sourceUrl).hostname.replace("www.", "")}</span>
              <span>·</span>
            </>
          )}
          <span>{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
          {article.tags.slice(0, 2).map((tag) => (
            <span key={tag} style={{ color: "rgba(96,165,250,0.50)" }}>#{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════
//  RESEARCH PDF CARD — Sidebar báo cáo phân tích
// ═══════════════════════════════════════════════════════════
function ResearchPdfCard({ article }: { article: Article }) {
  const authorName = article.author?.name ?? "ADN Capital";
  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.06] last:border-b-0">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
        <FileText className="w-5 h-5" style={{ color: "#ef4444" }} />
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/khac/tin-tuc/${article.slug}`}
          className="text-[15px] font-semibold text-slate-200 leading-snug hover:text-blue-400 transition-colors line-clamp-2 block"
        >
          {article.title}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] font-bold text-slate-500">{authorName}</span>
          <span className="text-[11px] text-slate-600">·</span>
          <span className="text-[11px] text-slate-500">{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
        </div>
        {article.pdfUrl && (
          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-bold hover:text-red-300 transition-colors"
            style={{ color: "#ef4444" }}
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
export function NewsListClient({
  initialArticles = [],
  initialCategories = [],
}: NewsListClientProps) {
  const [activeCategory, setActiveCategory] = useState<string>("tat-ca");
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(initialArticles.length === 0);
  const { isWriter } = useCurrentDbUser();

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/articles?status=PUBLISHED&limit=50").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
      .then(([artRes, catRes]) => {
        if (!active) return;
        setArticles(artRes.articles ?? []);
        setCategories(catRes.categories ?? []);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === "tat-ca") return articles;
    return articles.filter((a) => a.category?.slug === activeCategory);
  }, [activeCategory, articles]);

  const researchArticles = useMemo(
    () => articles.filter((a) => a.pdfUrl),
    [articles]
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
    <MainLayout>
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Tin tức Tài chính
          </h1>
          <p className="text-sm text-slate-500 mt-1">Cập nhật liên tục · AI tổng hợp &amp; phân tích</p>
        </div>
        <div className="flex items-center gap-3">
          {isWriter && (
            <Link
              href="/khac/tin-tuc/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium"
              style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", borderColor: "rgba(59,130,246,0.25)" }}
            >
              <Settings className="w-3.5 h-3.5" />
              Quản lý bài viết
            </Link>
          )}
          <div className="text-right text-[15px] text-slate-500 hidden md:block">{dateStr}</div>
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-5 scrollbar-hide border-b border-white/[0.06]">
        <TabButton active={activeCategory === "tat-ca"} onClick={() => setActiveCategory("tat-ca")}>
          Tất cả
        </TabButton>
        {categories.map((cat) => (
          <TabButton key={cat.id} active={activeCategory === cat.slug} onClick={() => setActiveCategory(cat.slug)}>
            {cat.name}
          </TabButton>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#60a5fa" }} />
        </div>
      ) : filtered.length === 0 ? (
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
              <div className="rounded-2xl border p-4 mb-5" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" style={{ color: "#ef4444" }} />
                  <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Báo cáo Phân Tích Mới Nhất</h3>
                </div>
                <div>
                  {researchArticles.slice(0, 5).map((article) => (
                    <ResearchPdfCard key={article.id} article={article} />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>📈 Đọc nhiều nhất</h3>
              <div className="space-y-3">
                {articles.slice(0, 5).map((article, idx) => (
                  <Link key={article.id} href={`/khac/tin-tuc/${article.slug}`} className="flex gap-3 group">
                    <span className="text-2xl font-black w-8 text-center flex-shrink-0" style={{
                      color: idx === 0 ? "#ef4444" : idx === 1 ? "#f97316" : idx === 2 ? "#f59e0b" : "var(--text-muted)"
                    }}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-slate-300 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                        {article.title}
                      </p>
                      <p className="text-[12px] text-slate-500 mt-1">{article.publishedAt ? timeAgo(article.publishedAt) : ""}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </MainLayout>
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
        whitespace-nowrap px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-all duration-200
        ${
          active
            ? ""
            : "hover:bg-white/5 border border-transparent"
        }
      `}
      style={active ? { background: "rgba(59,130,246,0.20)", color: "#60a5fa", borderColor: "rgba(59,130,246,0.30)" } : { color: "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}
