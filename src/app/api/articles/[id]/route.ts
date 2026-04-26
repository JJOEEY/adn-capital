import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildExcerptFromHtml,
  getArticleEditorUser,
  normalizeArticleTags,
  sanitizeArticleHtml,
} from "@/lib/articles/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED"];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const editor = await getArticleEditorUser();
    if (!editor) {
      return NextResponse.json({ error: "Bạn không có quyền cập nhật bài viết" }, { status: 403 });
    }

    const body = await request.json();
    const { status, title, content, excerpt, aiSummary, tags, hashtags, sentiment, categoryId, pdfUrl, imageUrl, sourceUrl, originalTitle } = body;

    const updateData: Record<string, unknown> = {};

    if (status) {
      const nextStatus = String(status).toUpperCase();
      if (!VALID_STATUSES.includes(nextStatus)) {
        return NextResponse.json({ error: `Trạng thái không hợp lệ: ${nextStatus}` }, { status: 400 });
      }
      if ((nextStatus === "PUBLISHED" || nextStatus === "REJECTED") && editor.systemRole !== "ADMIN") {
        return NextResponse.json({ error: "Chỉ ADMIN được duyệt hoặc từ chối bài viết" }, { status: 403 });
      }
      updateData.status = nextStatus;
      updateData.publishedAt = nextStatus === "PUBLISHED" ? new Date() : null;
    }

    if (title !== undefined) updateData.title = String(title).trim();
    if (content !== undefined) {
      const safeContent = sanitizeArticleHtml(String(content));
      updateData.content = safeContent;
      if (excerpt === undefined) updateData.excerpt = buildExcerptFromHtml(safeContent);
    }
    if (excerpt !== undefined) updateData.excerpt = excerpt || null;
    if (aiSummary !== undefined) updateData.aiSummary = aiSummary || null;
    if (tags !== undefined || hashtags !== undefined) updateData.tags = JSON.stringify(normalizeArticleTags(tags ?? hashtags));
    if (sentiment !== undefined) updateData.sentiment = sentiment || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (pdfUrl !== undefined) updateData.pdfUrl = pdfUrl || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl || null;
    if (originalTitle !== undefined) updateData.originalTitle = originalTitle || null;

    const article = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ article });
  } catch (error) {
    console.error(`[PATCH /api/articles/${id}] Error:`, error);
    return NextResponse.json({ error: "Lỗi cập nhật bài viết" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const admin = await getArticleEditorUser({ adminOnly: true });
    if (!admin) {
      return NextResponse.json({ error: "Chỉ ADMIN được xóa bài viết" }, { status: 403 });
    }

    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/articles/${id}] Error:`, error);
    return NextResponse.json({ error: "Lỗi xóa bài viết" }, { status: 500 });
  }
}
