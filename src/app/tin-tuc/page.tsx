"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import {
  Crown,
  FileText,
  GaugeCircle,
  Hash,
  Loader2,
  Newspaper,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useTopic } from "@/hooks/useTopic";
import { calculateRPI, getLatestRPI, type OHLCVData } from "@/lib/rpi/calculator";
import { getArticleFallbackImage } from "@/lib/articles/image-fallback";

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
  level: 1 | 2 | 3;
  status_badge: string;
  market_breadth: string;
  action_message: string;
  liquidity: number;
  price: number;
  last_updated?: string;
}

type SentimentKey = "all" | "positive" | "neutral" | "negative";

const sentimentOptions: Array<{ key: SentimentKey; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "positive", label: "Tích cực" },
  { key: "neutral", label: "Trung tính" },
  { key: "negative", label: "Tiêu cực" },
];

const swrFetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(30_000) }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });

function stripVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const timestamp = new Date(dateStr).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diff = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa cập nhật";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function getArticleTags(article: Article): string[] {
  return Array.isArray(article.tags)
    ? article.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
}

function tagKey(tag: string) {
  return stripVietnamese(tag).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getHost(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function normalizeSentiment(value: string | null): SentimentKey {
  const normalized = stripVietnamese(value ?? "");
  if (normalized.includes("tich") || normalized.includes("positive")) return "positive";
  if (normalized.includes("tieu") || normalized.includes("negative")) return "negative";
  if (normalized.includes("trung") || normalized.includes("neutral")) return "neutral";
  return "neutral";
}

function sentimentMeta(sentiment: string | null) {
  const key = normalizeSentiment(sentiment);
  if (key === "positive") {
    return {
      key,
      label: "Tích cực",
      color: "#16a34a",
      bg: "rgba(22,163,74,0.12)",
      border: "rgba(22,163,74,0.24)",
    };
  }
  if (key === "negative") {
    return {
      key,
      label: "Tiêu cực",
      color: "var(--danger)",
      bg: "rgba(192,57,43,0.12)",
      border: "rgba(192,57,43,0.24)",
    };
  }
  return {
    key,
    label: "Trung tính",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.24)",
  };
}

function classifyART(value: number) {
  if (value < 1) return { label: "An toàn cao", tone: "Tích lũy sâu", color: "#22c55e" };
  if (value < 2.5) return { label: "An toàn", tone: "Cơ hội chọn lọc", color: "#16a34a" };
  if (value < 4) return { label: "Trung tính", tone: "Theo dõi thêm", color: "#f59e0b" };
  if (value < 4.8) return { label: "Rủi ro", tone: "Cần thận trọng", color: "#f97316" };
  return { label: "Hưng phấn cao", tone: "Ưu tiên quản trị rủi ro", color: "var(--danger)" };
}

function classifyADNCore(value: number, max: number) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio < 0.4) return { label: "Phòng thủ", tone: "Ưu tiên quan sát", color: "var(--danger)" };
  if (ratio < 0.72) return { label: "Thăm dò", tone: "Giải ngân chọn lọc", color: "#f59e0b" };
  return { label: "Thuận lợi", tone: "Điều kiện tích cực", color: "#16a34a" };
}

