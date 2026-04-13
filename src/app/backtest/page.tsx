"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { BacktestSection } from "@/components/dashboard/BacktestSection";
import { ShieldAlert, Zap, FlaskConical } from "lucide-react";

export default function BacktestPage() {
  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* ═══ HEADER ═══ */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 sm:p-8"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="p-2 rounded-xl"
                style={{ background: "var(--primary-light)", border: "1px solid var(--border)" }}
              >
                <FlaskConical className="w-5 h-5" style={{ color: "var(--primary)" }} />
              </div>
              <span
                className="text-[12px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--primary)" }}
              >
                Simulation & Risk Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              HỆ THỐNG MÔ PHỎNG VÀ{" "}
              <span style={{ color: "var(--primary)" }}>QUẢN TRỊ RỦI RO</span>
            </h1>
            <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Trading theo phương pháp của ADN — Bảo toàn vốn và nhận biết rủi ro thông qua Leader.
            </p>

            {/* V18 Rule summary */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#f59e0b",
                }}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Leader gãy <strong>1 sàn</strong> → Hạ 50% cash</span>
              </div>
              <div
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                style={{
                  background: "rgba(192,57,43,0.08)",
                  border: "1px solid rgba(192,57,43,0.25)",
                  color: "var(--danger)",
                }}
              >
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
