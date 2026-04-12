import { NextRequest, NextResponse } from "next/server";

/**
 * GET/POST /api/bridge/[...path]
 * Proxy request từ browser sang fiinquant bridge (port 8000) qua Docker network nội bộ.
 * Browser không thể gọi port 8000 trực tiếp (firewall DROP).
 * Server-side Next.js có thể gọi fiinquant:8000 qua Docker network.
 */

const BRIDGE_INTERNAL = process.env.FIINQUANT_URL ?? "http://fiinquant:8000";

async function proxyRequest(req: NextRequest, path: string[]): Promise<NextResponse> {
  const targetPath = path.join("/");
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${BRIDGE_INTERNAL}/${targetPath}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const init: RequestInit = {
      method: req.method,
      headers: { "Content-Type": "application/json" },
    };
    if (req.method === "POST") {
      init.body = await req.text();
    }

    const res = await fetch(targetUrl, init);
    const data = await res.json();

    return NextResponse.json(data, {
      status: res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`[Bridge Proxy] Error proxying ${targetUrl}:`, error);
    return NextResponse.json(
      { error: "Bridge không phản hồi. Thử lại sau." },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(req, path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(req, path);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
