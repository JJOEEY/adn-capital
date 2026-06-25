import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { artEmbed } from "../embeds.js";
import { hasTier, tierDenyMessage } from "../lib/roles.js";

export const data = new SlashCommandBuilder()
  .setName("art")
  .setDescription("ADN ART — chỉ số đảo chiều xu hướng của một mã")
  .addStringOption((o) => o.setName("ma").setDescription("Mã cổ phiếu (vd VN30, VIC)").setRequired(true));

export const tier = "premium";

function extractValue(j) {
  if (!j) return { value: null, label: null };
  const value = j.value ?? j.rpi ?? j.tei ?? j.current ?? j.score
    ?? j.latest?.rpi ?? j.latest?.value
    ?? (Array.isArray(j.data) ? j.data[j.data.length - 1]?.rpi ?? j.data[j.data.length - 1]?.value : null);
  const label = j.label ?? j.classification ?? j.status ?? j.latest?.label ?? null;
  return { value, label };
}

export async function execute(interaction) {
  if (!hasTier(interaction.member, tier)) return interaction.reply(tierDenyMessage(tier));
  const ticker = interaction.options.getString("ma").toUpperCase().trim();
  await interaction.deferReply();
  try {
    const j = await api.art(ticker);
    const { value, label } = extractValue(j);
    await interaction.editReply({ embeds: [artEmbed(ticker, value, label)] });
  } catch (e) {
    await interaction.editReply(`Lỗi tải ADN ART ${ticker}: ${String(e.message || e).slice(0, 150)}`);
  }
}
