import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id } = await params;
  const item = await prisma.labBacktest.findUnique({ where: { id } });
  if (!item || item.userId !== dbUser.id) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }
  await prisma.labBacktest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
