"use client";

import { motion } from "framer-motion";
import { Lock, Crown } from "lucide-react";
import Link from "next/link";

/**
 * LockOverlay - Component khóa tính năng cho tài khoản chưa VIP.
 * Hiện icon ổ khóa và thông báo nâng cấp VIP.
 * Sử dụng: Bọc quanh nội dung cần khóa, truyền prop isLocked=true để kích hoạt.
 */
interface LockOverlayProps {
  /** Có khóa hay không */
  isLocked: boolean;
  /** Nội dung bên trong (vẫn render nhưng bị mờ khi khóa) */
  children: React.ReactNode;
  /** Thông báo tùy chỉnh */
  message?: string;
  /** Ẩn nội dung hoàn toàn thay vì làm mờ */
  hideContent?: boolean;
}

export function LockOverlay({
  isLocked,
  children,
  message = "Nâng cấp VIP để sử dụng",
  hideContent = false,
}: LockOverlayProps) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Nội dung bị làm mờ phía sau */}
      {!hideContent && (
        <div className="pointer-events-none select-none blur-sm opacity-30">
          {children}
        </div>
      )}
      {hideContent && (
        <div className="min-h-[300px]" />
      )}

      {/* Overlay khóa phía trên */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/60 backdrop-blur-[2px] rounded-2xl"
      >
        <div className="flex flex-col items-center text-center px-6 py-8">
          {/* Icon ổ khóa */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4 shadow-lg"
          >
            <Lock className="w-7 h-7 text-neutral-400" />
          </motion.div>

          {/* Thông báo */}
          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-base font-bold text-white mb-2"
          >
            🔒 Tính năng VIP
          </motion.p>
          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-neutral-400 mb-5 max-w-xs"
          >
            {message}
          </motion.p>

          {/* Nút nâng cấp */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/25"
            >
              <Crown className="w-4 h-4" />
              Nâng cấp VIP
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
