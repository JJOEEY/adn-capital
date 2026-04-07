import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed = ["status", "vipStatus", "name", "zalo"];
  const data: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string") {
      data[key] = body[key].trim();
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có dữ liệu cập nhật" }, { status: 400 });
  }

  try {
    const updated = await prisma.courseRegistration.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.courseRegistration.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
  }
}
