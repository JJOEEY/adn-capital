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
import * as ptkt from "./commands/ptkt.js";
import * as ptcb from "./commands/ptcb.js";
import * as tintuc from "./commands/tintuc.js";
import * as atc from "./commands/atc.js";

const commands = new Collection();
for (const c of [stock, rank, art, aiden, ptkt, ptcb, tintuc, atc]) commands.set(c.data.name, c);

// @mention bot vẫn có content kể cả khi KHÔNG có MessageContent (Discord exception).
// MessageContent (privileged) chỉ cần khi muốn AIDEN đọc MỌI tin ở kênh aiden-chat (không tag).
// → chỉ xin intent này khi AIDEN_LISTEN=1; nếu bật mà portal chưa enable thì bot crash, nên gate kỹ.
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (config.aidenListen) intents.push(GatewayIntentBits.MessageContent);
const client = new Client({ intents });

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

// AIDEN chat tự nhiên trong kênh aiden-chat.
// - Luôn trả lời khi @mention bot (ở đúng kênh AIDEN).
// - Nếu AIDEN_LISTEN=1: trả lời MỌI tin trong kênh aiden-chat, không cần tag.
const aidenCooldown = new Map(); // userId → timestamp, chống spam khi listen
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!aidenChannelOk(message.channelId)) return; // AIDEN chỉ sống ở kênh aiden-chat
  const mentioned = message.mentions.has(client.user);
  const listening =
    config.aidenListen &&
    !!config.commandChannels.aiden &&
    message.channelId === config.commandChannels.aiden;
  if (!mentioned && !listening) return;
  const q = message.content.replace(/<@!?\d+>/g, "").trim();
  if (!q || q.length < 2) return;
  // listen mode: cooldown 4s/người để tránh dội API khi chat nhanh
  if (listening && !mentioned) {
    const now = Date.now();
    const last = aidenCooldown.get(message.author.id) || 0;
    if (now - last < 4000) return;
    aidenCooldown.set(message.author.id, now);
  }
  await message.channel.sendTyping().catch(() => {});
  try {
    const reply = await api.aiden(q);
    const parts = aiden.chunk(reply);
    await message.reply(parts[0]);
    for (const p of parts.slice(1)) await message.channel.send(p);
  } catch (e) {
    await message.reply(`AIDEN gặp lỗi: ${String(e.message || e).slice(0, 150)}`).catch(() => {});
  }
});

client.login(config.token);
