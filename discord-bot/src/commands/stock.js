import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { stockEmbed } from "../embeds.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("stock")
  .setDescription("Tra cứu giá, % thay đổi, ADN Rank, ngành của một mã")
  .addStringOption((o) => o.setName("ma").setDescription("Mã cổ phiếu (vd VIC)").setRequired(true));

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "stock");
  if (deny) return interaction.reply(deny);
  const ticker = interaction.options.getString("ma").toUpperCase().trim();
  await interaction.deferReply();
  try {
    const rank = await api.rsRating().catch(() => null);
    const row = rank?.stocks?.find((s) => s.symbol === ticker);
    let info = row
      ? { price: row.price, changePercent: row.changePercent, rs: row.rsRating, sector: row.sector, name: row.name }
      : null;
    if (!info) {
      const hist = await api.historical(ticker).catch(() => null);
      const d = hist?.data ?? [];
      const last = d[d.length - 1], prev = d[d.length - 2];
      if (last) {
        const ch = prev?.close ? ((last.close - prev.close) / prev.close) * 100 : null;
        info = { price: last.close, changePercent: ch, rs: null, sector: null, name: ticker };
      }
    }
    if (!info) return interaction.editReply(`Không tìm thấy dữ liệu cho **${ticker}**.`);
    await interaction.editReply({ embeds: [stockEmbed(ticker, info)] });
  } catch (e) {
    await interaction.editReply(`Lỗi tra cứu ${ticker}: ${String(e.message || e).slice(0, 150)}`);
  }
}
