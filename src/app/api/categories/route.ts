import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NEWS_PRIMARY_CATEGORIES, sortNewsCategories } from "@/lib/articles/category-priority";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensurePrimaryCategories();

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ categories: sortNewsCategories(categories) });
  } catch (error) {
    console.error("[GET /api/categories] Error:", error);
    return NextResponse.json({ error: "Lỗi tải danh mục" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sortOrder } = body;

    if (!name) {
      return NextResponse.json({ error: "Thiếu name" }, { status: 400 });
    }

    const slug = String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/categories] Error:", error);
    return NextResponse.json({ error: "Lỗi tạo danh mục" }, { status: 500 });
  }
}

async function ensurePrimaryCategories() {
  for (const category of NEWS_PRIMARY_CATEGORIES) {
    const existingBySlug = await prisma.category.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    });

    if (existingBySlug) {
      await prisma.category.update({
        where: { id: existingBySlug.id },
        data: {
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      });
      continue;
    }

    const existingByName = await prisma.category.findUnique({
      where: { name: category.name },
      select: { id: true },
    });

    if (existingByName) {
      await prisma.category.update({
        where: { id: existingByName.id },
        data: {
          slug: category.slug,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.category.create({ data: category });
  }
}
