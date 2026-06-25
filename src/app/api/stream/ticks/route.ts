import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabaseRadarTicks } from "@/lib/database/radar-realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE đẩy tick DNSE (đã thu qua cron radar.realtime.tick) → client. Flag-gated, default OFF.
// Bật bằng env SSE_TICK_STREAM_ENABLED=true. Độ tươi = chu kỳ thu tick (cron); push thay đổi mỗi 3s.
const PUSH_MS = 3_000;
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
  const wanted = new Set(
    (url.searchParams.get("symbols") || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_SYMBOLS),
  );

  let cleanup: (() => void) | null = null;
  const lastSent: Record<string, string> = {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;

      const push = async () => {
        if (closed) return;
        try {
          const { prices } = await getDatabaseRadarTicks(2 * 60_000); // tick <= 2 phút
          const out: Record<string, unknown> = {};
          for (const [sym, t] of Object.entries(prices)) {
            if (wanted.size && !wanted.has(sym)) continue;
            if (lastSent[sym] === t.updatedAt) continue; // chỉ đẩy khi tick đổi
            lastSent[sym] = t.updatedAt;
            out[sym] = t;
          }
          if (Object.keys(out).length) {
            controller.enqueue(enc.encode(ev("tick", { ts: Date.now(), ticks: out })));
          }
        } catch {
          controller.enqueue(enc.encode(ev("error", { message: "tick fetch error" })));
        }
      };

      await push();
      const interval = setInterval(push, PUSH_MS);
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(enc.encode(`: keepalive ${Date.now()}\n\n`));
      }, HEARTBEAT_MS);

      cleanup = () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
