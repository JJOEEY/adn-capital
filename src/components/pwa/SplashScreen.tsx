"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

/**
 * SplashScreen — hiển thị khi mở app ở chế độ standalone (PWA).
 * Logo ADN Capital + animation, tự ẩn sau 1.5s.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]"
        >
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[150px]" />
          </div>

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center gap-4"
          >
            <Image
              src="/logo.jpg"
              alt="ADN Capital"
              width={80}
              height={80}
              className="rounded-2xl ring-2 ring-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
            />
            <div className="text-center">
              <h1 className="text-2xl font-black">
                <span className="text-emerald-400">ADN</span>{" "}
                <span className="text-white">Capital</span>
              </h1>
              <p className="text-[10px] text-white/30 tracking-[0.3em] uppercase mt-1">
                AI-Powered Investment
              </p>
            </div>
          </motion.div>

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="relative z-10 mt-8 flex gap-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
