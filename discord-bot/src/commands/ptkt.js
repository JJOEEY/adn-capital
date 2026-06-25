import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { ptktEmbed } from "../embeds.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("ta")
  .setDescription("Phân tích kỹ thuật một mã (xu hướng, EMA, RSI, MACD, ART + nhận định)")
  .addStringOption((o) => o.setName("ma").setDescription("Mã cổ phiếu (vd VIC)").setRequired(true));

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "ta");
  if (deny) return interaction.reply(deny);
  const ticker = interaction.options.getString("ma").toUpperCase().trim();
  await interaction.deferReply();
  try {
    const j = await api.widget(ticker);
    if (!j?.data?.technical?.stats) return interaction.editReply(`Chưa có dữ liệu kỹ thuật cho **${ticker}**.`);
    await interaction.editReply({ embeds: [ptktEmbed(ticker, j.data.technical, j.data.behavior)] });
  } catch (e) {
    const msg = String(e.message || e);
    await interaction.editReply(/HTTP 404/.test(msg) ? `Mã **${ticker}** chưa có dữ liệu.` : `Lỗi PTKT ${ticker}: ${msg.slice(0, 150)}`);
  }
}
