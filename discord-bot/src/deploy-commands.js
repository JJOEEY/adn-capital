import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import * as stock from "./commands/stock.js";
import * as rank from "./commands/rank.js";
import * as art from "./commands/art.js";
import * as aiden from "./commands/aiden.js";

const body = [stock, rank, art, aiden].map((c) => c.data.toJSON());
const rest = new REST({ version: "10" }).setToken(config.token);

try {
  if (!config.clientId) throw new Error("thiếu DISCORD_CLIENT_ID");
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId) // guild = cập nhật tức thì (dev)
    : Routes.applicationCommands(config.clientId);                      // global = ~1h lan toả
  await rest.put(route, { body });
  console.log(`✅ Đã đăng ký ${body.length} lệnh${config.guildId ? ` cho guild ${config.guildId}` : " (global)"}.`);
} catch (e) {
  console.error("❌ Đăng ký lệnh lỗi:", e);
  process.exit(1);
}
