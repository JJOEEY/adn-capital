/**
 * Mở rộng kiểu NextAuth – thêm role, systemRole, vipUntil, id vào session.user
 */

import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    systemRole?: string;
    vipUntil?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      systemRole: string;
      vipUntil: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    systemRole?: string;
    vipUntil?: string | null;
  }
}
