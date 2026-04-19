import { NextRequest, NextResponse } from "next/server";
import { getPythonBridgeUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

function buildBridgeUrl(req: NextRequest) {
  const path = req.nextUrl.pathname.replace("/api/bridge", "");
  const search = req.nextUrl.search;
  return `${getPythonBridgeUrl()}${path}${search}`;
}

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(buildBridgeUrl(req), {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bridge request failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(buildBridgeUrl(req), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bridge request failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 502 },
    );
  }
}

