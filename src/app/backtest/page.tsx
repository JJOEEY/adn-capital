"use client";

import { FlaskConical } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StrategyValidationStudio } from "@/components/lab/StrategyValidationStudio";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

export default function BacktestPage() {
  const { isAdmin, isLoading } = useCurrentDbUser();

  return (
    <MainLayout>
      <main className="mx-auto max-w-[1800px] space-y-8 p-4 md:p-6">
        {isLoading ? null : isAdmin ? (
          <StrategyValidationStudio />
        ) : (
          <div
            className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border p-10 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="rounded-2xl p-4" style={{ background: "var(--primary-light)" }}>
              <FlaskConical className="h-8 w-8" style={{ color: "var(--primary)" }} />
            </div>
            <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Nội dung đang được phát triển
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              ADN Lab — phòng kiểm định chiến thuật — đang được hoàn thiện. Tính năng sẽ sớm mở cho thành viên.
            </p>
          </div>
        )}
      </main>
    </MainLayout>
  );
}