function ImgWithFallback({
  src,
  fallbackSrc,
  alt,
  fill,
  className,
  sizes,
  priority,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
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
    setFailedSrcs((current) => (current.includes(resolvedSrc) ? current : [...current, resolvedSrc]));
  }, [resolvedSrc]);

  if (!resolvedSrc) {
    return (
      <div
        className={`${fill ? "absolute inset-0" : ""} flex items-center justify-center`}
        style={{ background: "var(--surface-2)" }}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          ADN Capital
        </span>
      </div>
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      onError={handleError}
    />
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  const meta = sentimentMeta(sentiment);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function TagList({ tags, limit = 3, spread = false }: { tags: string[]; limit?: number; spread?: boolean }) {
  if (!tags.length) return null;
  return (
    <div
      className={
        spread
          ? "mt-2 grid w-full grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))]"
          : "mt-2 flex flex-wrap gap-1.5"
      }
    >
      {tags.slice(0, limit).map((tag) => (
        <span
          key={tag}
          className={
            spread
              ? "inline-flex min-w-0 items-center justify-center truncate rounded-full px-2 py-1 text-[11px] font-medium"
              : "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          }
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          #{tag.replace(/^#/, "")}
        </span>
      ))}
    </div>
  );
}

function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border backdrop-blur-xl ${className}`}
      style={{
        background:
          "linear-gradient(145deg, color-mix(in srgb, var(--surface) 92%, transparent), color-mix(in srgb, var(--surface-2) 84%, transparent))",
        borderColor: "var(--border)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.10)",
      }}
    >
      {children}
    </section>
  );
}

function GaugeSvg({
  value,
  max,
  mode,
}: {
  value: number;
  max: number;
  mode: "art" | "core";
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const cx = 150;
  const cy = 138;
  const r = 108;
  const strokeW = 18;
  const segments = 52;
  const colorStops =
    mode === "art"
      ? ["#16a34a", "#22c55e", "#eab308", "#f97316", "#ef4444"]
      : ["#ef4444", "#f97316", "#eab308", "#20c997", "#16a34a"];

  const mixColor = (index: number) => colorStops[Math.min(colorStops.length - 1, Math.floor(index / (segments / colorStops.length)))];
  const angle = Math.PI - (clamped / max) * Math.PI;
  const needleLen = r - 30;
  const needleX = cx + needleLen * Math.cos(angle);
  const needleY = cy - needleLen * Math.sin(angle);
  const tickValues = mode === "art" ? [0, 1, 2, 3, 4, 5] : [0, Math.round(max / 2), max];

  return (
    <svg viewBox="0 0 300 172" className="mx-auto w-full max-w-[240px]" role="img" aria-label="Đồng hồ chỉ báo">
      {Array.from({ length: segments }).map((_, index) => {
        const startFrac = index / segments;
        const endFrac = (index + 0.82) / segments;
        const startAngle = Math.PI - startFrac * Math.PI;
        const endAngle = Math.PI - endFrac * Math.PI;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy - r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy - r * Math.sin(endAngle);
        return (
          <path
            key={index}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`}
            fill="none"
            stroke={mixColor(index)}
            strokeLinecap="round"
            strokeWidth={strokeW}
          />
        );
      })}

      {tickValues.map((tick) => {
        const tickAngle = Math.PI - (tick / max) * Math.PI;
        const x = cx + (r + 22) * Math.cos(tickAngle);
        const y = cy - (r + 22) * Math.sin(tickAngle);
        return (
          <text
            key={tick}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--text-muted)"
            fontSize="12"
            fontWeight="700"
          >
            {tick}
          </text>
        );
      })}

      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="8" fill="var(--text-primary)" />
      <circle cx={cx} cy={cy} r="3" fill="var(--surface)" />
    </svg>
  );
}

function ARTGaugeCard() {
  const historicalTopic = useTopic<{ data?: Array<Record<string, unknown>> }>("vn:historical:VN30:1d", {
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    staleWhileRevalidate: true,
  });

  const ohlcvData: OHLCVData[] = useMemo(() => {
    const rows = historicalTopic.data?.data ?? [];
    return rows
      .map((row) => ({
        date: String(row.timestamp ?? row.date ?? "").split(" ")[0],
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }))
      .filter((row) => row.date && [row.open, row.high, row.low, row.close, row.volume].every(Number.isFinite));
  }, [historicalTopic.data]);

  const rpiResults = useMemo(() => (ohlcvData.length >= 30 ? calculateRPI(ohlcvData) : []), [ohlcvData]);
  const latest = useMemo(() => getLatestRPI(rpiResults), [rpiResults]);
  const value = latest?.rpi ?? 0;
  const ma7 = latest?.ma7 ?? 0;
  const classification = classifyART(value);
  const monthPoints = rpiResults.filter((row) => row.rpi !== null).slice(-22);
  const updatedAt = latest?.date ? timeAgo(latest.date) : "";

  return (
    <GlassPanel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            ADN ART
          </p>
          <h2 className="mt-1 text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
            Đồng hồ đảo chiều thị trường
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Theo dõi trạng thái hưng phấn và cạn kiệt của rổ VN30 trong 1 tháng gần nhất.
          </p>
        </div>
        <GaugeCircle className="h-5 w-5 shrink-0" style={{ color: classification.color }} />
      </div>

      <div className="mt-5">
        <GaugeSvg value={value} max={5} mode="art" />
      </div>

      <div className="mt-2 text-center">
        <div className="text-3xl font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatNumber(value, 2)}
          <span className="ml-1 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            /5
          </span>
        </div>
        <div
          className="mx-auto mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold"
          style={{ color: classification.color, borderColor: `${classification.color}55`, background: `${classification.color}14` }}
        >
          {classification.label}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          {classification.tone}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <MetricMini label="ADN ART MA7" value={ma7 ? formatNumber(ma7, 2) : "-"} />
        <MetricMini label="Lịch sử" value={`${monthPoints.length || 0} phiên`} />
      </div>

      <p className="mt-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {updatedAt ? `Cập nhật ${updatedAt}` : "Đang cập nhật lịch sử 1 tháng."}
      </p>
    </GlassPanel>
  );
}

