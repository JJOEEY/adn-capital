import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { chunk } from "./aiden.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("atc")
  .setDescription("Phân tích phiên ATC của một mã (đợt khớp lệnh định kỳ đóng cửa)")
  .addStringOption((o) => o.setName("ma").setDescription("Mã cổ phiếu (vd SSI)").setRequired(true));

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "atc");
  if (deny) return interaction.reply(deny);
  const ticker = interaction.options.getString("ma").toUpperCase().trim();
  await interaction.deferReply();
  // Ticker viết thường + surface 'aiden' để LLM trả lời đúng câu ATC (né template tĩnh).
  const low = ticker.toLowerCase();
  const prompt =
    `Nhận định nhanh diễn biến phiên khớp lệnh định kỳ đóng cửa gần nhất của ${low}: ` +
    `lực mua/bán bên nào áp đảo ở đợt đóng cửa, khối lượng và mức giá đóng cửa so với phiên khớp liên tục, ` +
    `có dấu hiệu kéo/xả hay đột biến lệnh cuối phiên không, và hàm ý cho phiên kế tiếp. ` +
    `Viết 3-5 câu thực chiến, tiếng Việt, không giải thích khái niệm. ` +
    `Nếu chưa đủ dữ liệu thì nói rõ là chưa đủ dữ liệu thay vì bịa số.`;
  try {
    const reply = await api.aidenAsk(prompt, { surface: "aiden" });
    const parts = chunk(`**🔔 Phân tích ATC · ${ticker}**\n${reply}`);
    await interaction.editReply(parts[0]);
    for (const p of parts.slice(1)) await interaction.followUp(p);
  } catch (e) {
    await interaction.editReply(`Lỗi phân tích ATC ${ticker}: ${String(e.message || e).slice(0, 150)}`);
  }
}
