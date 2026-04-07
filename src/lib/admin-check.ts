import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Kiểm tra user hiện tại có phải ADMIN không (dựa trên systemRole trong DB).
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  });
  return dbUser?.systemRole === "ADMIN";
}
