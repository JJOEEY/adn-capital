import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const staticRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/san-pham", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/khac/tin-tuc", changeFrequency: "daily", priority: 0.9 },
  { path: "/backtest", changeFrequency: "weekly", priority: 0.7 },
  { path: "/rs-rating", changeFrequency: "weekly", priority: 0.7 },
  { path: "/signal-map", changeFrequency: "weekly", priority: 0.7 },
  { path: "/art", changeFrequency: "weekly", priority: 0.7 },
  { path: "/hdsd", changeFrequency: "monthly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: {
        slug: true,
        publishedAt: true,
        updatedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 1000,
    });

    routes.push(
      ...articles.map((article) => ({
        url: absoluteUrl(`/khac/tin-tuc/${article.slug}`),
        lastModified: article.updatedAt || article.publishedAt || now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    );
  } catch (error) {
    console.warn("[sitemap] Failed to load article URLs", error);
  }

  return routes;
}
