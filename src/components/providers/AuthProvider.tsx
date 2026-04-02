"use client";

/**
 * SessionProvider cho NextAuth v5.
 * Bọc toàn bộ app để useSession() hoạt động ở client.
 */

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
