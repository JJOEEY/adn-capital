import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/categories — Liệt kê tất cả Category (sắp xếp theo sortOrder)
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[GET /api/categories] Error:", error);
    return NextResponse.json({ error: "Lỗi tải danh mục" }, { status: 500 });
  }
}

/**
 * POST /api/categories — Tạo Category mới (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sortOrder } = body;

    if (!name) {
      return NextResponse.json({ error: "Thiếu name" }, { status: 400 });
    }

    const slug = name
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
