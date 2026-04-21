import type { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

export const DNSE_SESSION_TOKEN_COOKIE = "adn_dnse_session_token";
export const DNSE_SESSION_EXP_COOKIE = "adn_dnse_session_exp";

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

function readNumber(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function extractDnseAccessToken(payload: unknown): string | null {
  const root = toRecord(payload);
  if (!root) return null;
  const nested = toRecord(root.data);
  return (
    readString(root, ["accessToken", "token", "jwt", "idToken"]) ??
    readString(nested ?? {}, ["accessToken", "token", "jwt", "idToken"])
  );
}

export function extractDnseTokenExpiry(payload: unknown): Date {
  const now = Date.now();
  const root = toRecord(payload);
  const nested = toRecord(root?.data);
  const expiresInSeconds =
    readNumber(root ?? {}, ["expiresIn", "expires_in", "expireIn", "expire_in"]) ??
    readNumber(nested ?? {}, ["expiresIn", "expires_in", "expireIn", "expire_in"]);
  if (expiresInSeconds && expiresInSeconds > 0) {
    return new Date(now + expiresInSeconds * 1_000);
  }

  const expiresAtRaw =
    readString(root ?? {}, ["expiresAt", "expires_at", "expirationTime"]) ??
    readString(nested ?? {}, ["expiresAt", "expires_at", "expirationTime"]);
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date(now + 8 * 60 * 60 * 1_000);
}

function buildCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function setDnseSessionCookies(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(DNSE_SESSION_TOKEN_COOKIE, token, buildCookieOptions(expiresAt));
  response.cookies.set(DNSE_SESSION_EXP_COOKIE, expiresAt.toISOString(), buildCookieOptions(expiresAt));
}

export function clearDnseSessionCookies(response: NextResponse) {
  const expired = new Date(0);
  response.cookies.set(DNSE_SESSION_TOKEN_COOKIE, "", buildCookieOptions(expired));
  response.cookies.set(DNSE_SESSION_EXP_COOKIE, "", buildCookieOptions(expired));
}
