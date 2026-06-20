import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ADN Lab admin-only → lưu/đọc chiến thuật theo từng admin.
async function requireAdmin() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }), dbUser: null };
  if (dbUser.systemRole !== "ADMIN") {
    return { error: NextResponse.json({ error: "Chỉ admin dùng được ADN Lab" }, { status: 403 }), dbUser: null };
  }
  return { error: null, dbUser };
}

export async function GET() {
  const { error, dbUser } = await requireAdmin();
  if (error || !dbUser) return error;
  const items = await prisma.labBacktest.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const { error, dbUser } = await requireAdmin();
  if (error || !dbUser) return error;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "Thiếu tên chiến thuật" }, { status: 400 });
  if (!body?.config || !body?.result) return NextResponse.json({ error: "Thiếu config hoặc kết quả" }, { status: 400 });
  const item = await prisma.labBacktest.create({
    data: { userId: dbUser.id, name, config: body.config, result: body.result },
  });
  return NextResponse.json({ item }, { status: 201 });
}
