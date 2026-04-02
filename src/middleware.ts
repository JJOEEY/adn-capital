/**
 * Middleware NextAuth v5 – Bảo vệ các route cần đăng nhập.
 * Import từ auth.config.ts (edge-safe, không dùng Prisma).
 */

import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Chỉ chạy middleware trên route dashboard (cần đăng nhập).
  // Bỏ qua ảnh, file tĩnh, favicon, API auth...
  matcher: ["/dashboard/:path*"],
};
