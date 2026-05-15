"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, Clock, Eye, FileText, RefreshCw, Users } from "lucide-react";

type RangeKey = "24h" | "7d" | "30d" | "90d";

type CmsInsightsPayload = {
  range: string;
  updatedAt: string;
  hasData: boolean;
  summary: {
    totalViews: number;
    uniqueReaders: number;
    articleReads: number;
    avgReadTimeSec: number;
    avgReadTimeLabel: string;
    completionRate: number;
    topArticleTitle: string | null;
  };
  trafficSeries: Array<{ date: string; views: number; uniqueReaders: number; reads: number }>;
  topArticles: Array<{
    articleId: string;
    title: string;
    slug: string;
    category: string;
    views: number;
    uniqueReaders: number;
    completionRate: number;
    avgReadTimeLabel: string;
  }>;
  readDepth: Array<{ depth: number; count: number; rate: number }>;
  sources: Array<{ source: string; count: number; rate: number }>;
  categories: Array<{ category: string; count: number; rate: number }>;
};

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "90d", label: "90 ngày" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function KpiCard({
  title,
  value,
  caption,
  icon: Icon,
}: {
  title: string;
  value: string;
  caption: string;
  icon: typeof Eye;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</span>
        <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
      <div className="mt-2 line-clamp-1 text-xs text-[var(--text-muted)]">{caption}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg-secondary)]">
        <BarChart3 className="h-5 w-5 text-[var(--text-muted)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Chưa có dữ liệu đọc bài</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        CMS Insights sẽ bắt đầu có số liệu sau khi người dùng mở và đọc bài viết.
      </p>
    </div>
  );
}

export function CmsInsightsDashboard() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [data, setData] = useState<CmsInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextRange = range) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/cms-insights?range=${nextRange}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`cms_insights_http_${response.status}`);
      setData((await response.json()) as CmsInsightsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const maxArticleViews = useMemo(
    () => Math.max(1, ...(data?.topArticles ?? []).map((article) => article.views)),
    [data?.topArticles],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Admin only
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] md:text-3xl">CMS Insights</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Quản lý lưu lượng người đọc, nguồn traffic và hiệu quả từng bài viết.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
            {ranges.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                  range === item.key
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load(range)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          Không tải được CMS Insights: {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-sm text-[var(--text-muted)]">
          Đang tải số liệu...
        </div>
      ) : null}

      {!loading && data && !data.hasData ? <EmptyState /> : null}

      {data && data.hasData ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard title="Tổng lượt xem" value={formatNumber(data.summary.totalViews)} caption="Tất cả lượt mở bài" icon={Eye} />
            <KpiCard title="Người đọc duy nhất" value={formatNumber(data.summary.uniqueReaders)} caption="Theo session ẩn danh" icon={Users} />
            <KpiCard title="Tổng lượt đọc bài" value={formatNumber(data.summary.articleReads)} caption="Đã đọc tối thiểu 25%" icon={FileText} />
            <KpiCard title="Thời gian TB" value={data.summary.avgReadTimeLabel} caption="Tính theo mốc đọc sâu nhất" icon={Clock} />
            <KpiCard title="Đọc hết bài" value={`${data.summary.completionRate}%`} caption="Đạt mốc 100%" icon={Activity} />
            <KpiCard title="Bài nổi bật" value={data.summary.topArticleTitle ?? "-"} caption="Theo lượt xem" icon={BarChart3} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Xu hướng lượt xem / người đọc</h2>
                <p className="text-xs text-[var(--text-muted)]">Line chart theo ngày trong khoảng lọc.</p>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trafficSeries}>
                    <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 10 }} />
                    <Line type="monotone" dataKey="views" name="Lượt xem" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="uniqueReaders" name="Người đọc" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="reads" name="Lượt đọc bài" stroke="#facc15" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Độ sâu đọc bài</h2>
              <p className="mb-5 text-xs text-[var(--text-muted)]">Funnel theo mốc scroll bài viết.</p>
              <div className="space-y-4">
                {data.readDepth.map((item) => (
                  <div key={item.depth}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--text-primary)]">Đọc {item.depth}%</span>
                      <span className="text-[var(--text-muted)]">{formatNumber(item.count)} phiên · {item.rate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-secondary)]">
                      <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, item.rate)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">Top bài viết</h2>
              <div className="overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--text-muted)]">
                    <tr>
                      <th className="py-3 pr-4">Bài viết</th>
                      <th className="py-3 pr-4">Lượt xem</th>
                      <th className="py-3 pr-4">Người đọc</th>
                      <th className="py-3 pr-4">% đọc hết</th>
                      <th className="py-3 pr-4">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topArticles.map((article) => (
                      <tr key={article.articleId} className="border-b border-[var(--line)] last:border-0">
                        <td className="max-w-[420px] py-3 pr-4">
                          <Link href={`/tin-tuc/${article.slug}`} className="font-semibold text-[var(--text-primary)] hover:text-emerald-400">
                            {article.title}
                          </Link>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{article.category}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-[var(--text-primary)]">{formatNumber(article.views)}</div>
                          <div className="mt-1 h-1.5 w-24 rounded-full bg-[var(--bg-secondary)]">
                            <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.max(8, (article.views / maxArticleViews) * 100)}%` }} />
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[var(--text-secondary)]">{formatNumber(article.uniqueReaders)}</td>
                        <td className="py-3 pr-4 text-emerald-400">{article.completionRate}%</td>
                        <td className="py-3 pr-4 text-[var(--text-secondary)]">{article.avgReadTimeLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">Nguồn truy cập</h2>
                <div className="h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.sources.slice(0, 6)}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="source" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 10 }} />
                      <Bar dataKey="count" name="Lượt xem" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">Chuyên mục hiệu quả</h2>
                <div className="space-y-3">
                  {data.categories.slice(0, 6).map((item) => (
                    <div key={item.category}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium text-[var(--text-primary)]">{item.category}</span>
                        <span className="text-[var(--text-muted)]">{formatNumber(item.count)} · {item.rate}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-secondary)]">
                        <div className="h-2 rounded-full bg-amber-400" style={{ width: `${Math.min(100, item.rate)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
