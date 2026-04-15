import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — Lấy danh sách tất cả users
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
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
      receivedEntitlements: {
        where: {
          status: "ACTIVE",
        },
        orderBy: [{ grantedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          badge: true,
          durationDays: true,
          grantedAt: true,
          expiresAt: true,
          status: true,
          grantedByAdmin: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
