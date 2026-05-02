"use client";

import { useState, useMemo, useCallback, useEffect, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { FileText, Loader2, Settings } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { ReversePointIndex, RPISkeleton } from "@/components/dashboard/ReversePointIndex";
import { useSubscription } from "@/hooks/useSubscription";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { getArticleFallbackImage } from "@/lib/articles/image-fallback";

/* ── Types ── */
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

interface MarketOverview {
  score: number;
  max_score: number;
  ta_score?: number;
  valuation_score?: number;
  level: 1 | 2 | 3;
  status_badge: string;
  nav_allocation?: string;
  margin_allowed?: boolean;
  market_breadth: string;
  action_message: string;
  liquidity: number;
  price: number;
}

/* ── Helpers ── */
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
  const isPositive = sentiment === "Tích cực";
  const isNegative = sentiment === "Tiêu cực";
  const color = isPositive ? "#16a34a" : isNegative ? "var(--danger)" : "#f59e0b";
  const bgColor = isPositive ? "rgba(22,163,74,0.10)" : isNegative ? "rgba(192,57,43,0.10)" : "rgba(245,158,11,0.10)";
  const dotColor = isPositive ? "#16a34a" : isNegative ? "var(--danger)" : "#f59e0b";

  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: bgColor, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: dotColor }}
      />
      {sentiment}
    </span>
  );
}

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
      <div
        className={`${fill ? "absolute inset-0" : ""} flex items-center justify-center`}
        style={{ background: "var(--bg-hover)" }}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          ADN Capital
        </span>
      </div>
    );
  }
  return (
    <Image src={resolvedSrc} alt={alt} fill={fill} className={className} sizes={sizes} priority={priority} onError={handleError} />
  );
}

function getScoreLabel(score: number, maxScore: number = 14): string {
  if (maxScore <= 10) {
    if (score < 4) return "NGỦ ĐÔNG";
    if (score <= 7) return "THĂM DÒ";
    return "THIÊN THỜI";
  }
  if (score < 6) return "NGỦ ĐÔNG";
  if (score < 11) return "THĂM DÒ";
  return "THIÊN THỜI";
}

function getScoreColor(score: number, maxScore: number = 14): string {
  if (maxScore <= 10) {
    if (score < 4) return "var(--danger)";
    if (score <= 7) return "#f59e0b";
    return "#16a34a";
  }
  if (score < 6) return "var(--danger)";
  if (score < 11) return "#f59e0b";
  return "#16a34a";
}

const swrFetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(30_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── Market Score Mini Card ── */
const MarketScoreMini = memo(function MarketScoreMini({ overview }: { overview: MarketOverview | null }) {
  if (!overview) {
    return (
      <div
        className="rounded-2xl p-4 animate-pulse"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="h-3 w-32 rounded mb-3" style={{ background: "var(--bg-hover)" }} />
        <div className="h-16 w-full rounded-xl" style={{ background: "var(--bg-hover)" }} />
      </div>
    );
  }
  const score = overview.score;
  const maxScore = overview.max_score;
  const color = getScoreColor(score, maxScore);
  const label = getScoreLabel(score, maxScore);

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p
        className="text-[12px] font-bold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        ADNCore
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black" style={{ color, textShadow: `0 0 16px ${color}40` }}>
            {score}
          </span>
          <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>/ {maxScore}</span>
        </div>
        <div
          className="px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider"
          style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
        >
          {label}
        </div>
      </div>
      <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Điểm tổng hợp trạng thái thị trường.
      </p>
      <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {overview.action_message}
      </p>
    </div>
  );
});

