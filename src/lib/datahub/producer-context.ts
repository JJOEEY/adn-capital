import { auth } from "@/lib/auth";
import { TopicContext } from "./types";

export async function buildTopicContext(base?: TopicContext): Promise<TopicContext> {
  if (base?.userId) return base;

  const session = await auth();
  return {
    ...base,
    userId: session?.user?.id ?? null,
    userRole: session?.user?.role ?? null,
    systemRole: session?.user?.systemRole ?? null,
  };
}

