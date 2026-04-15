import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";
import { ensureGuideSeeded, slugifyVi } from "@/lib/guide";

export const dynamic = "force-dynamic";

async function getUniqueCategorySlug(base: string): Promise<string> {
  let candidate = base;
  let i = 2;
  while (await prisma.guideCategory.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

/**
 * GET /api/guide/categories
 * Public endpoint trả category + section published.
 * Query optional: include_unpublished=1 (ADMIN only).
 */
export async function GET(req: NextRequest) {
  try {
    await ensureGuideSeeded();

    const includeUnpublished = req.nextUrl.searchParams.get("include_unpublished") === "1";
    const admin = includeUnpublished ? await isAdmin() : false;

    const categories = await prisma.guideCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        sections: {
          where: includeUnpublished && admin ? undefined : { published: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[GET /api/guide/categories] Error:", error);
    return NextResponse.json({ error: "Lỗi tải danh mục hướng dẫn" }, { status: 500 });
  }
}

/**
 * POST /api/guide/categories
 * ADMIN only.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

    if (!title) {
      return NextResponse.json({ error: "Thiếu title" }, { status: 400 });
    }

    const rawSlug = String(body.slug ?? "").trim();
    const baseSlug = slugifyVi(rawSlug || title);
    if (!baseSlug) {
      return NextResponse.json({ error: "Slug không hợp lệ" }, { status: 400 });
    }

    const slug = await getUniqueCategorySlug(baseSlug);
    const category = await prisma.guideCategory.create({
      data: { title, slug, sortOrder },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/guide/categories] Error:", error);
    return NextResponse.json({ error: "Lỗi tạo danh mục hướng dẫn" }, { status: 500 });
  }
}

