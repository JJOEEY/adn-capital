import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type DnseAccountContext = {
  userId: string;
  accountNo: string;
};

type DnseAccountContextResult =
  | { ok: true; context: DnseAccountContext }
  | { ok: false; response: NextResponse };

function normalizeAccountNo(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export async function requireDnseAccountContext(): Promise<DnseAccountContextResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const [user, connection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        dnseId: true,
        dnseVerified: true,
      },
    }),
    prisma.dnseConnection.findUnique({
      where: { userId },
      select: {
        accountId: true,
        status: true,
      },
    }),
  ]);

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 }),
    };
  }

  const activeConnectionAccountNo =
    connection?.status === "ACTIVE" ? normalizeAccountNo(connection.accountId) : "";
  const fallbackUserAccountNo = normalizeAccountNo(user.dnseId);
  const accountNo = activeConnectionAccountNo || fallbackUserAccountNo;

  if (!accountNo) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Chưa liên kết tài khoản DNSE" },
        { status: 404 },
      ),
    };
  }

  if (!user.dnseVerified && !activeConnectionAccountNo) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tài khoản DNSE chưa xác minh" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId,
      accountNo,
    },
  };
}
