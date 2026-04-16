import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, systemRole: true },
  });
  if (!admin || admin.systemRole !== "ADMIN") return null;
  return admin;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quota = await prisma.adminChatQuotaOverride.findUnique({
    where: { targetUserId: id },
  });
  return NextResponse.json({ quota });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    totalQuota?: number;
    usedQuota?: number;
    active?: boolean;
    note?: string;
    resetUsed?: boolean;
  };

  const totalQuota = Math.max(0, Number(body.totalQuota ?? 0));
  const usedQuota = body.resetUsed ? 0 : Math.max(0, Number(body.usedQuota ?? 0));
  const active = body.active !== false;
  const note = typeof body.note === "string" ? body.note.trim() : null;

  const quota = await prisma.adminChatQuotaOverride.upsert({
    where: { targetUserId: id },
    create: {
      targetUserId: id,
      totalQuota,
      usedQuota,
      active,
      note,
      updatedByAdminId: admin.id,
    },
    update: {
      totalQuota,
      usedQuota,
      active,
      note,
      updatedByAdminId: admin.id,
    },
  });
  revalidatePath("/");

  return NextResponse.json({ quota });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.adminChatQuotaOverride.deleteMany({
    where: { targetUserId: id },
  });
  revalidatePath("/");

  return NextResponse.json({ success: true });
}
