import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import type { OrderIntent, ParseIntentRequest } from "@/types/dnse-execution";

export type ExecutionUserContext = {
  user: User;
  approvedConnectionId: string | null;
  dnseVerified: boolean;
  oauthLinked: boolean;
};

export async function requireExecutionUserContext(): Promise<ExecutionUserContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) return null;

  const connection = await prisma.dnseConnection.findUnique({
    where: { userId },
    select: { accountId: true, status: true },
  });
  const approvedConnectionId =
    connection?.status === "ACTIVE"
      ? connection.accountId.trim()
      : (user.dnseId?.trim() || null);

  return {
    user,
    approvedConnectionId,
    dnseVerified: Boolean(user.dnseVerified),
    oauthLinked: Boolean(connection?.status === "ACTIVE"),
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseIntentRequestBody(body: unknown): ParseIntentRequest {
  const row = toRecord(body) ?? {};
  const intent = toRecord(row.intent) as Partial<OrderIntent> | undefined;
  const metadata = toRecord(row.metadata);
  const sourceRaw = typeof row.source === "string" ? row.source.trim().toLowerCase() : "";
  const source = sourceRaw === "manual" || sourceRaw === "hybrid" || sourceRaw === "ai" ? sourceRaw : undefined;
  const requestInsight = typeof row.requestInsight === "boolean" ? row.requestInsight : undefined;
  return {
    text: typeof row.text === "string" ? row.text : undefined,
    intent,
    source,
    metadata: metadata ?? undefined,
    requestInsight,
  };
}
