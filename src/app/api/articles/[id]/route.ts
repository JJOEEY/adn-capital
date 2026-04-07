import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/articles/[id] — Cập nhật bài viết (edit hoặc đổi status)
 * Admin: Có thể đổi status: PENDING_APPROVAL → PUBLISHED hoặc REJECTED
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status, title, content, excerpt, aiSummary, tags, sentiment, categoryId } = body;

    const updateData: Record<string, unknown> = {};

    if (status) {
      const validStatuses = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Status không hợp lệ: ${status}` }, { status: 400 });
      }
      updateData.status = status;
      if (status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
    }

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (aiSummary !== undefined) updateData.aiSummary = aiSummary;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (sentiment !== undefined) updateData.sentiment = sentiment;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

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

/**
 * DELETE /api/articles/[id] — Xóa bài viết (Admin only)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/articles/${id}] Error:`, error);
    return NextResponse.json({ error: "Lỗi xóa bài viết" }, { status: 500 });
  }
}
