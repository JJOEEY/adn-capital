const CUSTOMER_LABELS: Record<string, string> = {
  SIEU_CO_PHIEU: "Siêu cổ phiếu",
  TRUNG_HAN: "Trung hạn",
  NGAN_HAN: "Ngắn hạn",
  DAU_CO: "Lướt sóng",
  TAM_NGAM: "Tầm ngắm",
  LEADER: "Siêu cổ phiếu",
  RADAR: "Tầm ngắm",
  ACTIVE: "Đang theo dõi",
  HOLD_TO_DIE: "Gồng lãi",
  PENDING_EXIT: "Chờ thoát vị thế",
  CLOSED: "Đã đóng",
  OPEN: "Đang mở",
};

export function customerLabel(value: string | null | undefined, fallback = "--") {
  if (!value) return fallback;
  const key = value.trim().toUpperCase();
  if (CUSTOMER_LABELS[key]) return CUSTOMER_LABELS[key];
  return value
    .trim()
    .replace(/_/g, " ")
    .toLocaleLowerCase("vi-VN")
    .replace(/^\p{L}/u, (match) => match.toLocaleUpperCase("vi-VN"));
}
