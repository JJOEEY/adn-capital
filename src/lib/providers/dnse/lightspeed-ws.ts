import crypto from "crypto";
import net from "net";
import tls from "tls";
import WebSocket from "next/dist/compiled/ws";

type JsonRecord = Record<string, unknown>;

export type DnseLightspeedSubscription = {
  name: string;
  symbols: string[];
};

export type DnseLightspeedResult = {
  opened: boolean;
  authenticated: boolean;
  messages: JsonRecord[];
  binaryMessages: number;
  errors: string[];
};

function getWsBaseUrl() {
  return (process.env.DNSE_MARKET_WS_BASE_URL?.trim() || "wss://ws-openapi.dnse.com.vn").replace(/\/+$/, "");
}

function createAuthMessage() {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = String(Date.now() * 1000000);
  const message = `${apiKey}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(message, "utf8").digest("hex");
  return { action: "auth", api_key: apiKey, signature, timestamp, nonce };
}

function encodeFrame(payload: string | Buffer, opcode = 1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
  const mask = crypto.randomBytes(4);
  const header: number[] = [0x80 | opcode];
  if (body.length < 126) {
    header.push(0x80 | body.length);
  } else if (body.length < 65536) {
    header.push(0x80 | 126, (body.length >> 8) & 0xff, body.length & 0xff);
  } else {
    const length = BigInt(body.length);
    header.push(0x80 | 127);
    for (let shift = 56; shift >= 0; shift -= 8) {
      header.push(Number((length >> BigInt(shift)) & BigInt(0xff)));
    }
  }
  const masked = Buffer.alloc(body.length);
  for (let index = 0; index < body.length; index += 1) {
    masked[index] = body[index]! ^ mask[index % 4]!;
  }
  return Buffer.concat([Buffer.from(header), mask, masked]);
}

function readExact(socket: net.Socket, size: number, timeoutAt: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
      if (timer) clearTimeout(timer);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onError = (error: Error) => fail(error);
    const onClose = () => fail(new Error("dnse_ws_closed"));
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (received < size) return;
      cleanup();
      const merged = Buffer.concat(chunks);
      const head = merged.subarray(0, size);
      const rest = merged.subarray(size);
      if (rest.length > 0) socket.unshift(rest);
      resolve(head);
    };

    const waitMs = Math.max(1, timeoutAt - Date.now());
    timer = setTimeout(() => fail(new Error("dnse_ws_timeout")), waitMs);
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function readFrame(socket: net.Socket, timeoutAt: number) {
  const header = await readExact(socket, 2, timeoutAt);
  const opcode = header[0]! & 0x0f;
  const masked = Boolean(header[1]! & 0x80);
  let length = header[1]! & 0x7f;
  if (length === 126) {
    length = (await readExact(socket, 2, timeoutAt)).readUInt16BE(0);
  } else if (length === 127) {
    const raw = (await readExact(socket, 8, timeoutAt)).readBigUInt64BE(0);
    length = Number(raw);
  }
  const mask = masked ? await readExact(socket, 4, timeoutAt) : null;
  const payload = length > 0 ? await readExact(socket, length, timeoutAt) : Buffer.alloc(0);
  if (!mask) return { opcode, payload };
  const decoded = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    decoded[index] = payload[index]! ^ mask[index % 4]!;
  }
  return { opcode, payload: decoded };
}

function parseTextMessage(payload: Buffer): JsonRecord | null {
  try {
    const parsed = JSON.parse(payload.toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function actionOf(message: JsonRecord | null) {
  if (!message) return null;
  const action = message.action ?? message.a ?? message.type ?? message.T;
  return typeof action === "string" ? action : null;
}

type WsRuntime = new (
  url: string,
  options?: { handshakeTimeout?: number },
) => {
  once(event: string, listener: (...args: unknown[]) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  send(payload: string): void;
  close(): void;
  terminate?: () => void;
};

function loadWsRuntime(): WsRuntime | null {
  return WebSocket as unknown as WsRuntime;
}

function receiveWsMessage(ws: InstanceType<WsRuntime>, timeoutMs: number): Promise<JsonRecord | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => cleanup(null), timeoutMs);
    const cleanup = (value: JsonRecord | null) => {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
      resolve(value);
    };
    const onMessage = (data: unknown) => {
      const parsed = typeof data === "string" || Buffer.isBuffer(data)
        ? parseTextMessage(Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"))
        : null;
      cleanup(parsed);
    };
    const onError = (error: unknown) => cleanup({ action: "error", message: error instanceof Error ? error.message : String(error) });
    const onClose = (code: unknown, reason: unknown) => cleanup({ action: "close", code, message: String(reason ?? "").slice(0, 120) });
    ws.once("message", onMessage);
    ws.once("error", onError);
    ws.once("close", onClose);
  });
}

async function collectWithWsRuntime(
  auth: NonNullable<ReturnType<typeof createAuthMessage>>,
  options: { subscriptions: DnseLightspeedSubscription[]; timeoutMs: number; maxMessages: number },
): Promise<DnseLightspeedResult | null> {
  const WebSocket = loadWsRuntime();
  if (!WebSocket) return null;
  const result: DnseLightspeedResult = {
    opened: false,
    authenticated: false,
    messages: [],
    binaryMessages: 0,
    errors: [],
  };
  const ws = new WebSocket(`${getWsBaseUrl()}/v1/stream?encoding=json`, { handshakeTimeout: Math.min(options.timeoutMs, 10_000) });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("dnse_ws_open_timeout")), Math.min(options.timeoutMs, 10_000));
      ws.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once("error", (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
    result.opened = true;

    await receiveWsMessage(ws, 5_000);
    ws.send(JSON.stringify(auth));
    const authMessage = await receiveWsMessage(ws, Math.min(options.timeoutMs, 10_000));
    const authAction = actionOf(authMessage);
    if (authAction !== "auth_success" && authAction !== "authenticated") {
      result.errors.push(String(authMessage?.message ?? authMessage?.error ?? "dnse_ws_auth_failed").slice(0, 180));
      return result;
    }
    result.authenticated = true;

    for (const subscription of options.subscriptions) {
      ws.send(JSON.stringify({ action: "subscribe", channels: [subscription] }));
    }

    const deadline = Date.now() + options.timeoutMs;
    while (Date.now() < deadline && result.messages.length < options.maxMessages) {
      const message = await receiveWsMessage(ws, Math.max(1, deadline - Date.now()));
      if (!message) break;
      const action = actionOf(message);
      if (action === "ping") {
        ws.send(JSON.stringify({ action: "pong" }));
        continue;
      }
      if (action === "error") {
        result.errors.push(String(message.message ?? "dnse_ws_error").slice(0, 180));
        break;
      }
      if (action === "close") break;
      result.messages.push(message);
    }
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180));
    return result;
  } finally {
    try {
      ws.close();
      ws.terminate?.();
    } catch {
      // Ignore cleanup errors for one-shot websocket reads.
    }
  }
}

async function openSocket(url: URL, timeoutMs: number) {
  const socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
    const raw = net.connect(url.port ? Number(url.port) : 443, url.hostname);
    const timer = setTimeout(() => {
      raw.destroy();
      reject(new Error("dnse_ws_connect_timeout"));
    }, timeoutMs);
    raw.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    raw.once("connect", () => {
      const secure = tls.connect({ socket: raw, servername: url.hostname });
      secure.once("secureConnect", () => {
        clearTimeout(timer);
        resolve(secure);
      });
      secure.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });

  const key = crypto.randomBytes(16).toString("base64");
  const path = `${url.pathname}${url.search}`;
  const request = [
    `GET ${path} HTTP/1.1`,
    `Host: ${url.hostname}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "User-Agent: ADN-DNSE-Lightspeed",
    "",
    "",
  ].join("\r\n");
  socket.write(request);

  const deadline = Date.now() + timeoutMs;
  const chunks: Buffer[] = [];
  while (Date.now() < deadline) {
    const chunk = await readExact(socket, 1, deadline);
    chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    if (!raw.includes(Buffer.from("\r\n\r\n"))) continue;
    const statusLine = raw.toString("utf8").split("\r\n")[0] ?? "";
    if (!statusLine.includes(" 101 ")) {
      socket.destroy();
      throw new Error(`dnse_ws_handshake_failed:${statusLine.slice(0, 80)}`);
    }
    const boundary = raw.indexOf("\r\n\r\n");
    const rest = raw.subarray(boundary + 4);
    if (rest.length > 0) socket.unshift(rest);
    return socket;
  }
  socket.destroy();
  throw new Error("dnse_ws_handshake_timeout");
}

