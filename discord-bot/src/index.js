import {
  Client, GatewayIntentBits, Events, Collection,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
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
import { welcomeEmbed } from "./embeds.js";

const commands = new Collection();
for (const c of [stock, rank, art, aiden, ptkt, ptcb, tintuc, atc]) commands.set(c.data.name, c);

// @mention bot vẫn có content kể cả khi KHÔNG có MessageContent (Discord exception).
// MessageContent (privileged) chỉ cần khi muốn AIDEN đọc MỌI tin ở kênh aiden-chat (không tag).
// → chỉ xin intent này khi AIDEN_LISTEN=1; nếu bật mà portal chưa enable thì bot crash, nên gate kỹ.
// GuildMembers (privileged) cần cho lời chào người mới — đã bật "Server Members Intent" trong Portal.
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers];
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

// Chào mừng thành viên mới
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user?.bot || !config.welcomeChannel) return;
  const ch = await member.guild.channels.fetch(config.welcomeChannel).catch(() => null);
  if (!ch?.isTextBased?.()) return;
  await ch
    .send({
      content: `${member}`,
      embeds: [
        welcomeEmbed(member, {
          rules: config.rulesChannel,
          stock: config.commandChannels.ma,
          aiden: config.commandChannels.ai,
          signals: config.channels.signals,
        }),
      ],
    })
    .catch((e) => console.warn("[welcome]", String(e.message || e).slice(0, 100)));
});

// Nút bấm tự nhận/bỏ role (panel thông báo tín hiệu)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "toggle_signal_role") return;
  const roleId = config.roles.signal;
  if (!roleId) return interaction.reply({ content: "Chưa cấu hình role tín hiệu.", ephemeral: true });
  try {
    const member = interaction.member;
    if (member.roles.cache?.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.reply({ content: "🔕 Đã TẮT nhắc tín hiệu. Bấm lại để bật.", ephemeral: true });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ content: "🔔 Đã BẬT — bạn sẽ được nhắc khi có tín hiệu mới.", ephemeral: true });
    }
  } catch (e) {
    await interaction.reply({ content: `Lỗi: ${String(e.message || e).slice(0, 120)}`, ephemeral: true }).catch(() => {});
  }
});

// Luồng đăng ký role DNSE: nút Đăng ký → modal → request vào kênh duyệt → admin Duyệt/Từ chối
client.on(Events.InteractionCreate, async (interaction) => {
  // 1) Bấm "Đăng ký DNSE" → mở modal nhập số TK
  if (interaction.isButton() && interaction.customId === "dnse_register") {
    const modal = new ModalBuilder().setCustomId("dnse_register_modal").setTitle("Đăng ký DNSE careby");
    const acc = new TextInputBuilder().setCustomId("dnse_acc").setLabel("Số tài khoản DNSE của bạn")
      .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40);
    const note = new TextInputBuilder().setCustomId("dnse_note").setLabel("Họ tên / ghi chú (không bắt buộc)")
      .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(120);
    modal.addComponents(new ActionRowBuilder().addComponents(acc), new ActionRowBuilder().addComponents(note));
    return interaction.showModal(modal).catch(() => {});
  }

  // 2) Submit modal → gửi thẻ yêu cầu vào kênh duyệt
  if (interaction.isModalSubmit() && interaction.customId === "dnse_register_modal") {
    const acc = interaction.fields.getTextInputValue("dnse_acc").trim();
    const note = (interaction.fields.getTextInputValue("dnse_note") || "").trim() || "—";
    const reviewId = config.dnseReviewChannel;
    if (!reviewId) return interaction.reply({ content: "Hệ thống chưa cấu hình kênh duyệt. Liên hệ admin.", ephemeral: true });
    const ch = await interaction.guild?.channels.fetch(reviewId).catch(() => null);
    if (!ch?.isTextBased?.()) return interaction.reply({ content: "Không gửi được yêu cầu. Liên hệ admin.", ephemeral: true });
    const embed = new EmbedBuilder().setColor(0xe8833a).setTitle("📝 Yêu cầu role DNSE")
      .setDescription(`Từ ${interaction.user} (\`${interaction.user.id}\`)`)
      .addFields({ name: "Số TK DNSE", value: acc, inline: true }, { name: "Ghi chú", value: note, inline: true })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`dnse_approve:${interaction.user.id}`).setLabel("✅ Duyệt").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`dnse_reject:${interaction.user.id}`).setLabel("❌ Từ chối").setStyle(ButtonStyle.Danger),
    );
    await ch.send({ embeds: [embed], components: [row] }).catch(() => {});
    return interaction.reply({ content: "✅ Đã gửi yêu cầu. ADN sẽ kiểm tra & cấp quyền sớm nhất.", ephemeral: true });
  }

  // 3) Admin bấm Duyệt / Từ chối
  if (interaction.isButton() && (interaction.customId.startsWith("dnse_approve:") || interaction.customId.startsWith("dnse_reject:"))) {
    if (!interaction.member?.permissions?.has?.("Administrator"))
      return interaction.reply({ content: "Chỉ admin được duyệt yêu cầu này.", ephemeral: true });
    const [action, userId] = interaction.customId.split(":");
    const approve = action === "dnse_approve";
    try {
      if (approve) {
        const roleId = config.roles.dnse;
        if (!roleId) return interaction.reply({ content: "Chưa cấu hình ROLE_DNSE.", ephemeral: true });
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: "Không tìm thấy thành viên (có thể đã rời server).", ephemeral: true });
        await member.roles.add(roleId);
        await member.send("✅ Bạn đã được cấp quyền **DNSE careby** tại ADN Capital. Vào kênh **#thân-tín** để nhận khuyến nghị & trao đổi cùng đội ADN nhé.").catch(() => {});
      }
      const base = interaction.message.embeds[0] ? EmbedBuilder.from(interaction.message.embeds[0]) : new EmbedBuilder();
      base.setColor(approve ? 0x2e7d4f : 0xc0392b)
        .addFields({ name: approve ? "✅ Đã duyệt" : "❌ Từ chối", value: `bởi ${interaction.user}` });
      await interaction.update({ embeds: [base], components: [] });
    } catch (e) {
      await interaction.reply({ content: `Lỗi: ${String(e.message || e).slice(0, 120)}`, ephemeral: true }).catch(() => {});
    }
    return;
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
    !!config.commandChannels.ai &&
    message.channelId === config.commandChannels.ai;
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
