import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, zalo } = await req.json();

    if (
      !name ||
      typeof name !== "string" ||
      !zalo ||
      typeof zalo !== "string"
    ) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc" },
        { status: 400 }
      );
    }

    if (name.length > 100 || zalo.length > 15) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const registration = await prisma.courseRegistration.create({
      data: {
        name: name.trim(),
        zalo: zalo.trim(),
      },
    });

    return NextResponse.json({ ok: true, id: registration.id });
  } catch {
    return NextResponse.json(
      { error: "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
