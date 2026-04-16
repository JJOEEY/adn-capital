import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const steps = await prisma.landingProcessStep.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ steps });
  } catch (error) {
    console.error("[GET /api/landing-process-steps] error:", error);
    return NextResponse.json({ error: "Không thể tải quy trình landing" }, { status: 500 });
  }
}
