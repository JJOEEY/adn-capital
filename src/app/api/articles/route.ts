import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildExcerptFromHtml,
  createArticleSlug,
  getArticleEditorUser,
  normalizeArticleTags,
  sanitizeArticleHtml,
} from "@/lib/articles/server";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = (searchParams.get("status") ?? "PUBLISHED").toUpperCase();
  const categorySlug = searchParams.get("category");
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const where: Record<string, unknown> = {};

    if (status === "ALL") {
      const editor = await getArticleEditorUser();
      if (!editor) {
        return NextResponse.json({ error: "Bạn không có quyền xem toàn bộ bài viết" }, { status: 403 });
      }
    } else {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: `Trạng thái không hợp lệ: ${status}` }, { status: 400 });
      }
      if (status !== "PUBLISHED") {
        const editor = await getArticleEditorUser();
        if (!editor) {
          return NextResponse.json({ error: "Bạn không có quyền xem trạng thái này" }, { status: 403 });
        }
      }
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
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    return NextResponse.json({
      articles: articles.map((article) => ({
        ...article,
        tags: safeParseTags(article.tags),
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

export async function POST(request: NextRequest) {
  try {
    const editor = await getArticleEditorUser();
    if (!editor) {
      return NextResponse.json({ error: "Bạn không có quyền tạo bài viết" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, excerpt, aiSummary, sourceUrl, imageUrl, pdfUrl, originalTitle, tags, hashtags, sentiment, categoryId, status } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung bài viết" }, { status: 400 });
    }

    const safeContent = sanitizeArticleHtml(String(content));
    const requestedStatus = typeof status === "string" ? status.toUpperCase() : "PENDING_APPROVAL";
    const articleStatus =
      requestedStatus === "PUBLISHED" && editor.systemRole === "ADMIN"
        ? "PUBLISHED"
        : requestedStatus === "DRAFT"
          ? "DRAFT"
          : "PENDING_APPROVAL";

    const article = await prisma.article.create({
      data: {
        title: String(title).trim(),
        originalTitle: originalTitle || null,
        slug: createArticleSlug(String(title)),
        content: safeContent,
        excerpt: excerpt || buildExcerptFromHtml(safeContent),
        aiSummary: aiSummary || null,
        sourceUrl: sourceUrl || null,
        imageUrl: imageUrl || null,
        pdfUrl: pdfUrl || null,
        tags: JSON.stringify(normalizeArticleTags(tags ?? hashtags)),
        sentiment: sentiment || null,
        categoryId: categoryId || null,
        authorId: editor.id,
        status: articleStatus,
        publishedAt: articleStatus === "PUBLISHED" ? new Date() : null,
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/articles] Error:", error);
    return NextResponse.json({ error: "Lỗi tạo bài viết" }, { status: 500 });
  }
}

function safeParseTags(value: string): string[] {
  try {
    return normalizeArticleTags(JSON.parse(value || "[]"));
  } catch {
    return normalizeArticleTags(value);
  }
}
