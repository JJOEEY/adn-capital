import { api } from "../api.js";
import { config } from "../config.js";
import { signalEmbed } from "../embeds.js";

const seen = new Set();
let seeded = false;

function listOf(j) {
  if (Array.isArray(j)) return j;
  return j?.signals ?? j?.data ?? j?.items ?? [];
}
const keyOf = (s) => s.id ?? `${s.ticker}:${s.type}:${s.entryPrice}`;

async function poll(client) {
  if (!config.channels.signals) return;
  let list;
  try {
    list = listOf(await api.signals());
  } catch (e) {
    console.warn("[signals] poll lỗi:", String(e.message || e).slice(0, 100));
    return;
  }
  // Lần đầu: chỉ seed (không spam tín hiệu cũ).
  if (!seeded) {
    for (const s of list) seen.add(keyOf(s));
    seeded = true;
    console.log(`[signals] seed ${seen.size} tín hiệu hiện có.`);
    return;
  }
  const channel = await client.channels.fetch(config.channels.signals).catch(() => null);
  if (!channel) return;
  for (const s of list) {
    const k = keyOf(s);
    if (seen.has(k) || !s.ticker) continue;
    seen.add(k);
    // Bỏ qua TẦM NGẮM (chỉ theo dõi, không phải tín hiệu mua/bán)
    const kind = String(s.type || s.tier || "").toUpperCase();
    if (kind.includes("TAM_NGAM") || kind.includes("TAM NGAM")) continue;
    const roleId = config.roles.signal;
    await channel
      .send({
        content: roleId ? `<@&${roleId}>` : undefined,
        embeds: [signalEmbed(s)],
        allowedMentions: { roles: roleId ? [roleId] : [] },
      })
      .catch((e) => console.warn("[signals] gửi lỗi:", String(e.message || e).slice(0, 100)));
  }
}

export function startSignalPoller(client, intervalMs = 120000) {
  poll(client); // seed ngay
  setInterval(() => poll(client), intervalMs);
  console.log(`[signals] poller chạy mỗi ${intervalMs / 1000}s → kênh ${config.channels.signals || "(chưa set)"}`);
}
