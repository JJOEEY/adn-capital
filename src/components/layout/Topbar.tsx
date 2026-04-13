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
    <header className="fixed top-0 left-0 md:left-64 right-0 z-40 h-14 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between h-full px-4 md:px-6 pl-14 md:pl-6">
        <div className="flex items-center gap-3">
          {!showSkeleton && isAuthenticated && limit !== Infinity && (
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  className="h-full rounded-full transition-colors"
                  style={{ background: usagePercent >= 80 ? "var(--danger)" : "#10b981" }}
                />
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {usage}/{limit}
              </span>
            </div>
          )}
          {!showSkeleton && isAuthenticated && limit === Infinity && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: vipTier === "PREMIUM" ? "#f59e0b" : "#a855f7" }}>
              <Crown className="w-3 h-3" />
              <span>Không giới hạn</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showSkeleton ? (
            <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "var(--surface-2)" }} />
          ) : isAuthenticated ? (
            <>
              {role === "VIP" && (
                <div
                  className="flex items-center gap-1.5 text-[12px] font-bold border px-2 py-1 rounded-lg uppercase"
                  style={vipTier === "PREMIUM"
                    ? { background: "rgba(245,158,11,0.10)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)" }
                    : { background: "rgba(168,85,247,0.10)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" }
                  }>
                  <Crown className="w-2.5 h-2.5" />
                  {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                </div>
              )}

              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                {session?.user?.name?.split(" ").slice(-1)[0] ?? session?.user?.email?.split("@")[0]}
              </span>

              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border" style={{ borderColor: "var(--border)" }}
                />
              ) : (
                <UserCircle className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
              )}

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-1 transition-colors" style={{ color: "var(--text-muted)" }}
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
                className="flex items-center gap-2 text-xs border px-3 py-1.5 rounded-lg transition-all font-medium"
                style={{ color: "#16a34a", borderColor: "rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.08)" }}
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
