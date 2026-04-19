"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { BacktestSection } from "@/components/dashboard/BacktestSection";
import { ProviderWorkbench } from "@/components/providers/ProviderWorkbench";
import { ShieldAlert, Zap, FlaskConical } from "lucide-react";

export default function BacktestPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-5 p-3 md:p-6">
        <div
          className="relative overflow-hidden rounded-2xl p-5 sm:p-8"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="rounded-xl p-2"
                style={{ background: "var(--primary-light)", border: "1px solid var(--border)" }}
              >
                <FlaskConical className="h-5 w-5" style={{ color: "var(--primary)" }} />
              </div>
              <span
                className="text-[12px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--primary)" }}
              >
                Simulation & Risk Management
              </span>
            </div>

            <h1 className="text-2xl font-black leading-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>
              HE THONG MO PHONG VA <span style={{ color: "var(--primary)" }}>QUAN TRI RUI RO</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Trading theo phuong phap ADN. Bao toan von va nhan biet rui ro thong qua Leader.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#f59e0b",
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>
                  Leader gay <strong>1 san</strong> -&gt; ha 50% cash
                </span>
              </div>

              <div
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                style={{
                  background: "rgba(192,57,43,0.08)",
                  border: "1px solid rgba(192,57,43,0.25)",
                  color: "var(--danger)",
                }}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  Leader gay <strong>2 san</strong> -&gt; clear 100% cash
                </span>
              </div>
            </div>
          </div>
        </div>

        <BacktestSection />
        <ProviderWorkbench />
      </div>
    </MainLayout>
  );
}
