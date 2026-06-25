import { config } from "../config.js";

/** Kiểm tra member có role tier yêu cầu không. tier: "premium" | "vip". */
export function hasTier(member, tier) {
  const roleId = config.roles[tier];
  if (!roleId) return true; // chưa cấu hình role → mở (dev)
  // Admin / chủ server luôn qua (staff không bị chặn tier)
  try { if (member?.permissions?.has?.("Administrator")) return true; } catch { /* noop */ }
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

/**
 * Mức truy cập công cụ của 1 member:
 * - "unlimited": admin / Premium / VIP (dùng thả ga)
 * - "limited":   DNSE careby (giới hạn lượt/ngày)
 * - "none":      không có quyền
 */
export function toolAccess(member) {
  try { if (member?.permissions?.has?.("Administrator")) return "unlimited"; } catch { /* noop */ }
  const cache = member?.roles?.cache;
  if (!cache) return "none";
  if ((config.roles.vip && cache.has(config.roles.vip)) || (config.roles.premium && cache.has(config.roles.premium))) return "unlimited";
  if (config.roles.dnse && cache.has(config.roles.dnse)) return "limited";
  return "none";
}
