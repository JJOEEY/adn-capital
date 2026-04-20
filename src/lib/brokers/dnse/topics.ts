import { invalidateTopics } from "@/lib/datahub/core";
import { prisma } from "@/lib/prisma";

export type DnseBrokerChannel =
  | "accounts"
  | "positions"
  | "orders"
  | "balance"
  | "holdings"
  | "loan-packages"
  | "order-history";

export function buildDnseBrokerTopicKeys(connectionId: string): string[] {
  const channels: DnseBrokerChannel[] = [
    "accounts",
    "positions",
    "orders",
    "balance",
    "holdings",
    "loan-packages",
    "order-history",
  ];
  return channels.map((channel) => `broker:dnse:${connectionId}:${channel}`);
}

export function buildDnseBrokerTopicKeysV2(userId: string, accountId: string): string[] {
  const channels: DnseBrokerChannel[] = [
    "accounts",
    "positions",
    "orders",
    "balance",
    "holdings",
    "loan-packages",
    "order-history",
  ];
  return channels.map((channel) => `broker:dnse:${userId}:${accountId}:${channel}`);
}

export function buildDnseCurrentUserAliasTopicKeys(): string[] {
  return [
    "broker:dnse:current-user:accounts",
    "broker:dnse:current-user:positions",
    "broker:dnse:current-user:orders",
    "broker:dnse:current-user:balance",
    "broker:dnse:current-user:holdings",
    "broker:dnse:current-user:loan-packages",
    "broker:dnse:current-user:order-history",
  ];
}

export async function invalidateDnseBrokerTopicsForUser(userId: string) {
  const [user, connection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { dnseId: true },
    }),
    prisma.dnseConnection.findUnique({
      where: { userId },
      select: { accountId: true, status: true },
    }),
  ]);
  const connectionId =
    connection?.status === "ACTIVE"
      ? connection.accountId.trim()
      : (user?.dnseId?.trim() ?? "");
  const topics = [
    ...buildDnseCurrentUserAliasTopicKeys(),
    ...(connectionId ? buildDnseBrokerTopicKeysV2(userId, connectionId) : []),
    ...(connectionId ? buildDnseBrokerTopicKeys(connectionId) : []),
  ];
  if (topics.length === 0) return { removed: 0, remaining: 0 };
  return invalidateTopics({ topics, tags: ["broker", "dnse"] });
}
