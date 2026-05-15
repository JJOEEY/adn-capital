import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

type ArticleEvent = {
  articleId: string;
  sessionIdHash: string;
  eventType: string;
  readDepth: number;
  readTimeSec: number | null;
  source: string | null;
  deviceType: string | null;
  occurredAt: Date;
  article: {
    title: string;
    slug: string;
    category: { name: string } | null;
  };
};

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

function maxReadTimeBySession(events: ArticleEvent[]) {
  const map = new Map<string, number>();
  for (const event of events) {
    if (event.readTimeSec == null) continue;
    const key = `${event.articleId}:${event.sessionIdHash}`;
    map.set(key, Math.max(map.get(key) ?? 0, event.readTimeSec));
  }
  return map;
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const range = request.nextUrl.searchParams.get("range") ?? "7d";
  const days = RANGE_DAYS[range] ?? RANGE_DAYS["7d"];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const events = await prisma.articleAnalyticsEvent.findMany({
      where: { occurredAt: { gte: since } },
      select: {
        articleId: true,
        sessionIdHash: true,
        eventType: true,
        readDepth: true,
        readTimeSec: true,
        source: true,
        deviceType: true,
        occurredAt: true,
        article: {
          select: {
            title: true,
            slug: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { occurredAt: "asc" },
      take: 50_000,
    });

    const views = events.filter((event) => event.eventType === "ARTICLE_VIEW");
    const depthEvents = events.filter((event) => event.eventType === "READ_DEPTH");
    const viewSessions = new Set(views.map((event) => `${event.articleId}:${event.sessionIdHash}`));
    const readers = new Set(views.map((event) => event.sessionIdHash));
    const meaningfulReads = new Set(depthEvents.filter((event) => event.readDepth >= 25).map((event) => `${event.articleId}:${event.sessionIdHash}`));
    const completedReads = new Set(depthEvents.filter((event) => event.readDepth >= 100).map((event) => `${event.articleId}:${event.sessionIdHash}`));
    const readTimes = [...maxReadTimeBySession(events).values()].filter((value) => value > 0);
    const avgReadTimeSec = readTimes.length ? Math.round(readTimes.reduce((sum, value) => sum + value, 0) / readTimes.length) : 0;

    const seriesMap = new Map<string, { date: string; views: number; uniqueReaders: Set<string>; reads: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = dayKey(date);
      seriesMap.set(key, { date: key, views: 0, uniqueReaders: new Set(), reads: 0 });
    }
    for (const event of views) {
      const bucket = seriesMap.get(dayKey(event.occurredAt));
      if (!bucket) continue;
      bucket.views += 1;
      bucket.uniqueReaders.add(event.sessionIdHash);
    }
    for (const event of depthEvents) {
      if (event.readDepth < 25) continue;
      const bucket = seriesMap.get(dayKey(event.occurredAt));
      if (bucket) bucket.reads += 1;
    }

    const topMap = new Map<string, {
      articleId: string;
      title: string;
      slug: string;
      category: string;
      views: number;
      sessions: Set<string>;
      completed: Set<string>;
      readTimes: Map<string, number>;
    }>();
    for (const event of events) {
      const existing = topMap.get(event.articleId) ?? {
        articleId: event.articleId,
        title: event.article.title,
        slug: event.article.slug,
        category: event.article.category?.name ?? "Chưa phân loại",
        views: 0,
        sessions: new Set<string>(),
        completed: new Set<string>(),
        readTimes: new Map<string, number>(),
      };
      if (event.eventType === "ARTICLE_VIEW") {
        existing.views += 1;
        existing.sessions.add(event.sessionIdHash);
      }
      if (event.eventType === "READ_DEPTH" && event.readDepth >= 100) {
        existing.completed.add(event.sessionIdHash);
      }
      if (event.readTimeSec != null) {
        existing.readTimes.set(event.sessionIdHash, Math.max(existing.readTimes.get(event.sessionIdHash) ?? 0, event.readTimeSec));
      }
      topMap.set(event.articleId, existing);
    }

    const sourceMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    for (const event of views) {
      sourceMap.set(event.source ?? "Direct", (sourceMap.get(event.source ?? "Direct") ?? 0) + 1);
      categoryMap.set(event.article.category?.name ?? "Chưa phân loại", (categoryMap.get(event.article.category?.name ?? "Chưa phân loại") ?? 0) + 1);
      deviceMap.set(event.deviceType ?? "unknown", (deviceMap.get(event.deviceType ?? "unknown") ?? 0) + 1);
    }

    const topArticle = [...topMap.values()].sort((a, b) => b.views - a.views)[0] ?? null;

    return NextResponse.json({
      range,
      since: since.toISOString(),
      updatedAt: new Date().toISOString(),
      summary: {
        totalViews: views.length,
        uniqueReaders: readers.size,
        articleReads: meaningfulReads.size,
        avgReadTimeSec,
        avgReadTimeLabel: formatSeconds(avgReadTimeSec),
        completionRate: pct(completedReads.size, viewSessions.size),
        topArticleTitle: topArticle?.title ?? null,
      },
      trafficSeries: [...seriesMap.values()].map((bucket) => ({
        date: bucket.date,
        views: bucket.views,
        uniqueReaders: bucket.uniqueReaders.size,
        reads: bucket.reads,
      })),
      topArticles: [...topMap.values()]
        .sort((a, b) => b.views - a.views)
        .slice(0, 10)
        .map((article) => {
          const times = [...article.readTimes.values()].filter((value) => value > 0);
          const avg = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;
          return {
            articleId: article.articleId,
            title: article.title,
            slug: article.slug,
            category: article.category,
            views: article.views,
            uniqueReaders: article.sessions.size,
            completionRate: pct(article.completed.size, article.sessions.size),
            avgReadTimeSec: avg,
            avgReadTimeLabel: formatSeconds(avg),
          };
        }),
      readDepth: [25, 50, 75, 100].map((depth) => {
        const count = new Set(depthEvents.filter((event) => event.readDepth >= depth).map((event) => `${event.articleId}:${event.sessionIdHash}`)).size;
        return { depth, count, rate: pct(count, viewSessions.size) };
      }),
      sources: [...sourceMap.entries()].map(([source, count]) => ({ source, count, rate: pct(count, views.length) })).sort((a, b) => b.count - a.count),
      categories: [...categoryMap.entries()].map(([category, count]) => ({ category, count, rate: pct(count, views.length) })).sort((a, b) => b.count - a.count),
      devices: [...deviceMap.entries()].map(([device, count]) => ({ device, count, rate: pct(count, views.length) })).sort((a, b) => b.count - a.count),
      hasData: events.length > 0,
    });
  } catch (error) {
    console.error("[GET /api/admin/cms-insights] error:", error);
    return NextResponse.json({ error: "Không tải được CMS Insights" }, { status: 500 });
  }
}
