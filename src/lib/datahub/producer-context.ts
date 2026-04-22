import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  DNSE_SESSION_EXP_COOKIE,
  DNSE_SESSION_TOKEN_COOKIE,
} from "@/lib/brokers/dnse/session";
import { TopicContext } from "./types";

export async function buildTopicContext(base?: TopicContext): Promise<TopicContext> {
  if (base?.userId && base?.dnseSessionToken !== undefined) return base;

  const session = await auth();
  let dnseSessionToken = base?.dnseSessionToken ?? null;
  let dnseSessionExpiresAt = base?.dnseSessionExpiresAt ?? null;

  try {
    const store = await cookies();
    const token = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
    const expiresAtRaw = store.get(DNSE_SESSION_EXP_COOKIE)?.value?.trim() || "";
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const hasValidSession =
      Boolean(token) &&
      Boolean(expiresAt) &&
      !Number.isNaN(expiresAt?.getTime() ?? Number.NaN) &&
      (expiresAt?.getTime() ?? 0) > Date.now();

    if (hasValidSession) {
      dnseSessionToken = token;
      dnseSessionExpiresAt = expiresAt?.toISOString() ?? null;
    }
  } catch {
    // No request cookie context available.
  }

  return {
    ...base,
    userId: session?.user?.id ?? null,
    userRole: session?.user?.role ?? null,
    systemRole: session?.user?.systemRole ?? null,
    dnseSessionToken,
    dnseSessionExpiresAt,
  };
}
