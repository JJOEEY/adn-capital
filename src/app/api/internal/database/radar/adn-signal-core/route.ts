import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { collectAdnSignalCoreRealtime, collectAdnSignalCoreUniverse, getAdnSignalCoreLatest, runAdnSignalCoreScan } from "@/lib/database";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const latest = await getAdnSignalCoreLatest();
  return NextResponse.json({ ok: Boolean(latest), data: latest, missingFields: latest ? [] : ["adn_signal_core.latest"] }, { status: latest ? 200 : 207 });
}

export async function POST(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const action = req.nextUrl.searchParams.get("action") ?? "scan";
  if (action === "universe") {
    const result = await collectAdnSignalCoreUniverse();
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  }
  if (action === "realtime") {
    const result = await collectAdnSignalCoreRealtime({
      timeoutMs: Number(req.nextUrl.searchParams.get("timeoutMs") ?? 45_000),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  }
  const result = await runAdnSignalCoreScan({ slotLabel: "manual", sendTelegram: req.nextUrl.searchParams.get("sendTelegram") === "1" });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