function ADNCoreGaugeCard({ overview }: { overview: MarketOverview | null }) {
  const score = overview?.score ?? 0;
  const maxScore = overview?.max_score ?? 14;
  const classification = classifyADNCore(score, maxScore);

  return (
    <GlassPanel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            ADNCore
          </p>
          <h2 className="mt-1 text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
            Chấm điểm thị trường
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Tổng hợp xu hướng, độ rộng và chất lượng vận động của thị trường.
          </p>
        </div>
        <TrendingUp className="h-5 w-5 shrink-0" style={{ color: classification.color }} />
      </div>

      <div className="mt-5">
        <GaugeSvg value={score} max={maxScore} mode="core" />
      </div>

      <div className="mt-2 text-center">
        <div className="text-3xl font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatNumber(score, 0)}
          <span className="ml-1 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            /{maxScore}
          </span>
        </div>
        <div
          className="mx-auto mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold"
          style={{ color: classification.color, borderColor: `${classification.color}55`, background: `${classification.color}14` }}
        >
          {classification.label}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          {classification.tone}
        </p>
      </div>

      <div className="mt-5 space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <p>{overview?.action_message ?? "Hệ thống đang cập nhật nhịp thị trường mới nhất."}</p>
      </div>
    </GlassPanel>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition"
      style={
        active
          ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
          : { background: "var(--surface)", color: "var(--text-secondary)", borderColor: "var(--border)" }
      }
    >
      {children}
    </button>
  );
}

function HeroCard({ article }: { article: Article }) {
  const tags = getArticleTags(article);
  return (
    <Link href={`/tin-tuc/${article.slug}`} className="group block">
      <article className="relative min-h-[360px] overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
        <ImgWithFallback
          src={article.imageUrl ?? ""}
          fallbackSrc={getArticleFallbackImage(article)}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 1024px) 100vw, 58vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {article.category?.name && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
                {article.category.name}
              </span>
            )}
            <SentimentBadge sentiment={article.sentiment} />
          </div>
          <h2 className="max-w-4xl text-2xl font-black leading-tight text-white sm:text-3xl">{article.title}</h2>
          {(article.aiSummary || article.excerpt) && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/78 line-clamp-2">
              {article.aiSummary ?? article.excerpt}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/62">
            <span>{article.author?.name ?? "ADN Capital"}</span>
            {getHost(article.sourceUrl) && (
              <>
                <span>·</span>
                <span>{getHost(article.sourceUrl)}</span>
              </>
            )}
            <span>·</span>
            <span>{timeAgo(article.publishedAt)}</span>
          </div>
          <TagList tags={tags} />
        </div>
      </article>
    </Link>
  );
}

