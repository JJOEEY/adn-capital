import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelopes } from "@/lib/datahub/core";
import { buildTopicContext } from "@/lib/datahub/producer-context";
import { listTopicDefinitions } from "@/lib/datahub/registry";

export const dynamic = "force-dynamic";

type Body = {
  topics?: string[];
  force?: boolean;
};

const MAX_BATCH_TOPICS = 40;

function normalizeTopicList(input: unknown) {
  const topics = Array.isArray(input)
    ? input
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  return Array.from(new Set(topics));
}

export async function GET() {
  const items = listTopicDefinitions();
  return NextResponse.json({
    count: items.length,
    items,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topics = normalizeTopicList(body.topics);

  if (topics.length === 0) {
    return NextResponse.json({ error: "topics is required" }, { status: 400 });
  }
  if (topics.length > MAX_BATCH_TOPICS) {
    return NextResponse.json(
      { error: `Too many topics in one request (max ${MAX_BATCH_TOPICS})` },
      { status: 400 },
    );
  }

  const context = await buildTopicContext({ force: body.force === true });
  const items = await getTopicEnvelopes(topics, context);

  return NextResponse.json({
    count: items.length,
    items,
    generatedAt: new Date().toISOString(),
  });
}
