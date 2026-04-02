export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(price));
}

export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return String(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2).replace(".", ",")}%`;
}

/** Format số theo chuẩn VN (dấu chấm ngăn hàng nghìn, dấu phẩy thập phân) */
export function formatVN(value: number, decimals = 0): string {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format chỉ số (VN-INDEX, HNX...) với 2 số thập phân theo chuẩn VN */
export function formatIndex(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getRsColor(rs: number): string {
  if (rs > 90) return "text-purple-400";
  if (rs >= 80) return "text-emerald-400";
  if (rs >= 60) return "text-yellow-400";
  return "text-neutral-400";
}

export function getRsBgColor(rs: number): string {
  if (rs > 90) return "bg-purple-500/10 border-purple-500/30";
  if (rs >= 80) return "bg-emerald-500/10 border-emerald-500/30";
  if (rs >= 60) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-neutral-800/50 border-neutral-700";
}

export function getRsLabel(rs: number): string {
  if (rs > 90) return "Super Star";
  if (rs >= 80) return "Star";
  if (rs >= 60) return "Watch";
  return "Farmer";
}

export function getSignalColor(type: string): string {
  switch (type) {
    case "SIEU_CO_PHIEU":
      return "text-purple-400 border-purple-500/40 bg-purple-500/10";
    case "TRUNG_HAN":
      return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
    case "DAU_CO":
      return "text-yellow-400 border-yellow-500/40 bg-yellow-500/10";
    default:
      return "text-neutral-400 border-neutral-700 bg-neutral-800";
  }
}

export function getSignalLabel(type: string): string {
  switch (type) {
    case "SIEU_CO_PHIEU":
      return "Siêu Cổ Phiếu";
    case "TRUNG_HAN":
      return "Trung Hạn";
    case "DAU_CO":
      return "Lướt sóng";
    default:
      return "Unknown";
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export const USAGE_LIMITS: Record<string, number> = {
  GUEST: 3,
  FREE: 10,
  VIP: Infinity,
};
