"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { UserRole } from "@/types";

interface CurrentDbUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "FREE" | "VIP";
  systemRole: "ADMIN" | "USER" | "WRITER";
  chatCount: number;
  usage?: {
    used: number;
    limit: number | null;
    remaining: number | null;
    isUnlimited: boolean;
    isLimitReached: boolean;
    mode: "daily" | "lifetime_package";
    limitSource: "guest" | "free" | "vip_plan" | "admin_override";
  };
  vipUntil: string | null;
  vipTier: "VIP" | "PREMIUM" | null;
  dnseId: string | null;
  dnseVerified: boolean;
  dnseAppliedAt: string | null;
  initialJournalNAV: number | null;
  enableAIReview: boolean;
  isAdmin?: boolean;
}

/**
 * Hook client-side lấy trạng thái đăng nhập NextAuth + role/chatCount từ Prisma.
 */
export function useCurrentDbUser() {
  const { data: session, status } = useSession();
  const isLoaded = status !== "loading";
  const isSignedIn = status === "authenticated";

  const [dbUser, setDbUser] = useState<CurrentDbUser | null>(null);
  const [isFetching, setIsFetching] = useState(true); // true ban đầu → tránh redirect sớm trước khi fetch /api/me xong

  useEffect(() => {
    let cancelled = false;

    async function fetchCurrentUser() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        setDbUser(null);
        setIsFetching(false);
        return;
      }

      setIsFetching(true);

      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json();

        if (!cancelled) {
          setDbUser(data.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setDbUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    }

    fetchCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const role: UserRole = !isSignedIn ? "GUEST" : (dbUser?.role ?? "FREE");
  const isAdmin = dbUser?.systemRole === "ADMIN" || !!dbUser?.isAdmin;
  const isWriter = isAdmin || dbUser?.systemRole === "WRITER";

  return {
    session,
    dbUser,
    role,
    vipTier: dbUser?.vipTier ?? null,
    isAuthenticated: !!isSignedIn,
    isGuest: !isSignedIn,
    isFreeUser: !!isSignedIn && role === "FREE" && !isAdmin,
    isVip: isAdmin || role === "VIP" || !!dbUser?.vipTier,
    isAdmin,
    isWriter,
    isLoading: !isLoaded || (isSignedIn && isFetching),
  };
}
