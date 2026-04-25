import { NextResponse } from "next/server";
import { getAppReleasePayload } from "@/lib/appReleases";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = getAppReleasePayload();
  return NextResponse.json({
    latest: payload.latest,
    minSupportedVersion: payload.minSupportedVersion,
    generatedAt: payload.generatedAt,
  });
}
