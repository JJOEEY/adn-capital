"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { BacktestSection } from "@/components/dashboard/BacktestSection";
import { StrategyValidationStudio } from "@/components/lab/StrategyValidationStudio";

export default function BacktestPage() {
  return (
    <MainLayout>
      <main className="mx-auto max-w-[1800px] space-y-8 p-4 md:p-6">
        <StrategyValidationStudio />

        <section
          className="rounded-[2rem] border p-5 md:p-7"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="max-w-3xl">
            <p
              className="text-xs font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Demo ADN hiện tại
            </p>
            <h2 className="mt-2 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              Kết quả kiểm chứng chiến thuật ADN
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Đây là demo cũ của ADN Lab, dùng dữ liệu snapshot đã lưu để xem nhanh hiệu suất,
              rủi ro và các tình huống tiêu biểu trong quá khứ.
            </p>
          </div>
        </section>

        <BacktestSection />
      </main>
    </MainLayout>
  );
}
