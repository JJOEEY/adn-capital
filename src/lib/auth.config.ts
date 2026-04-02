/**
 * Cấu hình NextAuth v5 dùng chung – KHÔNG chứa Prisma (chạy được ở Edge Runtime).
 * Middleware import file này, còn auth.ts sẽ mở rộng thêm PrismaAdapter.
 */

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/auth",
    error: "/auth",
  },

  callbacks: {
    authorized({ auth: session }) {
      return !!session;
    },
  },
} satisfies NextAuthConfig;
