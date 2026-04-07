"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { mockArticles, mockCategories, type MockArticle } from "@/lib/mock-articles";

// ── Helpers ──
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Khoảng ${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Khoảng ${hours} giờ trước`;
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
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {sentiment}
    </span>
  );
}

function SourceBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
      AI
    </span>
  );
}

// ── Featured Article (lớn bên trái) ──
function FeaturedCard({ article }: { article: MockArticle }) {
  return (
    <Link href={`/khac/tin-tuc/${article.slug}`} className="group block">
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-3">
        <Image
          src={article.imageUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Badges on image */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <SourceBadge tag="AI" />
          <span className="text-[11px] font-medium text-slate-300 bg-black/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
            {article.categoryName}
          </span>
        </div>
      </div>
      <h2 className="text-lg md:text-xl font-bold text-white leading-snug mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
        {article.title}
      </h2>
      <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 mb-2">{article.excerpt}</p>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <SentimentBadge sentiment={article.sentiment} />
        <span>{article.sourceUrl ? new URL(article.sourceUrl).hostname : "ADN Capital"}</span>
        <span>·</span>
        <span>{timeAgo(article.publishedAt)}</span>
      </div>
    </Link>
  );
}

// ── Article Row (nhỏ bên phải) ──
function ArticleRow({ article }: { article: MockArticle }) {
  return (
    <Link
      href={`/khac/tin-tuc/${article.slug}`}
      className="group flex gap-3 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg"
    >
      <div className="relative w-24 h-16 md:w-28 md:h-[72px] flex-shrink-0 rounded-lg overflow-hidden">
        <Image
          src={article.imageUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="112px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SourceBadge tag="AI" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {article.categoryName}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-slate-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
          <SentimentBadge sentiment={article.sentiment} />
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

// ── Small Card (Tin tức Trong nước bên phải) ──
function SmallCard({ article }: { article: MockArticle }) {
  return (
    <Link href={`/khac/tin-tuc/${article.slug}`} className="group block py-3 border-b border-white/5 last:border-b-0">
      <div className="flex gap-3">
        <div className="relative w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden">
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="80px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              {article.tags[0]}
            </span>
            {article.sourceUrl && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-[10px] text-slate-500">{new URL(article.sourceUrl).hostname}</span>
              </>
            )}
          </div>
          <h4 className="text-[13px] font-semibold text-slate-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
            {article.title}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{article.excerpt}</p>
          <div className="flex items-center gap-2 mt-1">
            <SentimentBadge sentiment={article.sentiment} />
            {article.tags.slice(1, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-blue-400/70">#{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ═════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export function NewsListClient() {
  const [activeCategory, setActiveCategory] = useState<string>("tat-ca");

  const filtered = useMemo(() => {
    if (activeCategory === "tat-ca") return mockArticles;
    return mockArticles.filter((a) => a.categorySlug === activeCategory);
  }, [activeCategory]);

  // Split: international (Quốc tế category) vs domestic (rest)
  const international = useMemo(
    () => filtered.filter((a) => a.categorySlug === "quoc-te"),
    [filtered]
  );
  const domestic = useMemo(
    () => filtered.filter((a) => a.categorySlug !== "quoc-te"),
    [filtered]
  );

  // For "Tất cả" tab, show mixed split. For specific tab, show all in left column
  const isAllTab = activeCategory === "tat-ca";
  const leftArticles = isAllTab ? international : filtered;
  const rightArticles = isAllTab ? domestic : [];

  const featured = leftArticles[0];
  const restLeft = leftArticles.slice(1);

  // Current date
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Tin tức Tài chính
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cập nhật liên tục tin tức thị trường trong nước và quốc tế
          </p>
        </div>
        <div className="text-right text-sm text-slate-500 hidden md:block">
          {dateStr}
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-6 scrollbar-hide border-b border-white/5">
        <TabButton
          active={activeCategory === "tat-ca"}
          onClick={() => setActiveCategory("tat-ca")}
        >
          Tất cả
        </TabButton>
        {mockCategories.map((cat) => (
          <TabButton
            key={cat.id}
            active={activeCategory === cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
          >
            {cat.name}
          </TabButton>
        ))}
      </div>

      {/* ── Main Content Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">Chưa có bài viết nào trong mục này</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* ── Left Column: Quốc tế / Main ── */}
          <div className="lg:col-span-7">
            {isAllTab && international.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-bold text-white">★ Tài chính Quốc tế</span>
                <span className="text-[11px] text-slate-500">({international.length})</span>
              </div>
            )}

            {/* Featured */}
            {featured && <FeaturedCard article={featured} />}

            {/* Rest as rows */}
            <div className="mt-4">
              {restLeft.map((article) => (
                <ArticleRow key={article.id} article={article} />
              ))}
            </div>
          </div>

          {/* ── Right Column: Domestic / Related ── */}
          {isAllTab && rightArticles.length > 0 && (
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-bold text-white">★ Thị trường Trong nước</span>
                <span className="text-[11px] text-slate-500">({rightArticles.length})</span>
              </div>
              <div className="bg-white/[0.02] rounded-xl border border-white/5 p-3">
                {rightArticles.slice(0, 10).map((article) => (
                  <SmallCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          )}
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
        whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
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
