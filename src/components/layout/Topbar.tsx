"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LogIn, Crown, Zap, LogOut, UserCircle } from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { USAGE_LIMITS } from "@/lib/utils";

export function Topbar() {
  const { dbUser, role, vipTier, isAuthenticated, isLoading } = useCurrentDbUser();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const limit = USAGE_LIMITS[role] ?? 3;
  const usage = dbUser?.chatCount ?? 0;
  const usagePercent = limit === Infinity ? 0 : Math.min((usage / limit) * 100, 100);

  const showSkeleton = !mounted || isLoading;

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 z-40 h-14 border-b border-neutral-800/60 bg-neutral-950/90 backdrop-blur-md">
      <div className="flex items-center justify-between h-full px-4 md:px-6 pl-14 md:pl-6">
        <div className="flex items-center gap-3">
          {!showSkeleton && isAuthenticated && limit !== Infinity && (
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-neutral-500" />
              <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  className={`h-full rounded-full transition-colors ${
                    usagePercent >= 80 ? "bg-red-500" : "bg-emerald-500"
                  }`}
                />
              </div>
              <span className="text-xs text-neutral-500">
                {usage}/{limit}
              </span>
            </div>
          )}
          {!showSkeleton && isAuthenticated && limit === Infinity && (
            <div className={`flex items-center gap-1.5 text-xs ${vipTier === "PREMIUM" ? "text-amber-400" : "text-purple-400"}`}>
              <Crown className="w-3 h-3" />
              <span>Không giới hạn</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showSkeleton ? (
            <div className="w-8 h-8 rounded-full bg-neutral-800 animate-pulse" />
          ) : isAuthenticated ? (
            <>
              {role === "VIP" && (
                <div className={`flex items-center gap-1.5 text-[12px] font-bold border px-2 py-1 rounded-lg uppercase ${
                  vipTier === "PREMIUM"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                }`}>
                  <Crown className="w-2.5 h-2.5" />
                  {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                </div>
              )}

              <span className="text-xs text-neutral-300 font-medium">
                {session?.user?.name?.split(" ").slice(-1)[0] ?? session?.user?.email?.split("@")[0]}
              </span>

              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-neutral-700"
                />
              ) : (
                <UserCircle className="w-8 h-8 text-neutral-600" />
              )}

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <Link href="/auth">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 text-xs text-emerald-400 border border-emerald-500/35 px-3 py-1.5 rounded-lg bg-emerald-500/8 hover:bg-emerald-500/15 transition-all font-medium"
              >
                <LogIn className="w-3.5 h-3.5" />
                Đăng nhập
              </motion.button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
