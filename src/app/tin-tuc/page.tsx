"use client";

import { useState, useMemo, useCallback, useEffect, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { FileText, Loader2, Settings, TrendingUp, ChevronDown, RefreshCw, Bot } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { ReversePointIndex, RPISkeleton } from "@/components/dashboard/ReversePointIndex";
import { useSubscription } from "@/hooks/useSubscription";
import { LockOverlay } from "@/components/ui/LockOverlay";

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
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    "Tích cực": { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
    "Tiêu cực": { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
    "Trung tính": { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  };
  const s = map[sentiment] ?? map["Trung tính"];
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {sentiment}
    </span>
  );
}

function ImgWithFallback({ src, alt, fill, className, sizes, priority }: {
  src: string; alt: string; fill?: boolean; className?: string; sizes?: string; priority?: boolean;
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
    <Image src={src} alt={alt} fill={fill} className={className} sizes={sizes} priority={priority} onError={handleError} />
  );
}

function fmtLiquidity(tyVnd: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(tyVnd));
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
    if (score < 4) return "#ef4444";
    if (score <= 7) return "#f97316";
    return "#a855f7";
  }
  if (score < 6) return "#ef4444";
  if (score < 11) return "#f97316";
  return "#a855f7";
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
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 animate-pulse">
        <div className="h-3 w-32 bg-neutral-800 rounded mb-3" />
        <div className="h-16 w-full bg-neutral-800/50 rounded-xl" />
      </div>
    );
  }
  const score = overview.score;
  const maxScore = overview.max_score;
  const color = getScoreColor(score, maxScore);
  const label = getScoreLabel(score, maxScore);
  const liquidity = overview.liquidity;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 hover:border-neutral-700 transition-all">
      <p className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
        ADN Composite Score
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black" style={{ color, textShadow: `0 0 16px ${color}40` }}>
            {score}
          </span>
          <span className="text-[11px] font-bold text-neutral-400">/ {maxScore}</span>
        </div>
        <div
          className="px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider"
          style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
        >
          {label}
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-[12px] text-neutral-500">
        {overview.ta_score != null && <span>TA: <span className="text-neutral-300 font-bold">{overview.ta_score}/10</span></span>}
        {overview.valuation_score != null && <span>Định giá: <span className="text-neutral-300 font-bold">{overview.valuation_score}/4</span></span>}
        <span>Thanh khoản: <span className="text-neutral-300 font-bold">{fmtLiquidity(liquidity)} Tỷ</span></span>
      </div>
      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{overview.action_message}</p>
    </div>
  );
});

/* ── Article Row ── */
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
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">{categoryName}</span>
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
          src={article.imageUrl ?? ""} alt={article.title} fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 65vw" priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-bold text-white/90 bg-blue-500/80 px-2 py-0.5 rounded uppercase tracking-wider">
              {categoryName}
            </span>
            {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
            <span className="text-[12px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">AI</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight mb-2 group-hover:text-blue-300 transition-colors line-clamp-3 drop-shadow-lg">
            {article.title}
          </h2>
          {article.aiSummary && (
            <p className="text-sm text-white/70 leading-relaxed line-clamp-2 mb-2 hidden md:block">
              {article.aiSummary}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-white/50">
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
      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
        active
          ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
          : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  MAIN PAGE — TIN TỨC
 *  Left: TEI + Market Score | Right: News
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
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Tin Tức
            </h1>
            <p className="text-sm text-slate-500 mt-1">Chỉ báo thị trường · Tin tức AI tổng hợp</p>
          </div>
          <div className="flex items-center gap-3">
            {isWriter && (
              <Link
                href="/khac/tin-tuc/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors text-xs font-medium"
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
            {/* TEI */}
            <LockOverlay isLocked={!isVip} message="Nâng cấp VIP để xem Chỉ báo TEI">
              {!mounted ? <RPISkeleton /> : <ReversePointIndex />}
            </LockOverlay>

            {/* Market Score Mini */}
            <LockOverlay isLocked={!isVip} message="Nâng cấp VIP để xem Market Score">
              <MarketScoreMini overview={overview ?? null} />
            </LockOverlay>
          </div>

          {/* RIGHT COLUMN — News */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-4 scrollbar-hide border-b border-white/[0.06]">
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
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            )}

            {/* Content */}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm">Chưa có bài viết nào.</p>
              </div>
            )}

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
