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
 * Mức truy cập công cụ của 1 member (chọn tầng CAO NHẤT họ có):
 * - { level: "unlimited" }            → admin / Premium / VIP
 * - { level: "limited", limit: N }    → DNSE careby (10/ngày) hoặc Cộng đồng (3/ngày)
 * - { level: "none" }                 → chưa có quyền
 */
export function toolAccess(member) {
  try { if (member?.permissions?.has?.("Administrator")) return { level: "unlimited" }; } catch { /* noop */ }
  const cache = member?.roles?.cache;
  if (!cache) return { level: "none" };
  const has = (id) => Boolean(id) && cache.has(id);
  if (has(config.roles.vip) || has(config.roles.premium)) return { level: "unlimited" };
  if (has(config.roles.dnse)) return { level: "limited", limit: config.dnseDailyLimit };
  if (has(config.roles.community)) return { level: "limited", limit: config.communityDailyLimit };
  return { level: "none" };
}
