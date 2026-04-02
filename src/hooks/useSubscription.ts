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
    isAdmin,
    isGuest,
    isFreeUser,
  } = useCurrentDbUser();

  // ADMIN có toàn quyền, VIP mở khóa tính năng
  const hasFullAccess = isAdmin || isVip;
  // Signal Map: VIP hoặc ADMIN
  const isSignalLocked = !hasFullAccess;
  // RS Rating: VIP hoặc ADMIN
  const isRsRatingLocked = !hasFullAccess;
  // Phân tích tâm lý AI: VIP hoặc ADMIN
  const isPsychologyLocked = !hasFullAccess;
  // Nhật ký: VIP hoặc ADMIN
  const isJournalLocked = !hasFullAccess;

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
