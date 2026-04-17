import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PYTHON_API = "http://localhost:8000/api/v1";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNewsPayload(type: "morning" | "eod", raw: unknown) {
  if (type !== "eod" || typeof raw !== "object" || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  const liquidity =
    toNumber(data.liquidity) ??
    toNumber(data.total_volume) ??
    toNumber(data.totalVolume) ??
    toNumber(data.total_value) ??
    toNumber(data.totalValue) ??
    0;

  return {
    ...data,
    liquidity,
    liquidity_detail:
      (typeof data.liquidity_detail === "string" && data.liquidity_detail.trim()) ||
      (liquidity > 0 ? `Thanh khoản toàn thị trường đạt ${Math.round(liquidity).toLocaleString("vi-VN")} tỷ đồng.` : ""),
  };
}

/**
 * GET /api/news?type=morning|eod
 * Proxy to Python backend for Gemini-powered market news.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "morning";

  if (!["morning", "eod"].includes(type)) {
    return NextResponse.json({ error: "type phải là 'morning' hoặc 'eod'" }, { status: 400 });
  }

  try {
    const res = await fetch(`${PYTHON_API}/news/${type}`, {
      signal: AbortSignal.timeout(30_000), // Gemini có thể mất 10-20s
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `Python backend trả lỗi: ${errText}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(normalizeNewsPayload(type as "morning" | "eod", data));
  } catch (error) {
    console.error(`[/api/news?type=${type}] Error:`, error);
    return NextResponse.json(
      { error: "Không thể tải tin tức. Python backend có thể chưa chạy." },
      { status: 502 },
    );
  }
}
