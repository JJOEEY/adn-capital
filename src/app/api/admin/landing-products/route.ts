import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

interface CreatePayload {
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

function normalizeBullets(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
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
    const cards = await prisma.landingProductCard.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("[GET /api/admin/landing-products] error:", error);
    return NextResponse.json({ error: "Không thể tải danh sách card" }, { status: 500 });
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
  const href = (body.href ?? "").trim();
  const imageUrl = (body.imageUrl ?? "").trim();
  const bullets = normalizeBullets(body.bullets);

  if (!title) return NextResponse.json({ error: "Thiếu title" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Thiếu description" }, { status: 400 });
  if (!href) return NextResponse.json({ error: "Thiếu href" }, { status: 400 });
  if (!imageUrl) return NextResponse.json({ error: "Thiếu imageUrl" }, { status: 400 });

  try {
    let sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : null;
    if (sortOrder == null || Number.isNaN(sortOrder)) {
      const last = await prisma.landingProductCard.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? 0) + 1;
    }

    const card = await prisma.landingProductCard.create({
      data: {
        title,
        subtitle: normalizeOptionalText(body.subtitle),
        description,
        bullets,
        href,
        imageUrl,
        imageAlt: normalizeOptionalText(body.imageAlt),
        badge: normalizeOptionalText(body.badge),
        isPublished: body.isPublished ?? true,
        sortOrder,
      },
    });

    revalidatePath("/");
    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/landing-products] error:", error);
    return NextResponse.json({ error: "Không thể tạo card" }, { status: 500 });
  }
}
