import { NextResponse } from "next/server";
import { getAppReleasePayload } from "@/lib/appReleases";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAppReleasePayload());
}
