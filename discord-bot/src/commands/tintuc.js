import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { newsEmbed } from "../embeds.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("tin")
  .setDescription("Tin tức mới nhất về một mã (tối đa 5 tin, kèm link)")
  .addStringOption((o) => o.setName("ma").setDescription("Mã cổ phiếu (vd HPG)").setRequired(true));

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "tin");
  if (deny) return interaction.reply(deny);
  const ticker = interaction.options.getString("ma").toUpperCase().trim();
  await interaction.deferReply();
  try {
    const j = await api.widget(ticker);
    await interaction.editReply({ embeds: [newsEmbed(ticker, j?.data?.news || [])] });
  } catch (e) {
    const msg = String(e.message || e);
    await interaction.editReply(/HTTP 404/.test(msg) ? `Mã **${ticker}** chưa có dữ liệu.` : `Lỗi tin tức ${ticker}: ${msg.slice(0, 150)}`);
  }
}
