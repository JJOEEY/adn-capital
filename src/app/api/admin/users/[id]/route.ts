import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

/**
 * PATCH /api/admin/users/[id] — Cập nhật user (role, systemRole, vipUntil, dnseVerified...)
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
  if (body.systemRole !== undefined) allowed.systemRole = body.systemRole;
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
      systemRole: true,
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
