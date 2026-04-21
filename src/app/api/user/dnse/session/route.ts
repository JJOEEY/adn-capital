import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

function getDnseBaseUrls() {
  const envBaseUrls = (process.env.DNSE_TRADING_BASE_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const baseFromEnv = process.env.DNSE_TRADING_BASE_URL?.trim();
  return [
    ...envBaseUrls,
    ...(baseFromEnv ? [baseFromEnv] : []),
    "https://api.dnse.com.vn",
    "https://openapi.dnse.com.vn",
  ]
    .map((base) => base.replace(/\/+$/, ""))
    .filter((value, index, arr) => arr.indexOf(value) === index);
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

  const loginUrls = [
    process.env.DNSE_AUTH_LOGIN_URL?.trim(),
    ...getDnseBaseUrls().flatMap((base) => [
      `${base}/auth-service/login`,
      `${base}/auth-service/api/login`,
    ]),
  ].filter(Boolean) as string[];
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
        const reason =
          readString(toRecord(payload) ?? {}, ["message", "error", "detail", "msg"]) ??
          `HTTP_${response.status}`;
        lastError = reason;
        continue;
      }

      const token = extractDnseAccessToken(payload);
      if (!token) {
        lastError = "DNSE không trả access token hợp lệ.";
        continue;
      }

      const expiresAt = extractDnseTokenExpiry(payload);
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
    {
      error: `Đăng nhập DNSE thất bại: ${lastError}`,
    },
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
