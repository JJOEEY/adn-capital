import { prisma } from "@/lib/prisma";
import type { DnseOrderSnapshot } from "./adapter";

type HistoryQuery = {
  userId: string;
  connectionId: string;
  limit?: number;
};

function safeParseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toSnapshot(raw: Record<string, unknown> | null): DnseOrderSnapshot | null {
  if (!raw) return null;
  const order = raw.order as Record<string, unknown> | undefined;
  if (!order) return null;
  const intentId = typeof order.intentId === "string" ? order.intentId : "";
  if (!intentId) return null;

  return {
    intentId,
    previewId: typeof order.previewId === "string" ? order.previewId : null,
    accountId: typeof order.accountId === "string" ? order.accountId : "",
    ticker: typeof order.ticker === "string" ? order.ticker : "",
    side: typeof order.side === "string" ? order.side : "",
    quantity: typeof order.quantity === "number" ? order.quantity : 0,
    orderType: typeof order.orderType === "string" ? order.orderType : "",
    price: typeof order.price === "number" ? order.price : null,
    status: typeof order.status === "string" ? order.status : "error",
    brokerOrderId: typeof order.brokerOrderId === "string" ? order.brokerOrderId : null,
    warnings: Array.isArray(order.warnings) ? order.warnings.map((item) => String(item)) : [],
    errors: Array.isArray(order.errors) ? order.errors.map((item) => String(item)) : [],
    submittedAt: typeof order.submittedAt === "string" ? order.submittedAt : null,
    source: typeof order.source === "string" ? order.source : "safe-adapter",
  };
}

export async function listDnseOrderHistory(args: HistoryQuery): Promise<DnseOrderSnapshot[]> {
  const rows = await prisma.changelog.findMany({
    where: {
      component: "DNSE_EXECUTION",
      action: {
        in: [
          "submit_accepted",
          "submit_rejected",
          "submit_error",
          "submit_degraded",
          "submit_blocked_not_enabled",
          "submit_approval_required",
        ],
      },
      OR: [{ author: args.userId }],
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(args.limit ?? 50, 200)),
    select: {
      diff: true,
      createdAt: true,
    },
  });

  const snapshots: DnseOrderSnapshot[] = [];
  for (const row of rows) {
    const parsed = safeParseJson(row.diff);
    if (!parsed) continue;
    if (parsed.targetUserId != null && String(parsed.targetUserId) !== args.userId) continue;
    const order = toSnapshot(parsed);
    if (!order) continue;
    if (order.accountId && order.accountId !== args.connectionId) continue;
    if (!order.submittedAt) {
      order.submittedAt = row.createdAt.toISOString();
    }
    snapshots.push(order);
  }

  return snapshots;
}
