"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { BacktestSection } from "@/components/dashboard/BacktestSection";
import { ProviderWorkbench } from "@/components/providers/ProviderWorkbench";
import { BarChart3, CheckCircle2, FlaskConical, ShieldAlert, TrendingDown } from "lucide-react";

const methodCards = [
  {
    icon: BarChart3,
    title: "Kiểm tra phương pháp",
    body: "Xem một bộ quy tắc đã phản ứng thế nào trên dữ liệu quá khứ trước khi dùng cho hiện tại.",
  },
  {
    icon: TrendingDown,
    title: "Nhìn rõ rủi ro",
    body: "Theo dõi giai đoạn thua lỗ, số lần sai và mức sụt giảm để tránh chỉ nhìn vào lợi nhuận đẹp.",
  },
  {
    icon: CheckCircle2,
    title: "Học kỷ luật vốn",
    body: "Backtest giúp khách hàng hiểu vì sao cần điểm cắt lỗ, tỷ trọng và quy tắc thoát lệnh.",
  },
];

export default function BacktestPage() {
  return (
    <MainLayout>
      <main className="mx-auto max-w-7xl space-y-6 p-3 md:p-6">
        <section
          className="relative overflow-hidden rounded-[2rem] border p-6 sm:p-8"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="relative z-10 max-w-3xl">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="rounded-xl border p-2"
                style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}
              >
                <FlaskConical className="h-5 w-5" style={{ color: "var(--primary)" }} />
              </div>
              <span
                className="text-[12px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--primary)" }}
              >
                Backtest & quản trị rủi ro
              </span>
            </div>

            <h1 className="text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl" style={{ color: "var(--text-primary)" }}>
              Kiểm chứng một phương pháp trước khi tin vào nó.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              Backtest không dùng để hứa lợi nhuận. Mục tiêu là giúp khách hàng hiểu phương pháp có ưu điểm gì,
              rủi ro nằm ở đâu và khi nào cần giảm tỷ trọng.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#b7791f",
                }}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Không xem backtest như cam kết lợi nhuận tương lai.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {methodCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-[1.5rem] border p-5"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <span
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="font-black">{card.title}</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  {card.body}
                </p>
              </article>
            );
          })}
        </section>

        <BacktestSection />
        <ProviderWorkbench />
      </main>
    </MainLayout>
  );
}
