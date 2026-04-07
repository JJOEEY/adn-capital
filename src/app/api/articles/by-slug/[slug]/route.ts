import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({
      article: {
        ...article,
        tags: JSON.parse(article.tags || "[]"),
      },
      related: related.map((a) => ({ ...a, tags: JSON.parse(a.tags || "[]") })),
    });
  } catch (error) {
    console.error(`[/api/articles/by-slug/${slug}] Error:`, error);
    return NextResponse.json({ error: "Lỗi tải bài viết" }, { status: 500 });
  }
}
