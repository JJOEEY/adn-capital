import cron from "node-cron";
import { api } from "../api.js";
import { config } from "../config.js";
import { eodBriefEmbed, morningBriefEmbed } from "../embeds.js";

export async function postBrief(client, kind) {
  if (!config.channels.brief) return;
  const channel = await client.channels.fetch(config.channels.brief).catch(() => null);
  if (!channel) return;
  try {
    const data = await api.briefData(kind);
    if (!data) {
      console.warn(`[brief] ${kind} chưa có data`);
      return;
    }
    const embed = kind === "morning" ? morningBriefEmbed(data) : eodBriefEmbed(data);
    await channel.send({ embeds: [embed] });
    console.log(`[brief] đã đăng ${kind} (text)`);
  } catch (e) {
    console.warn(`[brief] ${kind} lỗi:`, String(e.message || e).slice(0, 120));
  }
}

export function startBriefScheduler(client) {
  const tz = "Asia/Ho_Chi_Minh";
  // Bản tin sáng ~8:05, kết phiên ~19:10 (sau khi cron web tạo xong) — T2..T6.
  cron.schedule("5 8 * * 1-5", () => postBrief(client, "morning"), { timezone: tz });
  cron.schedule("10 19 * * 1-5", () => postBrief(client, "eod"), { timezone: tz });
  console.log(`[brief] lịch 8:05 & 19:10 VN → kênh ${config.channels.brief || "(chưa set)"}`);
}
