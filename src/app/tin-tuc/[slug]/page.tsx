import type { Metadata } from "next";
import { ArticleDetailClient } from "@/components/news/ArticleDetailClient";
import { getArticleFallbackImage } from "@/lib/articles/image-fallback";
import { normalizeArticleTags, repairMojibakeText, stripHtmlToText } from "@/lib/articles/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

function safeParseTags(value?: string | null): string[] {
  try {
    return normalizeArticleTags(JSON.parse(value || "[]"));
  } catch {
    return normalizeArticleTags(value || "");
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug },
    include: { category: { select: { name: true, slug: true } } },
  });

  if (!article) {
    return {
      title: "Tin tức | ADN Capital",
    };
  }

  const tags = safeParseTags(article.tags);
  const title = repairMojibakeText(article.title);
  const excerpt = article.excerpt ? repairMojibakeText(article.excerpt) : null;
  const aiSummary = article.aiSummary ? repairMojibakeText(article.aiSummary) : null;
  const imageUrl = article.imageUrl || getArticleFallbackImage({ ...article, title, excerpt, aiSummary, tags });
  const description = excerpt || aiSummary || stripHtmlToText(repairMojibakeText(article.content)).slice(0, 160);

  return {
    title: `${title} | ADN Capital`,
    description,
    keywords: tags,
    alternates: {
      canonical: `/tin-tuc/${article.slug}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      images: [{ url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  return <ArticleDetailClient slug={slug} />;
}
