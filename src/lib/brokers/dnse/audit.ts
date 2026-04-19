import { prisma } from "@/lib/prisma";

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ error: "audit_payload_serialize_failed" });
  }
}

export async function writeDnseExecutionAudit(args: {
  action: string;
  description: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sanitizedPayload = {
    actorUserId: args.actorUserId ?? null,
    targetUserId: args.targetUserId ?? null,
    ...args.payload,
  };

  await prisma.changelog.create({
    data: {
      component: "DNSE_EXECUTION",
      action: args.action,
      description: args.description,
      author: args.actorUserId ?? "system",
      diff: safeJson(sanitizedPayload),
    },
  });
}
