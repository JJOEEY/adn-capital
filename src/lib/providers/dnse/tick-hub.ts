import crypto from "crypto";
import WebSocket from "next/dist/compiled/ws";
import { ingestDatabaseRadarWsMessages, isOhlcBarMessage, tickFromMessage } from "@/lib/database/radar-realtime";

/**
 * PLAN B — 1 kết nối DNSE WS THƯỜNG TRÚ (singleton ở scope module, sống cùng tiến trình adn-web),
 * subscribe tick_extra.G1.json cho union symbol mà các SSE client yêu cầu, fan-out tick LIVE tới client,
 * và persist DB (radar.realtime.tick) mỗi 15s qua ingestDatabaseRadarWsMessages (RAW, AIDEN-safe).
 * - Chỉ connect khi có subscriber; idle 60s không subscriber → đóng WS.
 * - Fan-out: giá đã SCALE sang VND (×1000 cho cp <1000) để khớp chart/giá UI; DB vẫn lưu RAW như cũ.
 * - Flag gate ở route (SSE_TICK_STREAM_ENABLED); hub chỉ chạy khi route gọi subscribeTicks.
 */
export type LiveTick = {
  ticker: string;
  price: number | null;
  reference: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
  updatedAt: string;
};

type WsClient = {
  on(ev: string, cb: (...a: unknown[]) => void): void;
  send(s: string): void;
  close(): void;
  terminate?(): void;
};
type Subscriber = { symbols: Set<string>; onTick: (t: LiveTick) => void };

const CHANNEL = "tick_extra.G1.json";
const PERSIST_MS = 15_000;
const IDLE_CLOSE_MS = 60_000;
const RECONNECT_BASE_MS = 3_000;

let ws: WsClient | null = null;
let authed = false;
let connecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let persistTimer: NodeJS.Timeout | null = null;
let idleTimer: NodeJS.Timeout | null = null;

const subscribers = new Set<Subscriber>();
const wantedSymbols = new Set<string>();
const latest = new Map<string, LiveTick>();
let msgBuffer: unknown[] = [];

function authMessage() {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = String(Date.now() * 1_000_000);
  const signature = crypto.createHmac("sha256", apiSecret).update(`${apiKey}:${timestamp}:${nonce}`, "utf8").digest("hex");
  return { action: "auth", api_key: apiKey, signature, timestamp, nonce };
}

function wsBase() {
  return (process.env.DNSE_MARKET_WS_BASE_URL?.trim() || "wss://ws-openapi.dnse.com.vn").replace(/\/+$/, "");
}

// DNSE giá cp theo NGHÌN (<1000) → ×1000 VND; chỉ số (>=1000) giữ nguyên. Khớp scaleDnseToVnd của radar.
function vnd(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v < 1000 ? Math.round((v * 1000) / 10) * 10 : v;
}

function subscribeChannel() {
  if (!ws || !authed || wantedSymbols.size === 0) return;
  ws.send(JSON.stringify({ action: "subscribe", channels: [{ name: CHANNEL, symbols: [...wantedSymbols] }] }));
}

function parse(data: unknown): Record<string, unknown> | null {
  try {
    const s = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : null;
    if (!s) return null;
    const o = JSON.parse(s);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function actionOf(m: Record<string, unknown> | null) {
  if (!m) return null;
  const a = m.action ?? m.a ?? m.type ?? m.T;
  return typeof a === "string" ? a : null;
}

function fanOut(raw: ReturnType<typeof tickFromMessage>) {
  if (!raw) return;
  const sp = vnd(raw.price);
  const sr = vnd(raw.reference);
  const t: LiveTick = {
    ticker: raw.ticker,
    price: sp,
    reference: sr,
    change: sp != null && sr != null ? sp - sr : null,
    changePct: raw.changePct,
    volume: raw.volume,
    high: vnd(raw.high),
    low: vnd(raw.low),
    updatedAt: raw.updatedAt,
  };
  latest.set(t.ticker, t);
  for (const sub of subscribers) {
    if (sub.symbols.size === 0 || sub.symbols.has(t.ticker)) {
      try {
        sub.onTick(t);
      } catch {
        /* bỏ qua lỗi callback */
      }
    }
  }
}

function teardownWs() {
  authed = false;
  if (ws) {
    try {
      ws.close();
      ws.terminate?.();
    } catch {
      /* ignore */
    }
  }
  ws = null;
}

function scheduleReconnect() {
  if (reconnectTimer || subscribers.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    connect();
  }, reconnectDelay);
}

function startPersistTimer() {
  if (persistTimer) return;
  persistTimer = setInterval(() => {
    if (msgBuffer.length === 0) return;
    const batch = msgBuffer;
    msgBuffer = [];
    ingestDatabaseRadarWsMessages({
      messages: batch,
      connected: Boolean(ws),
      authenticated: authed,
      subscribedCount: wantedSymbols.size,
    }).catch(() => null);
  }, PERSIST_MS);
}

function connect() {
  if (ws || connecting) return;
  const auth = authMessage();
  if (!auth) return; // thiếu DNSE creds → không kết nối
  connecting = true;
  let sock: WsClient;
  try {
    const Ctor = WebSocket as unknown as new (u: string, o?: unknown) => WsClient;
    sock = new Ctor(`${wsBase()}/v1/stream?encoding=json`, { handshakeTimeout: 10_000 });
  } catch {
    connecting = false;
    scheduleReconnect();
    return;
  }
  ws = sock;
  connecting = false;

  sock.on("open", () => sock.send(JSON.stringify(auth)));
  sock.on("message", (data: unknown) => {
    const m = parse(data);
    const a = actionOf(m);
    if (a === "ping") {
      sock.send(JSON.stringify({ action: "pong" }));
      return;
    }
    if (a === "auth_success" || a === "authenticated") {
      authed = true;
      reconnectDelay = RECONNECT_BASE_MS;
      subscribeChannel();
      return;
    }
    if (a === "auth_error" || a === "error" || a === "close" || !m) return;
    msgBuffer.push(m);
    if (isOhlcBarMessage(m)) return; // bar đi đường persist riêng, KHÔNG fan-out như tick
    fanOut(tickFromMessage(m));
  });
  sock.on("close", () => {
    teardownWs();
    scheduleReconnect();
  });
  sock.on("error", () => {
    teardownWs();
    scheduleReconnect();
  });
  startPersistTimer();
}

function stopAll() {
  teardownWs();
  if (persistTimer) {
    clearInterval(persistTimer);
    persistTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  wantedSymbols.clear();
  msgBuffer = [];
}

/** Đăng ký nhận tick LIVE cho `symbols`. Trả hàm unsubscribe. */
export function subscribeTicks(symbols: string[], onTick: (t: LiveTick) => void): () => void {
  const syms = new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean));
  const sub: Subscriber = { symbols: syms, onTick };
  subscribers.add(sub);
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  let needResub = false;
  for (const s of syms) {
    if (!wantedSymbols.has(s)) {
      wantedSymbols.add(s);
      needResub = true;
    }
  }
  connect();
  if (authed && needResub) subscribeChannel();
  for (const s of syms) {
    const t = latest.get(s);
    if (t) {
      try {
        onTick(t);
      } catch {
        /* ignore */
      }
    }
  }

  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (subscribers.size === 0) stopAll();
      }, IDLE_CLOSE_MS);
    }
  };
}
