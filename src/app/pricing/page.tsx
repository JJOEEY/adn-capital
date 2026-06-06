import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Bảng giá dịch vụ ADN Capital",
  description:
    "Chọn thời hạn sử dụng hệ sinh thái ADN Capital: ADN Base, ADN VIP hoặc ADN Premium.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0D0D10] text-[#F8F1E6]">
      <header className="border-b border-white/10 bg-[#111216]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="group inline-flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FFD166]/35 bg-[#FFD166]/10 text-lg font-black text-[#FFD166]">
              ADN
            </div>
            <div>
              <p className="text-lg font-black leading-[1.25] text-[#F8F1E6]">ADN Capital</p>
              <p className="text-sm leading-[1.7] text-[#BFB8AE]">Hệ thống giao dịch định lượng</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#CFC7BA] md:flex">
            <Link href="/" className="transition hover:text-[#FFD166]">
              Trang chủ
            </Link>
            <Link href="/products" className="transition hover:text-[#FFD166]">
              Công cụ
            </Link>
            <Link href="/#journey" className="transition hover:text-[#FFD166]">
              Lộ trình
            </Link>
            <Link href="/pricing" className="text-[#FFD166]">
              Dịch vụ
            </Link>
          </nav>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-[#F8F1E6] transition hover:border-[#FFD166]/60 hover:text-[#FFD166]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,209,102,0.14),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.09),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#FFD166]">Dịch vụ</p>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[1.15] tracking-tight text-[#F8F1E6] md:text-7xl">
              Hệ sinh thái{" "}
              <span className="text-[#FFD166]">ADNCapital</span>
              <br />
              <span className="text-[#FFD166]">
                Mở khóa toàn diện giải pháp đầu tư.
              </span>
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-[1.7] text-[#CFC7BA]">
              Anh/chị chọn thời hạn sử dụng phù hợp với nhịp đầu tư của mình. Ba gói khác nhau ở
              thời gian đồng hành; giá trị cốt lõi vẫn là một hệ sinh thái công cụ rõ ràng, dễ theo
              dõi và có thể dùng hằng ngày.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#goi-dich-vu"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#FFD166] px-7 text-base font-bold text-[#101114] transition hover:bg-[#FFE09A]"
              >
                Xem gói dịch vụ
                <ArrowRight className="h-5 w-5" />
              </a>
              <Link
                href="/products"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/14 bg-white/5 px-7 text-base font-bold text-[#F8F1E6] transition hover:border-[#FFD166]/60 hover:text-[#FFD166]"
              >
                Xem công cụ
              </Link>
            </div>
          </div>

          <div className="rounded-[40px] border border-white/14 bg-white/[0.04] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.35)]">
            <div className="rounded-[30px] border border-[#FFD166]/30 bg-[#1A1714] p-7">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#FFD166]">
                Quyền dùng rõ ràng
              </p>
              <h2 className="mt-5 text-4xl font-black leading-[1.15] tracking-tight text-[#F8F1E6]">
                Trả theo thời hạn, dùng trong đúng gói đã chọn.
              </h2>
              <div className="mt-8 space-y-4">
                {[
                  "Mỗi gói hội viên phù hợp với một nhu cầu sử dụng khác nhau.",
                  "Có thể nâng cấp từ ADN Base hoặc ADN VIP lên ADN Premium; thời gian còn lại sẽ được quy đổi và cộng thêm vào gói mới.",
                  "Mã giới thiệu hợp lệ giúp cộng thêm thời gian sử dụng khi đủ điều kiện.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-[#0D0D10] px-5 py-4 text-sm leading-[1.7] text-[#E8DED0]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="goi-dich-vu" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <Suspense
          fallback={
            <div className="flex min-h-[360px] items-center justify-center rounded-[32px] border border-white/12 bg-[#141519] text-[#FFD166]">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Đang tải bảng giá...
            </div>
          }
        >
          <PricingClient />
        </Suspense>
      </section>

      <footer className="border-t border-white/10 bg-[#111216]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm leading-[1.7] text-[#9D958C] md:flex-row md:items-center md:justify-between lg:px-8">
          <p>ADN Capital - Hệ thống giao dịch định lượng.</p>
          <p>Phân tích tham khảo, không phải khuyến nghị đầu tư.</p>
        </div>
      </footer>
    </main>
  );
}
