import { config } from "../config.js";
import { toolAccess } from "./roles.js";
import { consumeDaily } from "./usage.js";

/**
 * Cổng dùng công cụ cao cấp (/ta /fa /atc /art /ai /top):
 * - admin / Premium / VIP → không giới hạn
 * - DNSE careby           → giới hạn N lượt/ngày (tính 1 lượt khi qua cổng)
 * - còn lại               → chặn
 * Trả message từ chối (để interaction.reply) hoặc null nếu được phép.
 */
export function gateTool(interaction) {
  const access = toolAccess(interaction.member);
  if (access === "none") {
    return {
      content: "🔒 Công cụ này dành cho khách hàng ADN (Premium/VIP hoặc DNSE careby). Liên hệ admin để mở quyền.",
      ephemeral: true,
    };
  }
  if (access === "limited") {
    const { ok } = consumeDaily(interaction.user.id, config.dnseDailyLimit);
    if (!ok) {
      return {
        content: `⏳ Bạn đã dùng hết **${config.dnseDailyLimit} lượt/ngày** của gói DNSE. Reset vào ngày mai (giờ VN), hoặc nâng cấp Premium/VIP để dùng không giới hạn.`,
        ephemeral: true,
      };
    }
  }
  return null;
}
