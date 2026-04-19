import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";
import { getWorkflowDefaultRetryPolicy, getWorkflowDefinitions } from "@/lib/workflows";

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

export async function GET() {
  const ok = await isAdmin();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [definitions, latestRuns, settingRows] = await Promise.all([
    getWorkflowDefinitions(),
    prisma.cronLog.findMany({
      where: { cronName: { startsWith: "workflow:" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        cronName: true,
        status: true,
        message: true,
        duration: true,
        createdAt: true,
        resultData: true,
      },
    }),
    prisma.systemSetting.findMany({
      where: { key: { startsWith: "workflow:" } },
      select: { key: true, value: true, updatedAt: true },
      orderBy: { key: "asc" },
    }),
  ]);

  const latestRunByKey = new Map<string, Record<string, unknown>>();
  for (const row of latestRuns) {
    const workflowKey = row.cronName.replace(/^workflow:/, "");
    if (latestRunByKey.has(workflowKey)) continue;
    latestRunByKey.set(workflowKey, {
      id: row.id,
      workflowKey,
      status: row.status,
      message: row.message,
      duration: row.duration,
      createdAt: row.createdAt.toISOString(),
      execution: parseJsonObject(row.resultData),
    });
  }

  return NextResponse.json({
    now: new Date().toISOString(),
    runtime: {
      owner: "web",
      schedulerOwner: "fiinquant",
      defaultRetryPolicy: getWorkflowDefaultRetryPolicy(),
      notes: [
        "Workflow runtime is event-driven and JSON-first.",
        "Real broker submit remains controlled by deterministic DNSE guards.",
      ],
    },
    definitions: definitions.map((item) => ({
      workflowKey: item.workflowKey,
      title: item.title,
      enabled: item.enabled,
      trigger: item.trigger,
      conditions: item.conditions ?? [],
      actions: item.actions,
      retryPolicy: item.retryPolicy ?? null,
      tags: item.tags ?? [],
      lastRun: latestRunByKey.get(item.workflowKey) ?? null,
    })),
    settings: settingRows.map((row) => ({
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

