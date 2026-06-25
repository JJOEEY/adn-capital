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
  if (access.level === "none") {
    return {
      content: "🔒 Để dùng công cụ, hãy vào **#chào-mừng-và-nội-quy** bấm **Đồng ý nội quy** (3 lượt/ngày miễn phí), hoặc nâng cấp DNSE / Premium / VIP để dùng nhiều hơn.",
      ephemeral: true,
    };
  }
  if (access.level === "limited") {
    const { ok } = consumeDaily(interaction.user.id, access.limit);
    if (!ok) {
      return {
        content: `⏳ Bạn đã dùng hết **${access.limit} lượt/ngày**. Reset vào ngày mai (giờ VN), hoặc nâng cấp gói cao hơn để dùng nhiều/không giới hạn.`,
        ephemeral: true,
      };
    }
  }
  return null;
}
