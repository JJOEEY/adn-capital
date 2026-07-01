/**
 * T+2.5 VNĐ Settlement Rule
 *
 * Trên thị trường chứng khoán Việt Nam, cổ phiếu mua ngày T sẽ về tài khoản vào T+2.5.
 * Tức là phải qua 2.5 ngày giao dịch (bỏ qua T7, CN) mới được bán.
 *
 * VD: Mua Thứ 2 -> Bán sớm nhất Thứ 4 chiều (T+2 buổi chiều = T+2.5)
 *     Mua Thứ 4 -> Bán sớm nhất Thứ 6 chiều (T5 = +1, T6 = +2 -> về TK chiều T6)
 */

/**
 * Tính ngày giao dịch thứ N kế tiếp (bỏ qua T7, CN).
 */
function addTradingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Kiểm tra xem cổ phiếu mua vào buyDate có đủ T+2.5 để bán vào targetSellDate không.
 *
 * Theo luật VN hiện hành (T+2.5): cổ phiếu mua ngày T (T = ngày mua, không tính vào)
 * sẽ về tài khoản chiều T+2 (~13h) và bán được ngay chiều đó.
 * Ngày mua KHÔNG tính vào -> ngày bán sớm nhất = buyDate + 2 ngày giao dịch.
 *
 * VD: Mua Thứ 2 (T) -> +1 Thứ 3 -> +2 Thứ 4 => bán được chiều Thứ 4.
 *
 * Ở đây ta dùng: bán được nếu targetSellDate >= ngày giao dịch thứ 2 tính từ buyDate.
 */
export function checkT25Eligibility(
  buyDate: Date | string,
  targetSellDate: Date | string
): { eligible: boolean; earliestSellDate: Date; tradingDaysLeft: number } {
  const buy = new Date(buyDate);
  const sell = new Date(targetSellDate);

  // Ngày bán sớm nhất = buyDate + 2 ngày giao dịch (T+2.5: về TK chiều T+2)
  const earliestSellDate = addTradingDays(buy, 2);

  // Reset giờ để so sánh ngày
  const sellDay = new Date(sell.getFullYear(), sell.getMonth(), sell.getDate());
  const earliestDay = new Date(
    earliestSellDate.getFullYear(),
    earliestSellDate.getMonth(),
    earliestSellDate.getDate()
  );

  // Đếm ngày giao dịch từ buy -> sell
  let tradingDays = 0;
  const cursor = new Date(buy);
  while (cursor < sellDay) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      tradingDays++;
    }
  }

  return {
    eligible: sellDay >= earliestDay,
    earliestSellDate,
    tradingDaysLeft: Math.max(0, 2 - tradingDays),
  };
}

/**
 * Tìm lệnh MUA gần nhất của một mã cổ phiếu cho user,
 * dùng để kiểm tra T+2.5 khi user muốn BÁN.
 */
export function formatEarliestSellDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
