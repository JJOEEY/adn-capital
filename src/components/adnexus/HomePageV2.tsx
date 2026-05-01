"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, LineChart, ShieldCheck } from "lucide-react";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { AdnHeroProductShowcase } from "./AdnHeroProductShowcase";
import { PublicSiteFooter } from "./PublicSiteFooter";
import { PublicSiteHeader } from "./PublicSiteHeader";

const subheadline =
  'Tối đa hóa hiệu suất danh mục và ra quyết định chuẩn xác với hệ sinh thái AI mang DNA của ngành quản lý tài sản. Được "đo ni đóng giày" cho các nhà đầu tư và công ty chứng khoán, đảm bảo tính khách quan và tuân thủ tuyệt đối.';

const ecosystemProducts = [
  {
    id: "product-adn-pulse",
    name: PRODUCT_NAMES.market,
    label: "Nhịp thị trường",
    text: "Tổng hợp chỉ số, thanh khoản, độ rộng và bản tin quan trọng trong ngày.",
    icon: BarChart3,
  },
  {
    id: "product-adn-lens",
    name: PRODUCT_NAMES.stock,
    label: "Góc nhìn cổ phiếu",
    text: "Đặt từng mã vào bối cảnh kỹ thuật, cơ bản, tin tức và nhận định AIDEN.",
    icon: LineChart,
  },
  {
    id: "product-adn-art",
    name: PRODUCT_NAMES.art,
    label: "Action - Risk - Trend",
    text: "Theo dõi trạng thái hành động, rủi ro và xu hướng mà không lộ công thức nội bộ.",
    icon: ShieldCheck,
  },
];

const faqs = [
  {
    q: "ADN Capital có tự động đặt lệnh cho khách hàng không?",
    a: "Không. Các tính năng liên quan hành động giao dịch luôn cần xác thực, phiên hợp lệ và xác nhận của người dùng. DNSE real submit không được bật công khai.",
  },
  {
    q: "AIDEN có tự tạo tín hiệu mua bán không?",
    a: "Không. AIDEN giải thích, tóm tắt và cá nhân hóa bối cảnh từ dữ liệu có sẵn; tín hiệu gốc đi theo luồng kiểm soát riêng.",
  },
  {
    q: "Dùng thử VIP 1 tuần áp dụng thế nào?",
    a: "Trial dành cho tài khoản mới hoặc khách hàng chưa từng kích hoạt VIP/payment, nhằm tránh lạm dụng khuyến mãi.",
  },
];

