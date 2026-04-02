import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function isAdmin() {
  const session = await auth();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email.toLowerCase());
}

/** GET /api/admin/margin — Lấy danh sách tư vấn ký quỹ */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const rows = await prisma.marginConsultation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rows);
}

/** PATCH /api/admin/margin?id=xxx — Cập nhật status */
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json() as { status?: string; note?: string };
  const updated = await prisma.marginConsultation.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.note !== undefined && { note: body.note }),
    },
  });

  return NextResponse.json(updated);
}
