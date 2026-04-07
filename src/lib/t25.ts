/**
 * T+2.5 VNĐ Settlement Rule
 *
 * Trên thị trường chứng khoán Việt Nam, cổ phiếu mua ngày T sẽ về tài khoản vào T+2.5.
 * Tức là phải qua 2.5 ngày giao dịch (bỏ qua T7, CN) mới được bán.
 *
 * VD: Mua Thứ 2 -> Bán sớm nhất Thứ 4 chiều (T+2 buổi chiều = T+2.5)
 *     Mua Thứ 4 -> Bán sớm nhất Thứ Hai tuần sau (vì T5, T6 = +2, nhưng T7/CN bỏ qua)
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
 * T+2.5 = sau 2 ngày giao dịch đầy đủ + buổi chiều ngày thứ 3.
 * Trong thực tế: targetSellDate >= buyDate + 3 ngày giao dịch (đơn giản hóa).
 *
 * Theo quy định HOSE: Mua T, về TK T+2 buổi chiều -> bán được từ T+3 (ngày giao dịch).
 * Nhưng quy tắc T+2.5 cho phép bán buổi chiều T+2. Để đơn giản và an toàn:
 * Bán được khi targetSellDate >= buyDate + 3 ngày giao dịch (calendar-wise).
 *
 * Cập nhật: Theo luật VN hiện hành (T+2.5), cổ phiếu mua T sẽ:
 * - T+2 buổi chiều (14h): về TK
 * - Bán được chiều T+2 hoặc T+3 trở đi
 *
 * Ở đây ta dùng: bán được nếu targetSellDate >= ngày giao dịch thứ 3 tính từ buyDate.
 * Tức buyDate chỉ cần cách targetSellDate ít nhất 3 trading days.
 */
export function checkT25Eligibility(
  buyDate: Date | string,
  targetSellDate: Date | string
): { eligible: boolean; earliestSellDate: Date; tradingDaysLeft: number } {
  const buy = new Date(buyDate);
  const sell = new Date(targetSellDate);

  // Ngày bán sớm nhất = buyDate + 3 ngày giao dịch (T+2.5 rule)
  const earliestSellDate = addTradingDays(buy, 3);

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
    tradingDaysLeft: Math.max(0, 3 - tradingDays),
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
