import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscribeTicks } from "@/lib/providers/dnse/tick-hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE đẩy tick DNSE LIVE (PLAN B: singleton WS thường trú fan-out) → client. Flag-gated, default OFF.
// Bật: env SSE_TICK_STREAM_ENABLED=true. Tick chỉ chảy trong phiên 9:00–14:45. Giá đã scale VND.
const HEARTBEAT_MS = 10_000;
const MAX_SYMBOLS = 50;

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function ev(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  if (process.env.SSE_TICK_STREAM_ENABLED !== "true") {
    return NextResponse.json({ error: "SSE tick stream disabled" }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          /* controller đã đóng */
        }
      };

      const unsub = subscribeTicks(symbols, (tick) => {
        safeEnqueue(ev("tick", { ts: Date.now(), ticks: { [tick.ticker]: tick } }));
      });

      const heartbeat = setInterval(() => safeEnqueue(`: keepalive ${Date.now()}\n\n`), HEARTBEAT_MS);

      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        unsub();
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
