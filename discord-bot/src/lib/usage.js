// Đếm lượt dùng công cụ theo NGÀY (giờ VN) cho role DNSE.
// In-memory: reset khi bot restart (đủ dùng cho MVP; muốn bền thì chuyển sang DB sau).
const counts = new Map(); // `${userId}:${vnDate}` → số lượt đã dùng

function vnDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD
}

/** Tăng 1 lượt nếu còn quota. Trả {ok, remaining}. */
export function consumeDaily(userId, limit) {
  const key = `${userId}:${vnDate()}`;
  const used = counts.get(key) || 0;
  if (used >= limit) return { ok: false, remaining: 0 };
  counts.set(key, used + 1);
  return { ok: true, remaining: Math.max(0, limit - used - 1) };
}
