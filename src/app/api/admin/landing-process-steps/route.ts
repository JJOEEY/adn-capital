import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

interface CreatePayload {
  title?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const steps = await prisma.landingProcessStep.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ steps });
  } catch (error) {
    console.error("[GET /api/admin/landing-process-steps] error:", error);
    return NextResponse.json({ error: "Không thể tải danh sách quy trình" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreatePayload;
  try {
    body = (await req.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const imageUrl = (body.imageUrl ?? "").trim();

  if (!title) return NextResponse.json({ error: "Thiếu title" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Thiếu description" }, { status: 400 });
  if (!imageUrl) return NextResponse.json({ error: "Thiếu imageUrl" }, { status: 400 });

  try {
    let sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : null;
    if (sortOrder == null || Number.isNaN(sortOrder)) {
      const last = await prisma.landingProcessStep.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? 0) + 1;
    }

    const step = await prisma.landingProcessStep.create({
      data: {
        title,
        description,
        imageUrl,
        imageAlt: normalizeOptionalText(body.imageAlt),
        isPublished: body.isPublished ?? true,
        sortOrder,
      },
    });

    revalidatePath("/");
    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/landing-process-steps] error:", error);
    return NextResponse.json({ error: "Không thể tạo bước quy trình" }, { status: 500 });
  }
}
