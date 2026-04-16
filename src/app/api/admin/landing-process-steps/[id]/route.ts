import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

interface UpdatePayload {
  title?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
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
  const imageUrl = parseRequiredText(body.imageUrl);

  if (title !== undefined && !title) {
    return NextResponse.json({ error: "title không hợp lệ" }, { status: 400 });
  }
  if (description !== undefined && !description) {
    return NextResponse.json({ error: "description không hợp lệ" }, { status: 400 });
  }
  if (imageUrl !== undefined && !imageUrl) {
    return NextResponse.json({ error: "imageUrl không hợp lệ" }, { status: 400 });
  }

  try {
    const step = await prisma.landingProcessStep.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        ...(normalizeOptionalText(body.imageAlt) !== undefined
          ? { imageAlt: normalizeOptionalText(body.imageAlt) }
          : {}),
      },
    });

    revalidatePath("/");
    return NextResponse.json({ step });
  } catch (error) {
    console.error("[PATCH /api/admin/landing-process-steps/[id]] error:", error);
    return NextResponse.json({ error: "Không thể cập nhật bước quy trình" }, { status: 500 });
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
    await prisma.landingProcessStep.delete({ where: { id } });
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/landing-process-steps/[id]] error:", error);
    return NextResponse.json({ error: "Không thể xóa bước quy trình" }, { status: 500 });
  }
}
