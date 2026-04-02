import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BACKEND = process.env.FIINQUANT_URL ?? "http://localhost:8000";

/**
 * POST /api/scan-now — Proxy tới Python backend để chạy quét tín hiệu
 * Chỉ cho phép VIP / ADMIN
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/scan-now`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000), // scanner có thể mất 1-2 phút
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/scan-now] Backend error:", res.status, text);
      return NextResponse.json(
        { error: "Lỗi quét tín hiệu" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/scan-now] Error:", err);
    return NextResponse.json(
      { error: "Không kết nối được scanner" },
      { status: 502 }
    );
  }
}
