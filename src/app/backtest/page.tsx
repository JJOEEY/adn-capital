"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { BacktestSection } from "@/components/dashboard/BacktestSection";
import { ShieldAlert, Zap, FlaskConical } from "lucide-react";

export default function BacktestPage() {
  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* ═══ HEADER ═══ */}
        <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-8">
          {/* Background decorations */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <FlaskConical className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">
                Simulation & Risk Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              HỆ THỐNG MÔ PHỎNG VÀ{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                QUẢN TRỊ RỦI RO
              </span>
            </h1>
            <p className="text-sm text-neutral-400 mt-2 max-w-2xl leading-relaxed">
              Trading theo phương pháp của ADN — Bảo toàn vốn và nhận biết rủi ro thông qua Leader.
            </p>

            {/* V18 Rule summary */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-2 text-xs bg-yellow-500/5 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Leader gãy <strong>1 sàn</strong> → Hạ 50% cash</span>
              </div>
              <div className="flex items-center gap-2 text-xs bg-red-500/5 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg">
                <Zap className="w-3.5 h-3.5" />
                <span>Leader gãy <strong>2 sàn</strong> → Clear 100% cash</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ BACKTEST — Kết quả mô phỏng ═══ */}
        <BacktestSection />
      </div>
    </MainLayout>
  );
}
