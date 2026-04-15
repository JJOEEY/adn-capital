import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 15_000;

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function serializeEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bridgeUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || "http://localhost:3000";

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const pushSnapshot = async () => {
        try {
          const marketRes = await fetch(`${bridgeUrl}/api/market`, { cache: "no-store" });
          if (!marketRes.ok) {
            controller.enqueue(
              encoder.encode(serializeEvent("error", { status: marketRes.status, message: "market fetch failed" }))
            );
            return;
          }
          const market = await marketRes.json();
          controller.enqueue(encoder.encode(serializeEvent("market", market)));
        } catch {
          controller.enqueue(
            encoder.encode(serializeEvent("error", { message: "market stream fetch error" }))
          );
        }
      };

      await pushSnapshot();

      const interval = setInterval(async () => {
        if (closed) return;
        await pushSnapshot();
      }, HEARTBEAT_MS);

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, 10_000);

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

  return new Response(stream, {
    headers: sseHeaders(),
  });
}
