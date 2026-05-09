import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildExcerptFromHtml,
  createArticleSlug,
  getArticleEditorUser,
  hasBrokenArticleEncoding,
  normalizeArticleTags,
  repairMojibakeText,
  sanitizeArticleHtml,
} from "@/lib/articles/server";
import { getArticleFallbackImage } from "@/lib/articles/image-fallback";

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
      articles: articles.map((article) => normalizeArticleForResponse(article)),
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

    const articleTitle = repairMojibakeText(String(title).trim());
    const articleContent = repairMojibakeText(String(content));
    const articleExcerpt = repairMojibakeText(excerpt ? String(excerpt) : "");
    const articleSummary = repairMojibakeText(aiSummary ? String(aiSummary) : "");
    const articleOriginalTitle = repairMojibakeText(originalTitle ? String(originalTitle) : "");
    const articleSentiment = repairMojibakeText(sentiment ? String(sentiment) : "");

    if (
      hasBrokenArticleEncoding(
        [articleTitle, articleContent, articleExcerpt, articleSummary, articleOriginalTitle, articleSentiment]
          .filter(Boolean)
          .join("\n"),
      )
    ) {
      return NextResponse.json({ error: "Encoding tiếng Việt không hợp lệ. Hãy lưu draft UTF-8 rồi gửi lại." }, { status: 400 });
    }

    const safeContent = sanitizeArticleHtml(articleContent);
    const requestedStatus = typeof status === "string" ? status.toUpperCase() : "PENDING_APPROVAL";
    const articleStatus =
      requestedStatus === "PUBLISHED" && editor.systemRole === "ADMIN"
        ? "PUBLISHED"
        : requestedStatus === "DRAFT"
          ? "DRAFT"
          : "PENDING_APPROVAL";

    const article = await prisma.article.create({
      data: {
        title: articleTitle,
        originalTitle: articleOriginalTitle || null,
        slug: createArticleSlug(articleTitle),
        content: safeContent,
        excerpt: articleExcerpt || buildExcerptFromHtml(safeContent),
        aiSummary: articleSummary || null,
        sourceUrl: sourceUrl || null,
        imageUrl: imageUrl || null,
        pdfUrl: pdfUrl || null,
        tags: JSON.stringify(normalizeArticleTags(tags ?? hashtags)),
        sentiment: articleSentiment || null,
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

function normalizeArticleForResponse<
  T extends {
    title: string;
    excerpt: string | null;
    aiSummary: string | null;
    content?: string;
    sentiment: string | null;
    tags: string;
    imageUrl: string | null;
  },
>(article: T) {
  const tags = safeParseTags(article.tags);
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
