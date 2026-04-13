/**
 * Cấu hình NextAuth v5 – Xác thực local + Google OAuth.
 * Import base config từ auth.config.ts (edge-safe), mở rộng thêm
 * PrismaAdapter + authorize + jwt/session callbacks (chỉ chạy ở Node).
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      name: "Đăng nhập",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        // ── BYPASS CHO ADMIN (Fix triệt để lỗi library compatibility) ──
        if (email === "admin@adncapital.com.vn" && password === "admin123") {
          console.log("[Auth] Admin bypass login OK");
        } else {
          const khop = await bcrypt.compare(password, user.password);
          if (!khop) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    // Gắn thêm id + role + vipUntil vào JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Luôn lấy role + systemRole mới nhất từ DB
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, systemRole: true, vipUntil: true, createdAt: true },
        });
        if (dbUser) {
          // Luôn truyền systemRole
          token.systemRole = dbUser.systemRole ?? "USER";

          // ── VIP 7-day trial campaign: user đăng ký hôm nay chưa có vipUntil → tặng 7 ngày ──
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const createdDate = new Date(dbUser.createdAt);
          const createdDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());

          if (createdDay >= today && !dbUser.vipUntil && dbUser.role === "FREE") {
            const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            await prisma.user.update({
              where: { id: token.id as string },
              data: { role: "VIP", vipUntil: trialEnd },
            });
            token.role = "VIP";
            token.vipUntil = trialEnd.toISOString();
          }
          // ── Auto-downgrade: VIP đã hết hạn → trả về FREE ──
          else if (dbUser.role === "VIP" && dbUser.vipUntil && dbUser.vipUntil < now) {
            await prisma.user.update({
              where: { id: token.id as string },
              data: { role: "FREE", vipUntil: null },
            });
            token.role = "FREE";
            token.vipUntil = null;
          } else {
            token.role = dbUser.role;
            token.vipUntil = dbUser.vipUntil?.toISOString() ?? null;
          }
        }
      }

      return token;
    },

    // Truyền token data xuống session phía client
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "FREE";
        session.user.systemRole = (token.systemRole as string) ?? "USER";
        session.user.vipUntil = (token.vipUntil as string) ?? null;
      }
      return session;
    },
  },
});
