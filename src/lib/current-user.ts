/**
 * Helper lấy user hiện tại từ NextAuth session + Prisma DB.
 * Thay thế hoàn toàn clerk-user.ts.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentDbUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  return dbUser;
}
