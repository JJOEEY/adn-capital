"use client";

import { useState, useEffect } from "react";
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

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[150px]" style={{ background: "rgba(22,163,74,0.10)" }} />
          </div>

          {/* Logo */}
          <div className="relative z-10 flex animate-[adnSplashIn_500ms_ease-out] flex-col items-center gap-4">
            <Image
              src="/brand/logo-dark.jpg"
              alt="ADN Capital"
              width={128}
              height={128}
              className="rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.2)]"
              style={{ outline: "2px solid rgba(22,163,74,0.30)" }}
            />
            <div className="text-center">
              <h1 className="text-2xl font-black">
                <span style={{ color: "#16a34a" }}>ADN</span>{" "}
                <span style={{ color: "#fff" }}>Capital</span>
              </h1>
              <p className="text-[12px] tracking-[0.3em] uppercase mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>
                AI-Powered Investment
              </p>
            </div>
          </div>

          {/* Loading dots */}
          <div className="relative z-10 mt-8 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }}
                data-dot={i}
              />
            ))}
          </div>
    </div>
  );
}
