"use client";

import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

export function Footer() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <footer className="mt-auto mx-3 mb-3 md:mx-0 md:mb-0">
      <div
        className={`rounded-2xl md:rounded-none transition-all duration-500 ${
          isDark
            ? "bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] md:border-x-0 md:border-b-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            : "bg-white/40 backdrop-blur-2xl border border-white/50 md:border-x-0 md:border-b-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-2">
              <p className={`text-sm font-black tracking-wide ${isDark ? "text-white/80" : "text-slate-800"}`}>
                ADN CAPITAL
              </p>
              <div className={`flex items-start gap-1.5 text-xs ${isDark ? "text-white/30" : "text-slate-500"}`}>
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>62 Ho&#xE0;ng Th&#x1EBF; Thi&#x1EC7;n, Ph&#x01B0;&#x1EDD;ng An Kh&#xE1;nh, Tp. H&#x1ED3; Ch&#xED; Minh</span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${isDark ? "text-white/30" : "text-slate-500"}`}>
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <a href="tel:0962977179" className={`transition-colors ${isDark ? "hover:text-white" : "hover:text-slate-900"}`}>
                  0962 977 179
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-medium ${isDark ? "text-white/20" : "text-slate-400"}`}>Contact Us</span>
              <a href="https://zalo.me/0962977179" target="_blank" rel="noopener noreferrer" aria-label="Zalo"
                className="w-10 h-10 rounded-xl overflow-hidden transition-all hover:scale-110 active:scale-95">
                <img src="/icons/zalo.svg" alt="Zalo" className="w-full h-full" />
              </a>
              <a href="https://www.facebook.com/adninvestment" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-10 h-10 rounded-xl overflow-hidden transition-all hover:scale-110 active:scale-95">
                <img src="/icons/facebook.svg" alt="Facebook" className="w-full h-full" />
              </a>
            </div>
          </div>
          <div className={`mt-5 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 ${
            isDark ? "border-white/[0.06]" : "border-slate-200/60"
          }`}>
            <p className={`text-[10px] ${isDark ? "text-white/20" : "text-slate-400"}`}>
              &copy; {new Date().getFullYear()} ADN Capital. All rights reserved.
            </p>
            <Link href="/pricing">
              <span className={`text-[10px] transition-colors cursor-pointer ${
                isDark ? "text-white/20 hover:text-emerald-400" : "text-slate-400 hover:text-emerald-500"
              }`}>
                B&#x1EA3;ng gi&#xE1; d&#x1ECB;ch v&#x1EE5;
              </span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
