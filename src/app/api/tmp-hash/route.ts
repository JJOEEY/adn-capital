// src/app/api/tmp-hash/route.ts
// TEMP: Tạo bcrypt hash — XÓA SAU KHI DÙNG
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const hash = await bcrypt.hash("admin123", 12);
  return NextResponse.json({ hash });
}
