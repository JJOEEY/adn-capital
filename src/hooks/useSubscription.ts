"use client";

import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

/**
 * Hook kiểm tra quyền truy cập dựa trên subscription.
 * Trả về trạng thái khóa tính năng cho từng mức gói.
 */
export function useSubscription() {
  const {
    role,
    isAuthenticated,
    isLoading,
    isVip,
    isGuest,
    isFreeUser,
  } = useCurrentDbUser();

  // Signal Map: chỉ VIP mới dùng được
  const isSignalLocked = !isVip;
  // RS Rating: chỉ VIP
  const isRsRatingLocked = !isVip;
  // Phân tích tâm lý AI: chỉ VIP
  const isPsychologyLocked = !isVip;
  // Nhật ký: cần đăng nhập + VIP
  const isJournalLocked = !isVip;

  return {
    role,
    isAuthenticated,
    isLoading,
    isVip,
    isFreeUser,
    isGuest,
    isSignalLocked,
    isRsRatingLocked,
    isPsychologyLocked,
    isJournalLocked,
  };
}