function TopStories({ articles }: { articles: Article[] }) {
  return (
    <GlassPanel className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "var(--accent-fa)" }} />
        <h2 className="text-base font-extrabold" style={{ color: "var(--text-primary)" }}>
          Top 5 bài nổi bật
        </h2>
      </div>
      <div className="space-y-3">
        {articles.slice(0, 5).map((article, index) => (
          <Link key={article.id} href={`/tin-tuc/${article.slug}`} className="group flex gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
              style={{ background: "var(--surface-2)", color: index === 0 ? "var(--accent-fa)" : "var(--text-secondary)" }}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold leading-snug group-hover:underline" style={{ color: "var(--text-primary)" }}>
                {article.title}
              </h3>
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                {timeAgo(article.publishedAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </GlassPanel>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const tags = getArticleTags(article);
  return (
    <Link
      href={`/tin-tuc/${article.slug}`}
      className="group flex gap-4 rounded-2xl border p-3 transition hover:-translate-y-0.5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="relative h-[92px] w-[128px] shrink-0 overflow-hidden rounded-xl sm:h-[112px] sm:w-[168px]">
        <ImgWithFallback
          src={article.imageUrl ?? ""}
          fallbackSrc={getArticleFallbackImage(article)}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="168px"
        />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {article.category?.name && (
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--accent-fa)" }}>
              {article.category.name}
            </span>
          )}
          <SentimentBadge sentiment={article.sentiment} />
        </div>
        <h3 className="line-clamp-2 text-base font-extrabold leading-snug group-hover:underline" style={{ color: "var(--text-primary)" }}>
          {article.title}
        </h3>
        {(article.aiSummary || article.excerpt) && (
          <p className="mt-2 hidden text-sm leading-relaxed line-clamp-2 sm:block" style={{ color: "var(--text-secondary)" }}>
            {article.aiSummary ?? article.excerpt}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
          {getHost(article.sourceUrl) && <span>{getHost(article.sourceUrl)}</span>}
          <span>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
        <TagList tags={tags} limit={4} spread />
      </div>
    </Link>
  );
}

function TopicPanel({
  categories,
  categoryCounts,
  topTags,
  activeCategory,
  activeTag,
  onCategory,
  onTag,
}: {
  categories: Category[];
  categoryCounts: Map<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  activeCategory: string;
  activeTag: string;
  onCategory: (slug: string) => void;
  onTag: (key: string) => void;
}) {
  return (
    <GlassPanel className="p-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Newspaper className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h2 className="font-extrabold" style={{ color: "var(--text-primary)" }}>
              Tin theo ngành
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategory(category.slug)}
                className="rounded-full border px-3 py-1.5 text-sm font-semibold transition"
                style={
                  activeCategory === category.slug
                    ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                    : { background: "var(--surface-2)", color: "var(--text-secondary)", borderColor: "var(--border)" }
                }
              >
                {category.name}
                <span className="ml-1 opacity-70">({categoryCounts.get(category.slug) ?? 0})</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Hash className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h2 className="font-extrabold" style={{ color: "var(--text-primary)" }}>
              Hashtag nổi bật
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {topTags.map(({ tag, count }) => {
              const key = tagKey(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTag(key)}
                  className="rounded-full border px-3 py-1.5 text-sm font-semibold transition"
                  style={
                    activeTag === key
                      ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                      : { background: "var(--surface-2)", color: "var(--text-secondary)", borderColor: "var(--border)" }
                  }
                >
                  #{tag.replace(/^#/, "")}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function ReportPanel() {
  return (
    <GlassPanel className="p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          <Crown className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
            Báo cáo chuyên sâu
          </h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Weekly Report và Monthly Report sẽ được gom tại đây cho khách hàng VIP, đồng thời sẵn sàng để hệ thống gửi thông báo khi có báo cáo mới.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Weekly Report", "Monthly Report", "VIP"].map((item) => (
              <span
                key={item}
                className="rounded-full border px-3 py-1 text-xs font-bold"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

export default function TinTucPage() {
  const { isWriter } = useCurrentDbUser();
  const [activeCategory, setActiveCategory] = useState("tat-ca");
  const [activeSentiment, setActiveSentiment] = useState<SentimentKey>("all");
  const [activeTag, setActiveTag] = useState("all");
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: overview } = useSWR<MarketOverview>("/api/market-overview", swrFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/articles?status=PUBLISHED&limit=50").then((response) => response.json()),
      fetch("/api/categories").then((response) => response.json()),
    ])
      .then(([articleResponse, categoryResponse]) => {
        if (cancelled) return;
        setArticles(articleResponse.articles ?? []);
        setCategories(categoryResponse.categories ?? []);
      })
      .catch((error) => {
        console.error("[TinTucPage] Failed to load articles:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      if (!article.category?.slug) continue;
      counts.set(article.category.slug, (counts.get(article.category.slug) ?? 0) + 1);
    }
    return counts;
  }, [articles]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      for (const tag of getArticleTags(article)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [articles]);

  const sentimentCounts = useMemo(() => {
    const counts = new Map<SentimentKey, number>([
      ["positive", 0],
      ["neutral", 0],
      ["negative", 0],
    ]);
    for (const article of articles) {
      const key = normalizeSentiment(article.sentiment);
      if (key !== "all") counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      const matchesCategory = activeCategory === "tat-ca" || article.category?.slug === activeCategory;
      const matchesSentiment = activeSentiment === "all" || normalizeSentiment(article.sentiment) === activeSentiment;
      const matchesTag = activeTag === "all" || getArticleTags(article).some((tag) => tagKey(tag) === activeTag);
      return matchesCategory && matchesSentiment && matchesTag;
    });
  }, [activeCategory, activeSentiment, activeTag, articles]);

  const hero = filtered[0];
  const restArticles = filtered.slice(1);
  const topStories = articles.slice(0, 5);

  return (
    <MainLayout>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              Cập nhật thị trường
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl" style={{ color: "var(--text-primary)" }}>
              Tin tức
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Bản tin thị trường, phân loại cảm xúc và các chủ đề nổi bật được cập nhật liên tục cho nhà đầu tư.
            </p>
          </div>
          {isWriter && (
            <Link
              href="/khac/tin-tuc/admin"
              className="inline-flex w-fit items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition"
              style={{ background: "var(--surface)", color: "var(--primary)", borderColor: "var(--border)" }}
            >
              <Settings className="h-4 w-4" />
              Quản lý bài viết
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px] 2xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <aside className="xl:sticky xl:top-20 xl:self-start">
            <ARTGaugeCard />
          </aside>

          <main className="min-w-0 space-y-6">
            <GlassPanel className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <TabButton active={activeCategory === "tat-ca"} onClick={() => setActiveCategory("tat-ca")}>
                    Tất cả
                  </TabButton>
                  {categories.map((category) => (
                    <TabButton key={category.id} active={activeCategory === category.slug} onClick={() => setActiveCategory(category.slug)}>
                      {category.name}
                    </TabButton>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {sentimentOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setActiveSentiment(option.key)}
                      className="rounded-full border px-3 py-1.5 text-sm font-semibold transition"
                      style={
                        activeSentiment === option.key
                          ? { background: "var(--primary-light)", color: "var(--primary)", borderColor: "var(--border-strong)" }
                          : { background: "transparent", color: "var(--text-secondary)", borderColor: "var(--border)" }
                      }
                    >
                      {option.label}
                      {option.key !== "all" && <span className="ml-1 opacity-70">({sentimentCounts.get(option.key) ?? 0})</span>}
                    </button>
                  ))}

                  {(activeTag !== "all" || activeCategory !== "tat-ca" || activeSentiment !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory("tat-ca");
                        setActiveSentiment("all");
                        setActiveTag("all");
                      }}
                      className="rounded-full border px-3 py-1.5 text-sm font-semibold"
                      style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface-2)" }}
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>
            </GlassPanel>

            {loading && (
              <GlassPanel className="flex min-h-[360px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--primary)" }} />
              </GlassPanel>
            )}

            {!loading && filtered.length === 0 && (
              <GlassPanel className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                <FileText className="mb-3 h-10 w-10 opacity-35" style={{ color: "var(--text-muted)" }} />
                <h2 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                  Chưa có bài viết phù hợp
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Hãy thử bỏ bộ lọc hoặc chọn một nhóm chủ đề khác.
                </p>
              </GlassPanel>
            )}

            {!loading && hero && (
              <>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
                  <HeroCard article={hero} />
                  <TopStories articles={topStories} />
                </div>

                <TopicPanel
                  categories={categories}
                  categoryCounts={categoryCounts}
                  topTags={topTags}
                  activeCategory={activeCategory}
                  activeTag={activeTag}
                  onCategory={(slug) => {
                    setActiveCategory(slug);
                    setActiveTag("all");
                  }}
                  onTag={(key) => {
                    setActiveTag(key);
                    setActiveCategory("tat-ca");
                  }}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
                      Dòng tin mới
                    </h2>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {filtered.length} bài viết
                    </span>
                  </div>
                  {restArticles.map((article) => (
                    <ArticleRow key={article.id} article={article} />
                  ))}
                </div>

                <ReportPanel />
              </>
            )}
          </main>

          <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
            <ADNCoreGaugeCard overview={overview ?? null} />
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