/* ── Article Row ── */
function ArticleRow({ article }: { article: Article }) {
  const categoryName = article.category?.name ?? "";
  return (
    <Link
      href={`/khac/tin-tuc/${article.slug}`}
      className="group flex gap-3.5 py-3.5 last:border-b-0 rounded-lg -mx-1 px-1 transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="relative w-[100px] h-[72px] md:w-[120px] md:h-[80px] flex-shrink-0 rounded-xl overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl ?? ""}
          fallbackSrc={getArticleFallbackImage(article)}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="120px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--accent-fa)" }}
          >
            {categoryName}
          </span>
          {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
        </div>
        <h3
          className="text-[15px] md:text-sm font-bold leading-snug line-clamp-2 transition-colors"
          style={{ color: "var(--text-primary)" }}
        >
          {article.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          {article.sourceUrl && (() => {
            try {
              const host = new URL(article.sourceUrl!).hostname.replace("www.", "");
              return <><span>{host}</span><span>·</span></>;
            } catch { return null; }
          })()}
          <span>{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
        </div>
      </div>
    </Link>
  );
}

/* ── Hero Card ── */
function HeroCard({ article }: { article: Article }) {
  const authorName = article.author?.name ?? "ADN Capital";
  const categoryName = article.category?.name ?? "";
  return (
    <Link href={`/khac/tin-tuc/${article.slug}`} className="group block mb-4">
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
        <ImgWithFallback
          src={article.imageUrl ?? ""} fallbackSrc={getArticleFallbackImage(article)} alt={article.title} fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 65vw" priority
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 55%, transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[12px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
              style={{ background: "var(--primary)", color: "#EBE2CF" }}
            >
              {categoryName}
            </span>
            {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
          </div>
          <h2
            className="text-xl md:text-2xl font-extrabold leading-tight mb-2 line-clamp-3"
            style={{ color: "#EBE2CF", textShadow: "0 2px 8px rgba(0,0,0,0.40)" }}
          >
            {article.title}
          </h2>
          {article.aiSummary && (
            <p
              className="text-sm leading-relaxed line-clamp-2 mb-2 hidden md:block"
              style={{ color: "rgba(235,226,207,0.70)" }}
            >
              {article.aiSummary}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "rgba(235,226,207,0.50)" }}>
            <span>{authorName}</span>
            <span>·</span>
            <span>{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Tab Button ── */
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
      style={
        active
          ? { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border-strong)" }
          : { color: "var(--text-muted)", background: "transparent", border: "1px solid transparent" }
      }
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  MAIN PAGE — TIN TỨC
 * ══════════════════════════════════════════════════════════════════════ */
export default function TinTucPage() {
  const { isWriter } = useCurrentDbUser();
  const { isVip } = useSubscription();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── News data ── */
  const [activeCategory, setActiveCategory] = useState<string>("tat-ca");
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/articles?status=PUBLISHED&limit=50").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
      .then(([artRes, catRes]) => {
        setArticles(artRes.articles ?? []);
        setCategories(catRes.categories ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ── Market overview ── */
  const { data: overview } = useSWR<MarketOverview>("/api/market-overview", swrFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (activeCategory === "tat-ca") return articles;
    return articles.filter((a) => a.category?.slug === activeCategory);
  }, [activeCategory, articles]);

  const hero = filtered[0];
  const restArticles = filtered.slice(1);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1
              className="text-2xl md:text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Tin Tức
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Chỉ báo thị trường · Tin tức AI tổng hợp
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isWriter && (
              <Link
                href="/khac/tin-tuc/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <Settings className="w-3.5 h-3.5" />
                Quản lý bài viết
              </Link>
            )}
          </div>
        </div>

        {/* ── Main Grid: Left (indicators) | Right (news) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">

          {/* LEFT COLUMN — TEI + Market Score */}
          <div className="lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1">
            <LockOverlay isLocked={!isVip} message="Nâng cấp VIP để xem Chỉ báo TEI">
              {!mounted ? <RPISkeleton /> : <ReversePointIndex />}
            </LockOverlay>

            <LockOverlay isLocked={!isVip} message="Nâng cấp VIP để xem Market Score">
              <MarketScoreMini overview={overview ?? null} />
            </LockOverlay>
          </div>

          {/* RIGHT COLUMN — News */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            {/* Category Tabs */}
            <div
              className="flex items-center gap-1 overflow-x-auto pb-3 mb-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <TabButton active={activeCategory === "tat-ca"} onClick={() => setActiveCategory("tat-ca")}>
                Tất cả
              </TabButton>
              {categories.map((cat) => (
                <TabButton
                  key={cat.id}
                  active={activeCategory === cat.slug}
                  onClick={() => setActiveCategory(cat.slug)}
                >
                  {cat.name}
                </TabButton>
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
              </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ color: "var(--text-secondary)" }}
              >
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Chưa có bài viết nào.</p>
              </div>
            )}

            {/* Content */}
            {!loading && hero && (
              <>
                <HeroCard article={hero} />
                <div className="space-y-0">
                  {restArticles.map((a) => (
                    <ArticleRow key={a.id} article={a} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
