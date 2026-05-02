import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const staticRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/san-pham", changeFrequency: "weekly", priority: 0.9 },
  { path: "/products", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/tin-tuc", changeFrequency: "hourly", priority: 0.9 },
  { path: "/aiden", changeFrequency: "weekly", priority: 0.8 },
  { path: "/art", changeFrequency: "weekly", priority: 0.8 },
  { path: "/rs-rating", changeFrequency: "weekly", priority: 0.7 },
  { path: "/backtest", changeFrequency: "monthly", priority: 0.7 },
  { path: "/margin", changeFrequency: "monthly", priority: 0.7 },
  { path: "/hdsd", changeFrequency: "monthly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const publicProducts = PUBLIC_PRODUCT_MODULES.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const publishedArticles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: {
        not: null,
      },
    },
    select: {
      slug: true,
      publishedAt: true,
      updatedAt: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 1000,
  });

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...publicProducts,
    ...publishedArticles.map((article) => ({
      url: absoluteUrl(`/khac/tin-tuc/${article.slug}`),
      lastModified: article.updatedAt ?? article.publishedAt ?? now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
