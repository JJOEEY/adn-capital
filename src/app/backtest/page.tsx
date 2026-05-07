"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { StrategyValidationStudio } from "@/components/lab/StrategyValidationStudio";

export default function BacktestPage() {
  return (
    <MainLayout>
      <StrategyValidationStudio />
    </MainLayout>
  );
}
