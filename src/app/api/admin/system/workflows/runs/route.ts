import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";
import { getWorkflowRunWhereInput } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function parseJsonObject(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseListParam(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const ok = await isAdmin();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflowKey = req.nextUrl.searchParams.get("workflowKey") ?? "";
  const statusList = parseListParam(req.nextUrl.searchParams.get("status"));
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  const rows = await prisma.cronLog.findMany({
    where: getWorkflowRunWhereInput({
      workflowKey: workflowKey || undefined,
      status: statusList.length > 0 ? statusList : undefined,
    }),
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      cronName: true,
      status: true,
      message: true,
      duration: true,
      resultData: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    now: new Date().toISOString(),
    count: rows.length,
    runs: rows.map((row) => ({
      id: row.id,
      workflowKey: row.cronName.replace(/^workflow:/, ""),
      status: row.status,
      message: row.message,
      duration: row.duration,
      createdAt: row.createdAt.toISOString(),
      execution: parseJsonObject(row.resultData),
    })),
  });
}