export async function collectDnseLightspeedMessages(options: {
  subscriptions: DnseLightspeedSubscription[];
  timeoutMs?: number;
  maxMessages?: number;
}): Promise<DnseLightspeedResult> {
  const auth = createAuthMessage();
  const result: DnseLightspeedResult = {
    opened: false,
    authenticated: false,
    messages: [],
    binaryMessages: 0,
    errors: [],
  };
  if (!auth) {
    result.errors.push("dnse_credentials_missing");
    return result;
  }

  const timeoutMs = Math.max(800, Math.min(options.timeoutMs ?? 2500, 15_000));
  const runtimeResult = await collectWithWsRuntime(auth, {
    subscriptions: options.subscriptions,
    timeoutMs,
    maxMessages: options.maxMessages ?? 40,
  });
  if (runtimeResult) return runtimeResult;

  const deadline = Date.now() + timeoutMs;
  let socket: tls.TLSSocket | null = null;
  try {
    const url = new URL(`${getWsBaseUrl()}/v1/stream?encoding=json`);
    socket = await openSocket(url, Math.min(timeoutMs, 8_000));
    result.opened = true;
    socket.write(encodeFrame(JSON.stringify(auth)));

    while (Date.now() < deadline && result.messages.length < (options.maxMessages ?? 40)) {
      const frame = await readFrame(socket, deadline);
      if (frame.opcode === 8) break;
      if (frame.opcode === 9) {
        socket.write(encodeFrame(frame.payload, 10));
        continue;
      }
      if (frame.opcode === 2) {
        result.binaryMessages += 1;
        continue;
      }
      if (frame.opcode !== 1) continue;

      const message = parseTextMessage(frame.payload);
      const action = actionOf(message);
      if (action === "ping") {
        socket.write(encodeFrame(JSON.stringify({ action: "pong" })));
        continue;
      }
      if (action === "auth_success" || action === "authenticated") {
        result.authenticated = true;
        for (const subscription of options.subscriptions) {
          socket.write(encodeFrame(JSON.stringify({ action: "subscribe", channels: [subscription] })));
        }
        continue;
      }
      if (action === "auth_error" || action === "error") {
        const reason = String(message?.message ?? message?.error ?? message?.reason ?? "dnse_ws_error");
        result.errors.push(reason.slice(0, 180));
        break;
      }
      if (message) result.messages.push(message);
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180));
  } finally {
    try {
      socket?.write(encodeFrame(Buffer.alloc(0), 8));
      socket?.destroy();
    } catch {
      // Ignore cleanup errors for one-shot websocket reads.
    }
  }
  return result;
}
