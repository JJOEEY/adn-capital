import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptDnseToken } from "@/lib/brokers/dnse/crypto";

export type DnseAccountContext = {
  userId: string;
  accountNo: string;
  userJwtToken: string | null;
};

type DnseAccountContextResult =
  | { ok: true; context: DnseAccountContext }
  | { ok: false; response: NextResponse };

function normalizeAccountNo(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export async function requireDnseAccountContext(): Promise<DnseAccountContextResult> {
  console.log("[DNSE Shared] Resolving account context");

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    console.warn("[DNSE Shared] Unauthorized (no session user)");
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
        accessTokenEnc: true,
        accessTokenExpiresAt: true,
      },
    }),
  ]);

  if (!user) {
    console.error("[DNSE Shared] User not found", { userId });
    return {
      ok: false,
      response: NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 }),
    };
  }

  const activeConnectionAccountNo =
    connection?.status === "ACTIVE" ? normalizeAccountNo(connection.accountId) : "";
  const fallbackUserAccountNo = normalizeAccountNo(user.dnseId);
  const accountNo = activeConnectionAccountNo || fallbackUserAccountNo;

  console.log("[DNSE Shared] Context data", {
    userId,
    activeConnectionAccountNo,
    fallbackUserAccountNo,
    accountNo,
    dnseVerified: user.dnseVerified,
    connectionStatus: connection?.status ?? null,
  });

  if (!accountNo) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Chưa liên kết tài khoản DNSE" }, { status: 404 }),
    };
  }

  if (!user.dnseVerified && !activeConnectionAccountNo) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Tài khoản DNSE chưa xác minh" }, { status: 403 }),
    };
  }

  let userJwtToken: string | null = null;
  const hasActiveLinkedToken =
    Boolean(connection?.accessTokenEnc) &&
    (!connection?.accessTokenExpiresAt || connection.accessTokenExpiresAt.getTime() > Date.now());

  if (hasActiveLinkedToken && connection?.accessTokenEnc) {
    try {
      userJwtToken = decryptDnseToken(connection.accessTokenEnc);
    } catch (error) {
      console.warn("[DNSE Shared] Failed to decrypt linked DNSE token", {
        userId,
        accountNo,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return {
    ok: true,
    context: {
      userId,
      accountNo,
      userJwtToken,
    },
  };
}