export function HomePageV2() {
  const reduceMotion = useReducedMotion();
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.22 },
        transition: { duration: 0.5, ease: "easeOut" },
      };

  return (
    <PwaEntryRedirect>
      <main
        className="min-h-screen overflow-x-hidden pt-[76px]"
        style={{ background: "var(--page-background)", color: "var(--text-primary)" }}
      >
        <PublicSiteHeader />

        <section className="relative flex min-h-[calc(100svh-76px)] w-full items-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:px-16">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 86% 10%, var(--glow-primary), transparent 32%), radial-gradient(circle at 8% 88%, var(--glow-secondary), transparent 30%)",
            }}
          />
          <div className="grid w-full min-w-0 items-center gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:gap-10">
            <motion.div
              {...motionProps}
              className="w-full min-w-0 max-w-[780px]"
            >
              <p className="max-w-full text-[0.68rem] font-black uppercase leading-5 tracking-[0.22em] sm:text-xs sm:tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                {BRAND.company} - {BRAND.tagline}
              </p>
              <h1 className="mt-6 max-w-[11.5em] text-left text-5xl font-black leading-[1.06] tracking-normal sm:text-6xl md:text-7xl lg:text-[4.6rem] xl:text-[4.85rem] 2xl:text-[5.15rem]">
                <span className="block">Nâng Tầm</span>
                <span className="block">Trải Nghiệm Đầu Tư</span>
                <span className="block text-[0.82em]">cùng AI Chuyên biệt</span>
                <span className="block text-[0.72em]">
                  tại{" "}
                  <span className="inline-block font-black leading-[1.08] tracking-normal text-[var(--primary)]">
                    ADN Capital
                  </span>
                </span>
              </h1>
              <p
                className="mt-6 max-w-[20.5rem] text-[0.95rem] leading-8 sm:max-w-2xl sm:text-lg sm:leading-9"
                style={{ color: "var(--text-secondary)" }}
              >
                {subheadline}
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link
                  href="/auth?mode=register"
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black sm:text-[0.95rem]"
                  style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                >
                  Đăng ký dùng thử MIỄN PHÍ <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#ecosystem"
                  className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-black sm:text-[0.95rem]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  Trải nghiệm hệ sinh thái ADN <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              {...motionProps}
              className="w-full min-w-0 overflow-hidden"
              transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}
            >
              <AdnHeroProductShowcase />
            </motion.div>
          </div>
        </section>

        <section id="ecosystem" className="mt-8 flex min-h-[100svh] w-full scroll-mt-24 items-center px-5 py-24 sm:px-8 lg:px-12 lg:py-32 xl:px-16">
          <div className="w-full">
            <motion.div {...motionProps} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-5xl">
                <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                  Hệ sinh thái ADN
                </p>
                <h2 className="mt-5 max-w-[720px] text-5xl font-black leading-[1.02] tracking-normal sm:text-6xl md:text-7xl lg:text-[5rem] xl:text-[5.6rem]">
                  <span className="block">All-in-one cho</span>
                  <span className="block">toàn bộ</span>
                  <span className="block">Hành trình đầu tư</span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 font-black"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  Xem thêm <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth?mode=register"
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black"
                  style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                >
                  Đăng ký dùng thử MIỄN PHÍ <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            <div id="products" className="mt-12 grid gap-5 lg:grid-cols-3">
              {ecosystemProducts.map((product) => {
                const Icon = product.icon;
                return (
                  <motion.article
                    key={product.id}
                    id={product.id}
                    {...motionProps}
                    className="rounded-[2.35rem] border p-8 shadow-xl shadow-black/5"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-8 text-xs font-black uppercase tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
                      {product.label}
                    </p>
                    <h3 className="mt-3 text-4xl font-black tracking-normal">{product.name}</h3>
                    <p className="mt-5 min-h-[84px] leading-8" style={{ color: "var(--text-secondary)" }}>
                      {product.text}
                    </p>
                    <ProductMiniVisual name={product.name} />
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-8 flex min-h-[100svh] w-full scroll-mt-24 items-center px-5 py-24 sm:px-8 lg:px-12 lg:py-32 xl:px-16">
          <div className="w-full">
            <motion.div {...motionProps} className="mb-10 max-w-5xl">
              <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                Hướng dẫn sử dụng
              </p>
              <h2 className="mt-5 text-[clamp(2.75rem,5.2vw,5.8rem)] font-black leading-[0.99] tracking-normal">
                Bắt đầu miễn phí, có ADN Support khi cần đi sâu hơn.
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
                Trang chủ chỉ giải thích lựa chọn phù hợp. Bảng giá chi tiết và thanh toán PayOS nằm ở trang Bảng giá.
              </p>
            </motion.div>

            <div
              className="grid gap-0 overflow-hidden rounded-[2.5rem] border shadow-2xl shadow-black/5 lg:grid-cols-2"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <SupportCard
                eyebrow="Gói 01 - Tự trải nghiệm"
                title="Free User"
                subtitle="Không có ADN Support"
                items={[
                  "Truy cập dashboard cơ bản",
                  "Đọc tin tức và dữ liệu công khai",
                  "Tự kiểm tra tín hiệu theo giao diện có sẵn",
                  "Không có hỗ trợ phân tích riêng từ đội ADN",
                  "Không ưu tiên xử lý yêu cầu cá nhân",
                ]}
                cta="Bắt đầu miễn phí"
                href="/auth?mode=register"
              />
              <SupportCard
                highlighted
                eyebrow="Gói 02 - VIP / Premium"
                title="VIP/PREMIUM User"
                subtitle="Có ADN Support"
                items={[
                  "Được hỗ trợ onboarding và sử dụng hệ sinh thái ADN",
                  "Nhận phân tích, cảnh báo và bối cảnh từ AIDEN sâu hơn",
                  "Ưu tiên hỗ trợ khi cần kiểm tra dữ liệu hoặc workflow",
                  "Có thể gửi mã khách hàng để admin duyệt ưu đãi",
                  "Phù hợp cho người dùng ADN Capital hằng ngày",
                ]}
                cta="Xem bảng giá"
                href="/pricing"
              />
            </div>
          </div>
        </section>

        <section id="faq" className="mt-8 min-h-[70svh] w-full scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12 lg:py-32 xl:px-16">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <motion.div {...motionProps}>
              <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                FAQ
              </p>
              <h2 className="mt-6 text-[clamp(2.75rem,4.8vw,5.4rem)] font-black leading-[0.99] tracking-normal">
                Những điểm cần rõ trước khi dùng.
              </h2>
            </motion.div>
            <div className="grid gap-4">
              {faqs.map((item) => (
                <motion.div
                  key={item.q}
                  {...motionProps}
                  className="rounded-[2rem] border p-6"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                >
                  <h3 className="text-xl font-black">{item.q}</h3>
                  <p className="mt-3 leading-8" style={{ color: "var(--text-secondary)" }}>
                    {item.a}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="mt-8 flex min-h-[70svh] w-full scroll-mt-24 items-center px-5 py-24 sm:px-8 lg:px-12 lg:py-32 xl:px-16">
          <div
            className="w-full rounded-[3rem] border p-8 text-center sm:p-12 lg:p-16"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <ShieldCheck className="mx-auto h-12 w-12 text-[var(--primary)]" />
            <h2 className="mx-auto mt-8 max-w-4xl text-[clamp(2.75rem,5.1vw,5.8rem)] font-black leading-[0.99] tracking-normal">
              Mở ADN Capital và kiểm tra thị trường hôm nay.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl leading-8" style={{ color: "var(--text-secondary)" }}>
              Bắt đầu bằng dashboard dễ đọc, sau đó mở rộng sang ADN Stock, ADN ART và AIDEN khi cần phân tích sâu hơn.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/auth?mode=register" className="rounded-2xl px-6 py-4 font-black" style={{ background: "var(--primary)", color: "var(--on-primary)" }}>
                Đăng ký dùng thử MIỄN PHÍ
              </Link>
              <Link href="/pricing" className="rounded-2xl border px-6 py-4 font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                Xem bảng giá
              </Link>
            </div>
          </div>
        </section>

        <PublicSiteFooter />
      </main>
    </PwaEntryRedirect>
  );
}

function ProductMiniVisual({ name }: { name: string }) {
  if (name === PRODUCT_NAMES.art) {
    return (
      <div className="mt-10 rounded-[2rem] bg-[var(--surface-2)] p-6">
        <div className="mx-auto h-28 max-w-64 rounded-t-full border-[18px] border-b-0 border-emerald-300 bg-gradient-to-r from-emerald-300 via-amber-300 to-red-300" />
        <div className="mt-4 text-center">
          <p className="text-5xl font-black">2.70</p>
          <p className="font-black text-amber-500">TRUNG TÍNH</p>
        </div>
      </div>
    );
  }

  if (name === PRODUCT_NAMES.stock) {
    return (
      <div className="mt-10 grid gap-3 rounded-[2rem] bg-[var(--surface-2)] p-5">
        {["HPG", "FPT", "MWG"].map((ticker, index) => (
          <div key={ticker} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface)" }}>
            <strong>{ticker}</strong>
            <span className={index === 1 ? "text-emerald-600" : "text-amber-600"}>{index === 1 ? "Mạnh" : "Theo dõi"}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-[2rem] bg-[var(--surface-2)] p-5">
      <div className="flex h-36 items-end gap-2">
        {[42, 64, 51, 80, 58, 76, 66].map((height, index) => (
          <div key={`${height}-${index}`} className="w-full rounded-t-xl bg-[var(--primary)]" style={{ height }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {["HOSE", "HNX", "UPCOM"].map((exchange) => (
          <div key={exchange} className="rounded-2xl p-3 text-center text-sm font-black" style={{ background: "var(--bg-surface)" }}>
            {exchange}
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportCard({
  eyebrow,
  title,
  subtitle,
  items,
  cta,
  href,
  highlighted = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`min-h-[650px] p-8 sm:p-10 lg:p-14 ${highlighted ? "lg:border-l" : ""}`}
      style={{ background: highlighted ? "var(--surface-2)" : "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--text-muted)]">{eyebrow}</p>
        {highlighted ? (
          <span
            className="rounded-full px-3 py-1 text-xs font-black"
            style={{ background: "color-mix(in srgb, var(--secondary) 16%, var(--bg-surface))", color: "var(--secondary)" }}
          >
            ADN SUPPORT
          </span>
        ) : null}
      </div>
      <h3 className="mt-12 text-[clamp(3rem,4.6vw,5.2rem)] font-black leading-none tracking-normal">{title}</h3>
      <p className="mt-5 text-2xl font-black text-[var(--text-secondary)]">{subtitle}</p>
      <div className="mt-10 h-px bg-[var(--border)]" />
      <div className="mt-10 grid gap-6">
        {items.map((item, index) => (
          <p key={item} className="grid grid-cols-[44px_1fr] gap-4 text-lg font-bold text-[var(--text-primary)]">
            <span className="font-mono text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</span>
            <span>{item}</span>
          </p>
        ))}
      </div>
      <Link
        href={href}
        className="mt-14 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-5 text-lg font-black"
        style={{
          background: highlighted ? "var(--primary)" : "var(--text-primary)",
          color: highlighted ? "var(--on-primary)" : "var(--page-surface)",
        }}
      >
        {cta} <ArrowRight className="h-5 w-5" />
      </Link>
    </article>
  );
}
