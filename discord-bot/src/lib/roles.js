import { config } from "../config.js";

/** Kiểm tra member có role tier yêu cầu không. tier: "premium" | "vip". */
export function hasTier(member, tier) {
  const roleId = config.roles[tier];
  if (!roleId) return true; // chưa cấu hình role → mở (dev)
  if (!member?.roles?.cache) return false;
  // VIP bao hàm premium
  if (tier === "premium" && config.roles.vip && member.roles.cache.has(config.roles.vip)) return true;
  return member.roles.cache.has(roleId);
}

export function tierDenyMessage(tier) {
  return {
    content: `🔒 Tính năng này dành cho thành viên **${tier.toUpperCase()}**. Liên hệ admin để nâng cấp.`,
    ephemeral: true,
  };
}
