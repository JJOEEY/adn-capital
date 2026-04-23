import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptDnseToken } from "@/lib/brokers/dnse/crypto";
import {
  DNSE_SESSION_EXP_COOKIE,
  DNSE_SESSION_TOKEN_COOKIE,
} from "@/lib/brokers/dnse/session";

export type DnseAccountContext = {
  userId: string;
  accountNo: string;
  brokerAccountNo: string;
  subAccountId: string | null;
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
        subAccountId: true,
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
  const activeConnectionSubAccountNo =
    connection?.status === "ACTIVE" ? normalizeAccountNo(connection.subAccountId) : "";
  const fallbackUserAccountNo = normalizeAccountNo(user.dnseId);
  const accountNo = activeConnectionAccountNo || fallbackUserAccountNo;
  const brokerAccountNo =
    activeConnectionSubAccountNo || activeConnectionAccountNo || fallbackUserAccountNo;

  console.log("[DNSE Shared] Context data", {
    userId,
    activeConnectionAccountNo,
    activeConnectionSubAccountNo,
    fallbackUserAccountNo,
    accountNo,
    brokerAccountNo,
    dnseVerified: user.dnseVerified,
    connectionStatus: connection?.status ?? null,
  });

  if (!accountNo || !brokerAccountNo) {
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
        brokerAccountNo,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  if (!userJwtToken) {
    try {
      const store = await cookies();
      const dnseSessionToken = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
      const expiresAtRaw = store.get(DNSE_SESSION_EXP_COOKIE)?.value?.trim() || "";
      const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
      const hasValidCookieSession =
        Boolean(dnseSessionToken) &&
        Boolean(expiresAt) &&
        !Number.isNaN(expiresAt?.getTime() ?? Number.NaN) &&
        (expiresAt?.getTime() ?? 0) > Date.now();

      if (hasValidCookieSession) {
        userJwtToken = dnseSessionToken;
      }
    } catch {
      // No request cookie context available.
    }
  }

  return {
    ok: true,
    context: {
      userId,
      accountNo,
      brokerAccountNo,
      subAccountId: connection?.subAccountId?.trim() || null,
      userJwtToken,
    },
  };
}
