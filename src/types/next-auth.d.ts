/**
 * Mở rộng kiểu NextAuth – thêm role, vipUntil, id vào session.user
 */

import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    vipUntil?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      vipUntil: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    vipUntil?: string | null;
  }
}
