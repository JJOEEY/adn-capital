/**
 * API Đăng ký tài khoản mới (email + password).
 * POST /api/auth/register
 * Body: { email, password, name? }
 */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email as string)?.trim().toLowerCase();
    const password = body.password as string;
    const name = (body.name as string)?.trim() || null;

    // ── Validate ──────────────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email và mật khẩu không được để trống" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 },
      );
    }

    // ── Kiểm tra email đã tồn tại ────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email này đã được đăng ký" },
        { status: 409 },
      );
    }

    // ── Hash mật khẩu + tạo user ─────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "FREE",
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Đăng ký thành công! Vui lòng đăng nhập.",
      userId: user.id,
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra, vui lòng thử lại" },
      { status: 500 },
    );
  }
}
