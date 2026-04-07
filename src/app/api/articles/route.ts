import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/articles?status=PUBLISHED&category=thi-truong&page=1&limit=20
 * Public: chỉ trả bài PUBLISHED. Admin: trả tất cả status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "PUBLISHED";
  const categorySlug = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  try {
    const where: Record<string, unknown> = {};

    if (status !== "ALL") {
      where.status = status;
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    return NextResponse.json({
      articles: articles.map((a) => ({
        ...a,
        tags: JSON.parse(a.tags || "[]"),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[/api/articles] Error:", error);
    return NextResponse.json({ error: "Lỗi tải bài viết" }, { status: 500 });
  }
}

/**
 * POST /api/articles — Tạo bài mới (WRITER hoặc ADMIN)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, excerpt, aiSummary, sourceUrl, imageUrl, tags, sentiment, categoryId, authorId } = body;

    if (!title || !content || !authorId) {
      return NextResponse.json({ error: "Thiếu title, content, hoặc authorId" }, { status: 400 });
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100)
      + "-" + Date.now().toString(36);

    const article = await prisma.article.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        aiSummary: aiSummary || null,
        sourceUrl: sourceUrl || null,
        imageUrl: imageUrl || null,
        tags: JSON.stringify(tags || []),
        sentiment: sentiment || null,
        categoryId: categoryId || null,
        authorId,
        status: "PENDING_APPROVAL",
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/articles] Error:", error);
    return NextResponse.json({ error: "Lỗi tạo bài viết" }, { status: 500 });
  }
}
