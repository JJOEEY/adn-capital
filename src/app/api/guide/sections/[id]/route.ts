import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";
import { slugifyVi } from "@/lib/guide";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

async function isDuplicateSlug(categoryId: string, slug: string, excludeId: string) {
  const found = await prisma.guideSection.findFirst({
    where: {
      categoryId,
      slug,
      id: { not: excludeId },
    },
    select: { id: true },
  });
  return !!found;
}

/**
 * PUT /api/guide/sections/[id]
 * ADMIN only.
 */
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.guideSection.findUnique({
      where: { id },
      select: { id: true, categoryId: true, title: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section không tồn tại" }, { status: 404 });
    }

    const body = await req.json();
    const targetCategoryId = String(body.categoryId ?? existing.categoryId).trim();
    const title =
      body.title === undefined ? undefined : String(body.title ?? "").trim();
    const content =
      body.content === undefined ? undefined : String(body.content ?? "");
    const sortOrder =
      body.sortOrder === undefined ? undefined : Number(body.sortOrder);
    const published =
      body.published === undefined ? undefined : Boolean(body.published);

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      if (!title) {
        return NextResponse.json({ error: "Title không hợp lệ" }, { status: 400 });
      }
      updateData.title = title;
    }

    if (content !== undefined) {
      updateData.content = content;
    }

    if (sortOrder !== undefined) {
      if (!Number.isFinite(sortOrder)) {
        return NextResponse.json({ error: "sortOrder không hợp lệ" }, { status: 400 });
      }
      updateData.sortOrder = sortOrder;
    }

    if (published !== undefined) {
      updateData.published = published;
    }

    if (body.categoryId !== undefined) {
      const category = await prisma.guideCategory.findUnique({
        where: { id: targetCategoryId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: "Category không tồn tại" }, { status: 404 });
      }
      updateData.categoryId = targetCategoryId;
    }

    if (body.slug !== undefined || title !== undefined || body.categoryId !== undefined) {
      const rawSlug = String(body.slug ?? title ?? existing.title).trim();
      const slug = slugifyVi(rawSlug);
      if (!slug) {
        return NextResponse.json({ error: "Slug không hợp lệ" }, { status: 400 });
      }
      if (await isDuplicateSlug(targetCategoryId, slug, id)) {
        return NextResponse.json(
          { error: "Slug đã tồn tại trong category này" },
          { status: 409 }
        );
      }
      updateData.slug = slug;
    }

    const section = await prisma.guideSection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ section });
  } catch (error) {
    console.error(`[PUT /api/guide/sections/${id}] Error:`, error);
    return NextResponse.json({ error: "Lỗi cập nhật mục hướng dẫn" }, { status: 500 });
  }
}

/**
 * DELETE /api/guide/sections/[id]
 * ADMIN only.
 */
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.guideSection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/guide/sections/${id}] Error:`, error);
    return NextResponse.json({ error: "Lỗi xoá mục hướng dẫn" }, { status: 500 });
  }
}

