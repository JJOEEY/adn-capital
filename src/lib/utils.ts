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

/** Returns a hex color for an RS score badge text */
export function getRsColor(rs: number): string {
  if (rs > 90) return "#a855f7"; // purple
  if (rs >= 80) return "#16a34a"; // emerald
  if (rs >= 60) return "#eab308"; // yellow
  return "var(--text-muted)";
}


/** Returns inline style object { background, borderColor } for RS chip */
export function getRsBgStyle(rs: number): React.CSSProperties {
  if (rs > 90) return { background: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.30)" };
  if (rs >= 80) return { background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.30)" };
  if (rs >= 60) return { background: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.30)" };
  return { background: "var(--surface-2)", borderColor: "var(--border)" };
}

export function getRsLabel(rs: number): string {
  if (rs > 90) return "Super Star";
  if (rs >= 80) return "Star";
  if (rs >= 60) return "Watch";
  return "Farmer";
}

/** Returns inline style object { color, background, borderColor } for signal type badge */
export function getSignalStyle(type: string): React.CSSProperties {
  switch (type) {
    case "SIEU_CO_PHIEU":
      return { color: "#a855f7", background: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.40)" };
    case "TRUNG_HAN":
      return { color: "#16a34a", background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.40)" };
    case "DAU_CO":
      return { color: "#eab308", background: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.40)" };
    default:
      return { color: "var(--text-muted)", background: "var(--surface-2)", borderColor: "var(--border)" };
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
  FREE: 5,
  VIP: Infinity,
  ADMIN: Infinity,
};
