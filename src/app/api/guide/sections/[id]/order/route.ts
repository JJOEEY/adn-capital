import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/guide/sections/[id]/order
 * ADMIN only.
 * Body:
 * - { sortOrder: number, categoryId?: string }
 * - hoặc { items: [{ id, sortOrder, categoryId? }] } để batch reorder.
 */
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    type ReorderItem = { id: string; sortOrder: number; categoryId?: string };

    if (Array.isArray(body.items)) {
      const items = body.items
        .map((item: Record<string, unknown>) => ({
          id: String(item.id ?? "").trim(),
          sortOrder: Number(item.sortOrder),
          categoryId:
            item.categoryId === undefined ? undefined : String(item.categoryId ?? "").trim(),
        }))
        .filter((item: ReorderItem) => item.id && Number.isFinite(item.sortOrder));

      if (items.length === 0) {
        return NextResponse.json({ error: "Payload reorder rỗng" }, { status: 400 });
      }

      await prisma.$transaction(
        items.map((item: ReorderItem) =>
          prisma.guideSection.update({
            where: { id: item.id },
            data: {
              sortOrder: item.sortOrder,
              ...(item.categoryId ? { categoryId: item.categoryId } : {}),
            },
          })
        )
      );

      return NextResponse.json({ success: true, updated: items.length });
    }

    const sortOrder = Number(body.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: "Thiếu sortOrder hợp lệ" }, { status: 400 });
    }

    const section = await prisma.guideSection.update({
      where: { id },
      data: {
        sortOrder,
        ...(body.categoryId ? { categoryId: String(body.categoryId).trim() } : {}),
      },
    });

    return NextResponse.json({ section });
  } catch (error) {
    console.error(`[PATCH /api/guide/sections/${id}/order] Error:`, error);
    return NextResponse.json({ error: "Lỗi sắp xếp mục hướng dẫn" }, { status: 500 });
  }
}
