import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.customerDiscountRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ requests });
}
