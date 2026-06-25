import { config } from "../config.js";

/**
 * Nếu lệnh `cmdName` có kênh chỉ định và interaction KHÔNG ở kênh đó → trả message từ chối (để reply).
 * Trả null nếu hợp lệ (hoặc chưa cấu hình kênh → cho dùng mọi nơi).
 */
export function wrongChannel(channelId, cmdName) {
  const target = config.commandChannels[cmdName];
  if (!target || channelId === target) return null;
  return { content: `📍 Lệnh **/${cmdName}** chỉ dùng ở <#${target}>.`, ephemeral: true };
}

/** Cho @mention AIDEN: true nếu kênh hợp lệ (hoặc chưa cấu hình). */
export function aidenChannelOk(channelId) {
  const target = config.commandChannels.ai;
  return !target || channelId === target;
}
