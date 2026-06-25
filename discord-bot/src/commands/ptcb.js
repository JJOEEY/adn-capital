import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { ptcbEmbed } from "../embeds.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("ptcb")
  .setDescription("Phân tích cơ bản một mã (P/E, P/B, EPS, ROE/ROA, KQKD + nhận định)")
  .addStringOption((o) => o.setName("ma").setDescription("Mã cổ phiếu (vd FPT)").setRequired(true));

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "ptcb");
  if (deny) return interaction.reply(deny);
  const ticker = interaction.options.getString("ma").toUpperCase().trim();
  await interaction.deferReply();
  try {
    const j = await api.widget(ticker);
    if (!j?.data?.fundamental?.stats) {
      return interaction.editReply(`Chưa có dữ liệu cơ bản cho **${ticker}** (chỉ số/quỹ thường không có BCTC).`);
    }
    await interaction.editReply({ embeds: [ptcbEmbed(ticker, j.data.fundamental)] });
  } catch (e) {
    const msg = String(e.message || e);
    await interaction.editReply(/HTTP 404/.test(msg) ? `Mã **${ticker}** chưa có dữ liệu.` : `Lỗi PTCB ${ticker}: ${msg.slice(0, 150)}`);
  }
}
