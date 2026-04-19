import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { buildTopicContext } from "@/lib/datahub/producer-context";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ topic: string[] }> },
) {
  const resolved = await params;
  const topicKey = (resolved.topic ?? []).join("/");
  if (!topicKey) {
    return NextResponse.json({ error: "Missing topic key" }, { status: 400 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const context = await buildTopicContext({ force });
  const envelope = await getTopicEnvelope(topicKey, context);
  const errorCode = envelope.error?.code;

  if (errorCode === "unauthorized") {
    return NextResponse.json(envelope, { status: 401 });
  }
  if (errorCode === "topic_not_found") {
    return NextResponse.json(envelope, { status: 404 });
  }

  return NextResponse.json(envelope, {
    status: envelope.freshness === "error" ? 503 : envelope.freshness === "fresh" ? 200 : 206,
  });
}
