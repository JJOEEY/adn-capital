import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptDnseToken } from "@/lib/brokers/dnse/crypto";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import {
  DNSE_SESSION_EXP_COOKIE,
  DNSE_SESSION_TOKEN_COOKIE,
  clearDnseSessionCookies,
  extractDnseAccessToken,
  extractDnseTokenExpiry,
  setDnseSessionCookies,
} from "@/lib/brokers/dnse/session";

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value) return value;
  }
  return null;
}

function normalizeBearerToken(token: string) {
  return token.trim().replace(/^Bearer\s+/i, "").trim();
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function normalizeBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "");
}

function getDnseAuthLoginUrls() {
  const envAuthBaseUrls = (
    process.env.DNSE_AUTH_BASE_URLS ??
    process.env.DNSE_AUTH_BASE_URL ??
    ""
  )
    .split(",")
    .map((item) => normalizeBaseUrl(item))
    .filter(Boolean);

  return uniqueStrings([
    process.env.DNSE_AUTH_LOGIN_URL,
    ...envAuthBaseUrls.flatMap((base) => [
      `${base}/auth-service/login`,
      `${base}/auth-service/api/login`,
    ]),
    // Login/password uses DNSE auth-service. OpenAPI is for HMAC trading APIs.
    "https://api.dnse.com.vn/auth-service/login",
    "https://api.dnse.com.vn/auth-service/api/login",
    "https://services.entrade.com.vn/auth-service/login",
    "https://services.entrade.com.vn/auth-service/api/login",
  ]);
}

function getSessionShape(req: NextRequest) {
  const token = req.cookies.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
  const expiresAtRaw = req.cookies.get(DNSE_SESSION_EXP_COOKIE)?.value?.trim() || "";
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const active = Boolean(
    token &&
      expiresAt &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() > Date.now(),
  );
  return {
    active,
    expiresAt: active && expiresAt ? expiresAt.toISOString() : null,
  };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getSessionShape(req));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { username?: unknown; password?: unknown }
    | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Thiếu tên đăng nhập hoặc mật khẩu DNSE." },
      { status: 400 },
    );
  }

  const loginUrls = getDnseAuthLoginUrls();
  const apiKey = process.env.DNSE_API_KEY?.trim() || "";
  let lastError = "Không thể đăng nhập DNSE.";

  for (const url of loginUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-KEY": apiKey, "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        lastError =
          readString(toRecord(payload) ?? {}, ["message", "error", "detail", "msg"]) ??
          `HTTP_${response.status}`;
        console.warn("[DNSE Session] login endpoint failed", {
          host: new URL(url).host,
          path: new URL(url).pathname,
          status: response.status,
          message: lastError,
        });
        continue;
      }

      const rawToken = extractDnseAccessToken(payload);
      const token = rawToken ? normalizeBearerToken(rawToken) : "";
      if (!token) {
        lastError = "DNSE không trả access token hợp lệ.";
        continue;
      }

      // Verify token immediately to avoid false-success before the account-link step.
      try {
        const verifyClient = getDnseTradingClient({ userJwtToken: token, isolated: true });
        await verifyClient.getAccounts();
      } catch (verifyError) {
        lastError =
          verifyError instanceof Error
            ? `Phiên DNSE không hợp lệ: ${verifyError.message}`
            : "Phiên DNSE không hợp lệ.";
        continue;
      }

      const expiresAt = extractDnseTokenExpiry(payload);
      try {
        const existingConnection = await prisma.dnseConnection.findUnique({
          where: { userId: session.user.id },
          select: {
            userId: true,
            accountId: true,
            status: true,
          },
        });

        if (existingConnection?.accountId && existingConnection.status === "ACTIVE") {
          const encryptedToken = encryptDnseToken(token);
          await prisma.dnseConnection.update({
            where: { userId: session.user.id },
            data: {
              accessTokenEnc: encryptedToken,
              tokenType: "Bearer",
              scope: "lightspeed",
              accessTokenExpiresAt: expiresAt,
              lastError: null,
            },
          });
        }
      } catch (syncError) {
        console.warn("[DNSE Session] unable to refresh stored linked token", {
          userId: session.user.id,
          message: syncError instanceof Error ? syncError.message : "unknown_error",
        });
      }

      const next = NextResponse.json({
        success: true,
        active: true,
        expiresAt: expiresAt.toISOString(),
      });
      setDnseSessionCookies(next, token, expiresAt);
      return next;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Lỗi kết nối DNSE.";
    }
  }

  return NextResponse.json(
    { error: `Đăng nhập DNSE thất bại: ${lastError}` },
    { status: 502 },
  );
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const next = NextResponse.json({ success: true });
  clearDnseSessionCookies(next);
  return next;
}
