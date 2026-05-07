import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArticleFallbackImage } from "@/lib/articles/image-fallback";
import { normalizeArticleTags, repairMojibakeText } from "@/lib/articles/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  try {
    const article = await prisma.article.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
    }

    // Related articles: same category, exclude current
    const related = article.categoryId
      ? await prisma.article.findMany({
          where: {
            categoryId: article.categoryId,
            id: { not: article.id },
            status: "PUBLISHED",
          },
          include: {
            author: { select: { id: true, name: true, image: true } },
            category: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
        })
      : [];

    const articleTags = safeParseTags(article.tags);
    const normalizedArticle = normalizeArticleForResponse(article, articleTags);
    return NextResponse.json({
      article: normalizedArticle,
      related: related.map((a) => {
        const tags = safeParseTags(a.tags);
        return normalizeArticleForResponse(a, tags);
      }),
    });
  } catch (error) {
    console.error(`[/api/articles/by-slug/${slug}] Error:`, error);
    return NextResponse.json({ error: "Lỗi tải bài viết" }, { status: 500 });
  }
}

function safeParseTags(value: string): string[] {
  try {
    return normalizeArticleTags(JSON.parse(value || "[]"));
  } catch {
    return normalizeArticleTags(value);
  }
}

function normalizeArticleForResponse<
  T extends {
    title: string;
    content?: string;
    excerpt: string | null;
    aiSummary: string | null;
    sentiment: string | null;
    imageUrl: string | null;
  },
>(article: T, tags: string[]) {
  const normalized = {
    ...article,
    title: repairMojibakeText(article.title),
    content: typeof article.content === "string" ? repairMojibakeText(article.content) : article.content,
    excerpt: article.excerpt ? repairMojibakeText(article.excerpt) : article.excerpt,
    aiSummary: article.aiSummary ? repairMojibakeText(article.aiSummary) : article.aiSummary,
    sentiment: article.sentiment ? repairMojibakeText(article.sentiment) : article.sentiment,
    tags,
  };

  return {
    ...normalized,
    imageUrl: article.imageUrl || getArticleFallbackImage(normalized),
  };
}
