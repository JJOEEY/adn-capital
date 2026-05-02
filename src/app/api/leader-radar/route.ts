import { NextRequest, NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { buildTopicContext } from "@/lib/datahub/producer-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const context = await buildTopicContext({ force });
  const envelope = await getTopicEnvelope("signal:leader-radar", context);

  if (envelope.value) {
    return NextResponse.json(envelope.value, {
      status: envelope.freshness === "fresh" ? 200 : 206,
      headers: {
        "x-data-freshness": envelope.freshness,
      },
    });
  }

  return NextResponse.json(
    {
      error: "Khong lay duoc du lieu Leader Radar",
      freshness: envelope.freshness,
      updatedAt: envelope.updatedAt,
    },
    { status: 503 },
  );
}
