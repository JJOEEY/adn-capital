import { SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import { gateTool } from "../lib/gate.js";
import { wrongChannel } from "../lib/channels.js";

export const data = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Hỏi AIDEN — trợ lý AI về cổ phiếu & thị trường")
  .addStringOption((o) => o.setName("cau_hoi").setDescription("Câu hỏi của bạn").setRequired(true));

// Cắt câu trả lời dài thành các đoạn <= 2000 ký tự (giới hạn Discord).
export function chunk(text, size = 1900) {
  const out = [];
  let s = String(text);
  while (s.length > size) {
    let cut = s.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = size;
    out.push(s.slice(0, cut));
    s = s.slice(cut);
  }
  if (s.trim()) out.push(s);
  return out;
}

export async function answer(interaction, question) {
  await interaction.deferReply();
  try {
    const reply = await api.aiden(question);
    const parts = chunk(reply);
    await interaction.editReply(parts[0]);
    for (const p of parts.slice(1)) await interaction.followUp(p);
  } catch (e) {
    await interaction.editReply(`AIDEN gặp lỗi: ${String(e.message || e).slice(0, 150)}`);
  }
}

export async function execute(interaction) {
  const deny = wrongChannel(interaction.channelId, "ai");
  if (deny) return interaction.reply(deny);
  const denyTool = gateTool(interaction);
  if (denyTool) return interaction.reply(denyTool);
  await answer(interaction, interaction.options.getString("cau_hoi"));
}
