import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { rankEmbed } from "../embeds.js";
import { hasTier, tierDenyMessage } from "../lib/roles.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Top ADN Rank (RS Rating), có thể lọc theo ngành")
  .addStringOption((o) => o.setName("nganh").setDescription("Lọc theo nhóm ngành (vd Ngân hàng)").setRequired(false));

export const tier = "premium";

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "rank");
  if (deny) return interaction.reply(deny);
  if (!hasTier(interaction.member, tier)) return interaction.reply(tierDenyMessage(tier));
  const sector = interaction.options.getString("nganh")?.trim() || null;
  await interaction.deferReply();
  try {
    const data = await api.rsRating();
    const stocks = data?.stocks ?? [];
    if (!stocks.length) return interaction.editReply("Chưa có dữ liệu ADN Rank.");
    await interaction.editReply({ embeds: [rankEmbed(stocks, { sector })] });
  } catch (e) {
    await interaction.editReply(`Lỗi tải ADN Rank: ${String(e.message || e).slice(0, 150)}`);
  }
}
