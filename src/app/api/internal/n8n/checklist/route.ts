import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVnDateISO, getVnNow } from "@/lib/time";
import {
  badRequestResponse,
  isN8nAuthorized,
  readJsonBody,
  readString,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";

export const dynamic = "force-dynamic";

type ChecklistStatus = "OPEN" | "DONE" | "BLOCKED";

type ChecklistItem = {
  id: string;
  title: string;
  status: ChecklistStatus;
  dueTime?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  doneAt?: string | null;
};

type ChecklistState = {
  date: string;
  chatId: string;
  items: ChecklistItem[];
  updatedAt: string;
};

type ChecklistBody = {
  chatId?: unknown;
  userId?: unknown;
  username?: unknown;
  text?: unknown;
  action?: unknown;
  task?: unknown;
  index?: unknown;
  date?: unknown;
};

type ParsedAction =
  | { type: "help" }
  | { type: "list"; dateOffset?: number }
  | { type: "summary" }
  | { type: "add"; title: string; status?: ChecklistStatus; dueTime?: string | null; dateOffset?: number }
  | { type: "done"; index?: number; query?: string }
  | { type: "reopen"; index: number }
  | { type: "remove"; index: number }
  | { type: "clearDone" };

function normalizeVietnamese(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function settingKey(chatId: string, date: string) {
  const chatHash = createHash("sha256").update(chatId).digest("hex").slice(0, 24);
  return `n8n.checklist.${date}.${chatHash}`;
}

function todayWithOffset(offset = 0) {
  return getVnNow().add(offset, "day").format("YYYY-MM-DD");
}

function parseIndex(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function cleanTitle(value: string) {
  return value
    .replace(/^[:\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function parseDueTime(value: string) {
  const match = value.match(/\b(\d{1,2})h(?:(\d{2}))?\b/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseAction(body: ChecklistBody): ParsedAction {
  const explicitAction = normalizeVietnamese(readString(body.action));
  const explicitTask = cleanTitle(readString(body.task));
  const explicitIndex = parseIndex(body.index);

  if (explicitAction === "add" && explicitTask) return { type: "add", title: explicitTask };
  if (explicitAction === "done") return { type: "done", index: explicitIndex, query: explicitTask || undefined };
  if (explicitAction === "summary") return { type: "summary" };
  if (explicitAction === "list") return { type: "list" };
  if (explicitAction === "clear_done") return { type: "clearDone" };

  const text = readString(body.text);
  const normalized = normalizeVietnamese(text);
  if (!normalized || normalized === "/start" || normalized === "/help") return { type: "help" };

  const addMatch =
    text.match(/^\/add\s+(.+)$/i) ||
    text.match(/^\/them\s+(.+)$/i) ||
    text.match(/(?:^|\b)(?:thêm việc|them viec|thêm task|them task|add task)\s*[:\-]?\s*(.+)$/i);
  if (addMatch?.[1]) {
    const dueTime = parseDueTime(addMatch[1]);
    return { type: "add", title: cleanTitle(addMatch[1]), dueTime };
  }

  const reminderMatch = text.match(/(?:nhắc tôi|nhac toi)\s+(\d{1,2}h(?:\d{2})?)\s+(.+)$/i);
  if (reminderMatch?.[2]) {
    return {
      type: "add",
      title: cleanTitle(reminderMatch[2]),
      dueTime: parseDueTime(reminderMatch[1]),
    };
  }

  const blockerMatch = text.match(/^(?:\/blocker|kẹt|ket|blocked|vướng|vuong)\s*[:\-]?\s*(.+)$/i);
  if (blockerMatch?.[1]) {
    return { type: "add", title: cleanTitle(blockerMatch[1]), status: "BLOCKED" };
  }

  const doneMatch = normalized.match(/^(?:\/done|done|xong|hoan thanh)\s+#?(\d+)\b/);
  if (doneMatch?.[1]) return { type: "done", index: Number(doneMatch[1]) };

  const doneByText =
    text.match(/^(?:\/done|done|xong|hoàn thành|hoan thanh)\s+(.+)$/i) ||
    text.match(/(?:đã xong|da xong)\s+(.+)$/i);
  if (doneByText?.[1]) return { type: "done", query: cleanTitle(doneByText[1]) };

  const reopenMatch = normalized.match(/^(?:\/reopen|mo lai|chua xong)\s+#?(\d+)\b/);
  if (reopenMatch?.[1]) return { type: "reopen", index: Number(reopenMatch[1]) };

  const removeMatch = normalized.match(/^(?:\/remove|\/delete|xoa|bo)\s+(?:viec\s*)?#?(\d+)\b/);
  if (removeMatch?.[1]) return { type: "remove", index: Number(removeMatch[1]) };

  if (/\b(clear done|xoa viec da xong|don viec da xong)\b/.test(normalized)) return { type: "clearDone" };
  if (/\b(tong ket|summary|bao cao ngay)\b/.test(normalized)) return { type: "summary" };
  if (/\b(ngay mai|tomorrow|ke hoach mai)\b/.test(normalized)) return { type: "list", dateOffset: 1 };
  if (
    /\b(today|checklist|viec hom nay|hom nay can lam gi|con viec|viec nao con ket|danh sach viec)\b/.test(
      normalized,
    )
  ) {
    return { type: "list" };
  }

  return { type: "help" };
}

async function readState(chatId: string, date: string): Promise<ChecklistState> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: settingKey(chatId, date) },
    select: { value: true },
  });
  if (!row?.value) {
    return { date, chatId, items: [], updatedAt: new Date().toISOString() };
  }

  try {
    const parsed = JSON.parse(row.value) as ChecklistState;
    if (!Array.isArray(parsed.items)) throw new Error("invalid items");
    return {
      date,
      chatId,
      items: parsed.items.filter((item) => item && typeof item.title === "string"),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return { date, chatId, items: [], updatedAt: new Date().toISOString() };
  }
}

async function saveState(state: ChecklistState) {
  const value = JSON.stringify({ ...state, updatedAt: new Date().toISOString() });
  await prisma.systemSetting.upsert({
    where: { key: settingKey(state.chatId, state.date) },
    create: { key: settingKey(state.chatId, state.date), value },
    update: { value },
  });
}

function itemLine(item: ChecklistItem, index: number) {
  const marker = item.status === "DONE" ? "xong" : item.status === "BLOCKED" ? "kẹt" : "chờ";
  const time = item.dueTime ? ` (${item.dueTime})` : "";
  return `${index + 1}. [${marker}] ${item.title}${time}`;
}

function renderList(state: ChecklistState) {
  if (state.items.length === 0) {
    return [
      `Checklist ${state.date} đang trống.`,
      "",
      "Anh có thể nhắn:",
      "- /add kiểm tra bản tin sáng",
      "- nhắc tôi 14h kiểm tra ADN Radar",
      "- /blocker crawler tin tức đang lỗi",
    ].join("\n");
  }

  const open = state.items.filter((item) => item.status !== "DONE").length;
  const done = state.items.length - open;
  return [
    `Checklist ${state.date}: ${done}/${state.items.length} việc đã xong.`,
    "",
    ...state.items.map(itemLine),
  ].join("\n");
}

function renderSummary(state: ChecklistState) {
  const done = state.items.filter((item) => item.status === "DONE");
  const blocked = state.items.filter((item) => item.status === "BLOCKED");
  const open = state.items.filter((item) => item.status === "OPEN");

  return [
    `Tổng kết ${state.date}`,
    `- Đã xong: ${done.length}`,
    `- Đang chờ: ${open.length}`,
    `- Đang kẹt: ${blocked.length}`,
    blocked.length ? `\nViệc đang kẹt:\n${blocked.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}` : "",
    open.length ? `\nViệc còn lại:\n${open.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

function renderHelp() {
  return [
    "AIDEN Checklist đã sẵn sàng.",
    "",
    "Lệnh nhanh:",
    "- /today: xem checklist hôm nay",
    "- /add <việc cần làm>: thêm việc",
    "- nhắc tôi 14h <việc cần làm>: thêm việc có giờ",
    "- /done 2: đánh dấu xong việc số 2",
    "- /blocker <vấn đề>: ghi việc đang kẹt",
    "- /summary: tổng kết ngày",
  ].join("\n");
}

function findByQuery(items: ChecklistItem[], query: string) {
  const normalizedQuery = normalizeVietnamese(query);
  return items.findIndex((item) => normalizeVietnamese(item.title).includes(normalizedQuery));
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const parsed = await readJsonBody<ChecklistBody>(req);
  if (!parsed.ok) return parsed.response;

  const chatId = readString(parsed.data.chatId);
  if (!chatId) return badRequestResponse("Missing Telegram chat id");

  const username = readString(parsed.data.username);
  const action = parseAction(parsed.data);
  const targetDate = readString(parsed.data.date) || todayWithOffset("dateOffset" in action ? action.dateOffset ?? 0 : 0);
  const state = await readState(chatId, targetDate || getVnDateISO());
  const now = new Date().toISOString();
  let reply = "";

  if (action.type === "help") {
    reply = renderHelp();
  } else if (action.type === "list") {
    reply = renderList(state);
  } else if (action.type === "summary") {
    reply = renderSummary(state);
  } else if (action.type === "add") {
    const title = cleanTitle(action.title);
    if (!title) return badRequestResponse("Task title is required");
    const item: ChecklistItem = {
      id: randomUUID(),
      title,
      status: action.status ?? "OPEN",
      dueTime: action.dueTime ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: username || null,
    };
    state.items.push(item);
    await saveState(state);
    reply = [`Đã thêm vào checklist ${state.date}:`, itemLine(item, state.items.length - 1), "", renderList(state)].join("\n");
  } else if (action.type === "done") {
    const index =
      typeof action.index === "number"
        ? action.index - 1
        : action.query
          ? findByQuery(state.items, action.query)
          : -1;
    const item = state.items[index];
    if (!item) {
      reply = `Tôi chưa tìm thấy việc cần đánh dấu xong.\n\n${renderList(state)}`;
    } else {
      item.status = "DONE";
      item.updatedAt = now;
      item.doneAt = now;
      await saveState(state);
      reply = [`Đã đánh dấu xong: ${item.title}`, "", renderList(state)].join("\n");
    }
  } else if (action.type === "reopen") {
    const item = state.items[action.index - 1];
    if (!item) {
      reply = `Tôi chưa tìm thấy việc số ${action.index}.\n\n${renderList(state)}`;
    } else {
      item.status = "OPEN";
      item.updatedAt = now;
      item.doneAt = null;
      await saveState(state);
      reply = [`Đã mở lại: ${item.title}`, "", renderList(state)].join("\n");
    }
  } else if (action.type === "remove") {
    const item = state.items[action.index - 1];
    if (!item) {
      reply = `Tôi chưa tìm thấy việc số ${action.index}.\n\n${renderList(state)}`;
    } else {
      state.items.splice(action.index - 1, 1);
      await saveState(state);
      reply = [`Đã xóa khỏi checklist: ${item.title}`, "", renderList(state)].join("\n");
    }
  } else if (action.type === "clearDone") {
    const before = state.items.length;
    state.items = state.items.filter((item) => item.status !== "DONE");
    await saveState(state);
    reply = [`Đã dọn ${before - state.items.length} việc đã xong.`, "", renderList(state)].join("\n");
  }

  await writeN8nLog(
    "n8n:checklist",
    "success",
    `checklist:${action.type}`,
    { chatId, date: state.date, action: action.type, itemCount: state.items.length },
    startedAt,
  );

  return NextResponse.json({
    ok: true,
    chatId,
    date: state.date,
    action: action.type,
    itemCount: state.items.length,
    openCount: state.items.filter((item) => item.status !== "DONE").length,
    text: reply,
  });
}
