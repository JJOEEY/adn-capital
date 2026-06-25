import cron from "node-cron";
import { AttachmentBuilder } from "discord.js";
import { api } from "../api.js";
import { config } from "../config.js";

async function postBrief(client, kind, title) {
  if (!config.channels.brief) return;
  const channel = await client.channels.fetch(config.channels.brief).catch(() => null);
  if (!channel) return;
  try {
    const png = await api.briefImage(kind);
    const file = new AttachmentBuilder(png, { name: `adn-${kind}.png` });
    await channel.send({ content: `**${title}**`, files: [file] });
    console.log(`[brief] đã đăng ${kind}`);
  } catch (e) {
    console.warn(`[brief] ${kind} lỗi:`, String(e.message || e).slice(0, 120));
  }
}

export function startBriefScheduler(client) {
  const tz = "Asia/Ho_Chi_Minh";
  // Bản tin sáng ~8:05, kết phiên ~19:10 (sau khi cron web tạo xong) — T2..T6.
  cron.schedule("5 8 * * 1-5", () => postBrief(client, "morning", "🌅 Bản tin sáng ADN Capital"), { timezone: tz });
  cron.schedule("10 19 * * 1-5", () => postBrief(client, "eod", "🌙 Bản tin kết phiên ADN Capital"), { timezone: tz });
  console.log(`[brief] lịch 8:05 & 19:10 VN → kênh ${config.channels.brief || "(chưa set)"}`);
}
