import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

interface UpdatePayload {
  title?: string;
  subtitle?: string | null;
  description?: string;
  bullets?: string[];
  href?: string;
  imageUrl?: string;
  imageAlt?: string | null;
  badge?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}

function normalizeBullets(input: unknown): string[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRequiredText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: UpdatePayload;
  try {
    body = (await req.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  const title = parseRequiredText(body.title);
  const description = parseRequiredText(body.description);
  const href = parseRequiredText(body.href);
  const imageUrl = parseRequiredText(body.imageUrl);
  const bullets = normalizeBullets(body.bullets);

  if (title !== undefined && !title) {
    return NextResponse.json({ error: "title không hợp lệ" }, { status: 400 });
  }
  if (description !== undefined && !description) {
    return NextResponse.json({ error: "description không hợp lệ" }, { status: 400 });
  }
  if (href !== undefined && !href) {
    return NextResponse.json({ error: "href không hợp lệ" }, { status: 400 });
  }
  if (imageUrl !== undefined && !imageUrl) {
    return NextResponse.json({ error: "imageUrl không hợp lệ" }, { status: 400 });
  }

  try {
    const card = await prisma.landingProductCard.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(href !== undefined ? { href } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(bullets !== undefined ? { bullets } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        ...(normalizeOptionalText(body.subtitle) !== undefined
          ? { subtitle: normalizeOptionalText(body.subtitle) }
          : {}),
        ...(normalizeOptionalText(body.imageAlt) !== undefined
          ? { imageAlt: normalizeOptionalText(body.imageAlt) }
          : {}),
        ...(normalizeOptionalText(body.badge) !== undefined
          ? { badge: normalizeOptionalText(body.badge) }
          : {}),
      },
    });

    revalidatePath("/");
    return NextResponse.json({ card });
  } catch (error) {
    console.error("[PATCH /api/admin/landing-products/[id]] error:", error);
    return NextResponse.json({ error: "Không thể cập nhật card" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await prisma.landingProductCard.delete({ where: { id } });
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/landing-products/[id]] error:", error);
    return NextResponse.json({ error: "Không thể xóa card" }, { status: 500 });
  }
}
