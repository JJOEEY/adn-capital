import { config } from "./config.js";

async function get(path, { internal = false, timeout = 30000 } = {}) {
  const headers = {};
  if (internal && config.internalKey) headers["x-internal-key"] = config.internalKey;
  const res = await fetch(`${config.apiBase}${path}`, { headers, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function postJson(path, body, { timeout = 60000 } = {}) {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`);
  return res.json();
}

// Lấy text trả lời từ nhiều shape khác nhau của /api/chat
function pickReply(j) {
  return (
    j?.reply ?? j?.answer ?? j?.response ?? j?.message ?? j?.text ?? j?.content ?? ""
  );
}

export const api = {
  rsRating: () => get("/api/rs-rating", { timeout: 60000 }),
  historical: (ticker) => get(`/api/historical/${encodeURIComponent(ticker.toUpperCase())}`),
  marketOverview: () => get("/api/market-overview"),
  signals: () => get("/api/signals", { timeout: 45000 }),
  art: (ticker) => get(`/api/rpi?ticker=${encodeURIComponent(ticker.toUpperCase())}`).catch(() => null),
  leaderRadar: () => get("/api/leader-radar").catch(() => null),

  async aiden(message) {
    const j = await postJson("/api/chat", { message }, { timeout: 90000 });
    const txt = String(pickReply(j) || "").trim();
    return txt || "Xin lỗi, AIDEN chưa trả lời được lúc này.";
  },

  async briefImage(kind /* "morning" | "eod" */) {
    const res = await fetch(`${config.apiBase}/api/internal/n8n/brief-image?type=${kind}`, {
      headers: config.internalKey ? { "x-internal-key": config.internalKey } : {},
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`brief-image ${kind} → HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
};
