import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildExcerptFromHtml,
  createArticleSlug,
  ensureReadableArticleHtml,
  normalizeArticleTags,
  repairMojibakeText,
  sanitizeArticleHtml,
} from "@/lib/articles/server";

export const dynamic = "force-dynamic";

// Route nội bộ cho ADN Brain (hội đồng agent) đẩy nháp bài — gate bằng secret, KHÔNG cần session.
// Luôn tạo status=DRAFT (admin tự duyệt mới publish). Bí mật: env BRAIN_PUSH_SECRET.
export async function POST(request: NextRequest) {
  const secret = process.env.BRAIN_PUSH_SECRET || "";
  const provided = request.headers.get("x-brain-secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, excerpt, tags } = body ?? {};
    if (!title || !content) {
      return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung" }, { status: 400 });
    }

    const author = await prisma.user.findFirst({
      where: { systemRole: "ADMIN" },
      select: { id: true },
    });
    if (!author) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản admin để gán tác giả" }, { status: 500 });
    }

    const articleTitle = repairMojibakeText(String(title).trim());
    const safeContent = sanitizeArticleHtml(repairMojibakeText(String(content)));
    const articleExcerpt = repairMojibakeText(excerpt ? String(excerpt) : "");

    const article = await prisma.article.create({
      data: {
        title: articleTitle,
        slug: createArticleSlug(articleTitle),
        content: ensureReadableArticleHtml(safeContent),
        excerpt: articleExcerpt || buildExcerptFromHtml(safeContent),
        aiSummary: "Nháp do Hội đồng ADN Brain soạn.",
        tags: JSON.stringify(normalizeArticleTags(tags ?? [])),
        authorId: author.id,
        status: "DRAFT",
        publishedAt: null,
      },
    });

    return NextResponse.json({ ok: true, id: article.id, slug: article.slug }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/internal/brain-article] Error:", error);
    return NextResponse.json({ error: "Lỗi tạo bài" }, { status: 500 });
  }
}
