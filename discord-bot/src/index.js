import { Client, GatewayIntentBits, Events, Collection } from "discord.js";
import { config } from "./config.js";
import { api } from "./api.js";
import { startSignalPoller } from "./jobs/signals.js";
import { startBriefScheduler } from "./jobs/brief.js";
import { aidenChannelOk } from "./lib/channels.js";
import * as stock from "./commands/stock.js";
import * as rank from "./commands/rank.js";
import * as art from "./commands/art.js";
import * as aiden from "./commands/aiden.js";

const commands = new Collection();
for (const c of [stock, rank, art, aiden]) commands.set(c.data.name, c);

// KHÔNG xin MessageContent (privileged): tin nhắn @mention bot vẫn có content (Discord exception)
// → slash command + @mention AIDEN đều chạy mà không cần bật intent trong portal.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ ADN bot online: ${c.user.tag}`);
  startSignalPoller(client);
  startBriefScheduler(client);
});

// Slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error("[interaction]", e);
    const msg = "Có lỗi khi xử lý lệnh.";
    if (interaction.deferred || interaction.replied) interaction.editReply(msg).catch(() => {});
    else interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
});

// @mention AIDEN (chat tự nhiên)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.mentions.has(client.user)) return;
  if (!aidenChannelOk(message.channelId)) return; // chỉ trả lời @mention ở kênh AIDEN
  const q = message.content.replace(/<@!?\d+>/g, "").trim();
  if (!q) return;
  await message.channel.sendTyping().catch(() => {});
  try {
    const reply = await api.aiden(q);
    for (const part of aiden.chunk(reply)) await message.reply(part);
  } catch (e) {
    await message.reply(`AIDEN gặp lỗi: ${String(e.message || e).slice(0, 150)}`).catch(() => {});
  }
});

client.login(config.token);
