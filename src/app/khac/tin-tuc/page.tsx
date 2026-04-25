import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { NewsListClient } from "@/components/news/NewsListClient";
import { prisma } from "@/lib/prisma";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  parseJsonTags,
  SITE_NAME,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin tức chứng khoán và tài chính",
  description:
    "Cập nhật tin tức chứng khoán, thị trường tài chính, báo cáo phân tích và góc nhìn AI từ ADN Capital.",
  alternates: {
    canonical: "/khac/tin-tuc",
  },
  openGraph: {
    type: "website",
    url: "/khac/tin-tuc",
    siteName: SITE_NAME,
    title: "Tin tức chứng khoán và tài chính | ADN Capital",
    description:
      "Cập nhật tin tức chứng khoán, thị trường tài chính, báo cáo phân tích và góc nhìn AI từ ADN Capital.",
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
};

async function getNewsPageData() {
  try {
    const [articles, categories] = await Promise.all([
      prisma.article.findMany({
        where: { status: "PUBLISHED" },
        include: {
          author: { select: { id: true, name: true, image: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    return {
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        excerpt: article.excerpt,
        aiSummary: article.aiSummary,
        sourceUrl: article.sourceUrl,
        imageUrl: article.imageUrl,
        pdfUrl: article.pdfUrl,
        status: article.status,
        tags: parseJsonTags(article.tags),
        sentiment: article.sentiment,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        author: article.author,
        category: article.category,
      })),
      categories,
    };
  } catch (error) {
    console.warn("[news-page] Failed to load initial news data", error);
    return { articles: [], categories: [] };
  }
}

export default async function NewsPage() {
  const { articles, categories } = await getNewsPageData();
  const pageUrl = absoluteUrl("/khac/tin-tuc");

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": pageUrl,
      name: "Tin tức chứng khoán và tài chính",
      description: DEFAULT_DESCRIPTION,
      url: pageUrl,
      inLanguage: "vi-VN",
      isPartOf: {
        "@id": absoluteUrl("/#website"),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: articles.slice(0, 10).map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/khac/tin-tuc/${article.slug}`),
        name: article.title,
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <NewsListClient initialArticles={articles} initialCategories={categories} />
    </>
  );
}
