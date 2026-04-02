import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function isAdmin() {
  const session = await auth();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email.toLowerCase());
}

/**
 * PATCH /api/admin/users/[id] — Cập nhật user (role, vipUntil, dnseVerified...)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Chỉ cho phép cập nhật các trường an toàn
  const allowed: Record<string, unknown> = {};
  if (body.role !== undefined) allowed.role = body.role;
  if (body.vipUntil !== undefined) allowed.vipUntil = body.vipUntil ? new Date(body.vipUntil) : null;
  if (body.dnseVerified !== undefined) allowed.dnseVerified = body.dnseVerified;
  if (body.dnseId !== undefined) allowed.dnseId = body.dnseId || null;

  const updated = await prisma.user.update({
    where: { id },
    data: allowed,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      vipUntil: true,
      dnseId: true,
      dnseVerified: true,
      dnseAppliedAt: true,
      chatCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}
