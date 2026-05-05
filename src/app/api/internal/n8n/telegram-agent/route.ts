import { NextRequest, NextResponse } from "next/server";
import { runAidenDatahubChat } from "@/lib/aiden/datahub-chat";
import {
  getPublicBaseUrl,
  isN8nAuthorized,
  readJsonBody,
  readString,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";

export const dynamic = "force-dynamic";

type TelegramAgentBody = {
  updateId?: unknown;
  chatId?: unknown;
  userId?: unknown;
  username?: unknown;
  text?: unknown;
  callbackQueryId?: unknown;
  isCallback?: unknown;
};

type OperatorIntent =
  | "checklist"
  | "approval"
  | "news_crawl"
  | "radar_digest"
  | "brief_image"
  | "system_check"
  | "scheduled_notification"
  | "marketing_idea"
  | "aiden"
  | "help";

function normalizeVietnamese(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function classifyIntent(message: string): OperatorIntent {
  const normalized = normalizeVietnamese(message);

  if (!normalized || normalized === "/start" || normalized === "/help") return "help";
  if (
    /^(\/today|\/add|\/done|\/blocker|\/summary|\/tomorrow|\/reopen|\/remove)\b/.test(normalized) ||
    /\b(checklist|viec hom nay|hom nay can lam gi|nhac toi|them viec|xong task|tong ket ngay|viec nao con ket|ke hoach mai)\b/.test(normalized)
  ) {
    return "checklist";
  }
  if (/\b(duyet|approve|xac nhan|publish|dang bai)\b/.test(normalized)) return "approval";
  if (
    /^(\/morning_image|\/eod_image|\/brief_image)\b/.test(normalized) ||
    (/\b(anh|hinh|png|image|xuat anh|gui anh|render anh)\b/.test(normalized) &&
      /\b(ban tin|brief|morning|eod|sang|tong hop|cuoi ngay)\b/.test(normalized))
  ) {
    return "brief_image";
  }
  if (/\b(crawl|tin tuc|seo|bai viet|viet bai)\b/.test(normalized)) return "news_crawl";
  if (/\b(radar|tin hieu|co phieu moi|digest)\b/.test(normalized)) return "radar_digest";
  if (/\b(health|kiem tra he thong|system|cron|loi|stale)\b/.test(normalized)) return "system_check";
  if (/\b(10h|11h30|14h|14h45|thong bao|notification|nhac lich)\b/.test(normalized)) {
    return "scheduled_notification";
  }
  if (/\b(marketing|content|keyword|tu khoa|lich noi dung|ke hoach)\b/.test(normalized)) {
    return "marketing_idea";
  }
  return "aiden";
}

function isAdminChat(chatId: string) {
  const allowed = [
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_CHAT_ID,
    process.env.N8N_TELEGRAM_ADMIN_CHAT_ID,
    process.env.N8N_TELEGRAM_CHECKLIST_CHAT_ID,
    process.env.N8N_TELEGRAM_ALLOWED_CHAT_IDS,
  ]
    .map((value) => (value ?? "").trim())
    .flatMap((value) => value.split(",").map((item) => item.trim()))
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(chatId);
}

function pickSlot(message: string) {
  const normalized = normalizeVietnamese(message);
  if (normalized.includes("11h30")) return "11:30";
  if (normalized.includes("14h45")) return "14:45";
  if (normalized.includes("14h")) return "14:00";
  return "10:00";
}

function pickBriefImageType(message: string): "morning" | "eod" {
  const normalized = normalizeVietnamese(message);
  if (/\b(eod|tong hop|cuoi ngay|ket phien|ban tin toi|evening|close)\b/.test(normalized)) return "eod";
  return "morning";
}

async function callInternalApi<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const baseUrl = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

function buildHelpText() {
  return [
    "AIDEN vận hành đã sẵn sàng.",
    "",
    "Anh có thể nhắn:",
    "- kiểm tra hệ thống",
    "- radar hôm nay",
    "- crawl tin SEO",
    "- gửi thông báo 10h",
    "- top cổ phiếu đáng chú ý hôm nay",
    "- viết kế hoạch content tuần này",
    "",
    "Các hành động public nội dung vẫn cần anh duyệt trước.",
  ].join("\n");
}

function cleanTelegramText(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 3900);
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const parsed = await readJsonBody<TelegramAgentBody>(req);
  if (!parsed.ok) return parsed.response;

  const chatId = readString(parsed.data.chatId);
  const text = readString(parsed.data.text);
  const updateId = readString(parsed.data.updateId);
  const username = readString(parsed.data.username);

  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_CHAT_ID", message: "Missing Telegram chat id" } },
      { status: 400 },
    );
  }

  if (!isAdminChat(chatId)) {
    await writeN8nLog(
      "n8n:telegram-agent",
      "skipped",
      "telegram_chat_not_allowed",
      { chatId, updateId, username },
      startedAt,
    );
    return NextResponse.json({
      ok: true,
      chatId,
      intent: "blocked",
      text: "Kênh này chưa được cấp quyền vận hành ADN Capital.",
      approval: { required: false },
    });
  }

  const intent = classifyIntent(text);
  let reply = "";
  let approval: Record<string, unknown> = { required: false };

  try {
    if (intent === "help") {
      reply = buildHelpText();
    } else if (intent === "checklist") {
      const result = await callInternalApi<Record<string, unknown>>("/api/internal/n8n/checklist", {
        method: "POST",
        body: {
          chatId,
          userId: readString(parsed.data.userId),
          username,
          text,
        },
      });
      reply = result.ok
        ? readString(result.data?.text, "Checklist đã xử lý xong.")
        : `Không xử lý được checklist lúc này. Mã lỗi: ${result.status}.`;
    } else if (intent === "system_check") {
      const result = await callInternalApi<Record<string, unknown>>("/api/internal/n8n/system-check?dryRun=1");
      const issues = Array.isArray(result.data?.issues)
        ? result.data.issues.length
        : (Array.isArray(result.data?.errors) ? result.data.errors.length : 0) +
          (Array.isArray(result.data?.warnings) ? result.data.warnings.length : 0);
      reply = result.ok
        ? `Kiểm tra hệ thống xong. Số cảnh báo hiện tại: ${issues}.\n\nNếu cần gửi cảnh báo thật vào Telegram vận hành, nhắn: gửi health check.`
        : `Không kiểm tra được hệ thống lúc này. Mã lỗi: ${result.status}.`;
    } else if (intent === "radar_digest") {
      const result = await callInternalApi<Record<string, unknown>>("/api/internal/n8n/radar-digest?limit=8");
      const signals = Array.isArray(result.data?.signals) ? result.data.signals : [];
      reply = signals.length
        ? [
            `ADN Radar có ${signals.length} tín hiệu mới/chưa gửi hôm nay.`,
            "",
            ...signals.slice(0, 8).map((item, index) => {
              const row = item as Record<string, unknown>;
              const ticker = readString(row.ticker).toUpperCase();
              const type = readString(row.type ?? row.signalType);
              return `${index + 1}. ${ticker}${type ? ` - ${type}` : ""}`;
            }),
            "",
            `Duyệt chi tiết: ${getPublicBaseUrl()}/dashboard/signal-map`,
          ].join("\n")
        : "ADN Radar hiện chưa có tín hiệu mới cần duyệt trong ngày.";
      approval = { required: signals.length > 0, type: "radar_digest", url: `${getPublicBaseUrl()}/dashboard/signal-map` };
    } else if (intent === "brief_image") {
      const type = pickBriefImageType(text);
      const result = await callInternalApi<Record<string, unknown>>("/api/internal/n8n/brief-image", {
        method: "POST",
        body: { type, sendTelegram: true, chatId, dedupe: false },
      });
      const label = type === "morning" ? "bản tin sáng" : "bản tin tổng hợp";
      reply = result.ok
        ? `Đã xuất ảnh ${label} và gửi vào Telegram.`
        : `Chưa xuất được ảnh ${label}. Mã lỗi: ${result.status}.`;
    } else if (intent === "news_crawl") {
      const result = await callInternalApi<Record<string, unknown>>("/api/internal/n8n/news/crawl-draft", {
        method: "POST",
        body: { sendTelegram: false },
      });
      const articles = Array.isArray(result.data?.articles) ? result.data.articles : [];
      const created = Number(result.data?.created ?? result.data?.saved ?? articles.length);
      reply = result.ok
        ? `Đã chạy crawl tin SEO và lưu bài ở trạng thái chờ duyệt.\nSố bài mới: ${Number.isFinite(created) ? created : 0}.\n\nDuyệt bài: ${getPublicBaseUrl()}/khac/tin-tuc/admin`
        : `Không chạy được crawl tin lúc này. Mã lỗi: ${result.status}.`;
      approval = { required: result.ok, type: "news_draft", url: `${getPublicBaseUrl()}/khac/tin-tuc/admin` };
    } else if (intent === "scheduled_notification") {
      const slot = pickSlot(text);
      const result = await callInternalApi<Record<string, unknown>>("/api/internal/n8n/notifications/scheduled", {
        method: "POST",
        body: { slot, dryRun: true },
      });
      reply = result.ok
        ? `Đã kiểm tra nội dung thông báo khung ${slot}. Đây mới là kiểm tra nháp, chưa gửi hàng loạt.`
        : `Không kiểm tra được thông báo khung ${slot}. Mã lỗi: ${result.status}.`;
    } else if (intent === "approval") {
      reply = [
        "AIDEN đã ghi nhận yêu cầu duyệt.",
        "Để tránh public nhầm nội dung, thao tác duyệt cuối vẫn thực hiện trên trang quản trị tương ứng.",
        "",
        `Tin tức: ${getPublicBaseUrl()}/khac/tin-tuc/admin`,
        `ADN Radar: ${getPublicBaseUrl()}/dashboard/signal-map`,
      ].join("\n");
      approval = { required: true, type: "manual_review" };
    } else {
      const message =
        intent === "marketing_idea"
          ? `${text}\n\nTrả lời như cố vấn marketing/SEO cho ADN Capital, ưu tiên kế hoạch có thể triển khai bằng n8n và web.`
          : text;
      const aiden = await runAidenDatahubChat({
        message,
        surface: "aiden",
        context: { userRole: "n8n-telegram-operator", userId: `telegram:${chatId}` },
      });
      reply = aiden.message;
      approval = {
        required: Boolean(aiden.recommendation?.ticker),
        type: "aiden",
        ticker: aiden.ticker,
        tickers: aiden.tickers,
        actionUrl: aiden.ticker ? `${getPublicBaseUrl()}/dashboard/dnse-trading?ticker=${aiden.ticker}&source=aiden` : null,
      };
    }

    await writeN8nLog(
      "n8n:telegram-agent",
      "success",
      `intent:${intent}`,
      { chatId, updateId, username, intent, approvalRequired: Boolean(approval.required) },
      startedAt,
    );

    return NextResponse.json({
      ok: true,
      chatId,
      intent,
      text: cleanTelegramText(reply),
      approval,
      disableWebPagePreview: true,
    });
  } catch (error) {
    await writeN8nLog(
      "n8n:telegram-agent",
      "error",
      error instanceof Error ? error.message : "telegram_agent_error",
      { chatId, updateId, username, intent },
      startedAt,
    );
    return NextResponse.json({
      ok: true,
      chatId,
      intent,
      text: "AIDEN vận hành đang gặp lỗi xử lý. Tôi đã ghi nhận log để kiểm tra.",
      approval: { required: false },
      disableWebPagePreview: true,
    });
  }
}
