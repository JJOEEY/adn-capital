import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cards = await prisma.landingProductCard.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("[GET /api/landing-products] error:", error);
    return NextResponse.json({ error: "Không thể tải danh sách sản phẩm" }, { status: 500 });
  }
}
