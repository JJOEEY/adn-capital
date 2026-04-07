import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const registrations = await prisma.courseRegistration.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(registrations);
}
