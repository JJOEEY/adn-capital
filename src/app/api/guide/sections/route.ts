import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";
import { slugifyVi } from "@/lib/guide";

export const dynamic = "force-dynamic";

async function getUniqueSectionSlug(categoryId: string, base: string): Promise<string> {
  let candidate = base;
  let i = 2;

  while (
    await prisma.guideSection.findFirst({
      where: { categoryId, slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${i}`;
    i += 1;
  }

  return candidate;
}

/**
 * POST /api/guide/sections
 * ADMIN only.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const categoryId = String(body.categoryId ?? "").trim();
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    const published = body.published === undefined ? true : Boolean(body.published);

    if (!categoryId || !title) {
      return NextResponse.json({ error: "Thiếu categoryId hoặc title" }, { status: 400 });
    }

    const category = await prisma.guideCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Category không tồn tại" }, { status: 404 });
    }

    const rawSlug = String(body.slug ?? "").trim();
    const baseSlug = slugifyVi(rawSlug || title);
    if (!baseSlug) {
      return NextResponse.json({ error: "Slug không hợp lệ" }, { status: 400 });
    }

    const slug = await getUniqueSectionSlug(categoryId, baseSlug);
    const section = await prisma.guideSection.create({
      data: {
        categoryId,
        title,
        slug,
        content: content || `## ${title}\n\nĐang cập nhật nội dung...`,
        sortOrder,
        published,
      },
    });

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/guide/sections] Error:", error);
    return NextResponse.json({ error: "Lỗi tạo mục hướng dẫn" }, { status: 500 });
  }
}

