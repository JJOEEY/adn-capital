"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, LineChart, ShieldCheck } from "lucide-react";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
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
        style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}
      >
        <PublicSiteHeader />

        <section className="relative flex min-h-[calc(100svh-76px)] w-full items-center overflow-hidden px-5 py-12 sm:px-8 lg:px-12 xl:px-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_86%_10%,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_8%_88%,rgba(245,158,11,0.10),transparent_30%)]" />
          <div className="grid w-full items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.div {...motionProps} className="max-w-[980px]">
              <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                {BRAND.company} - {BRAND.tagline}
              </p>
              <h1 className="mt-7 max-w-[8.7em] text-left text-[3rem] font-black leading-[1.12] tracking-[-0.018em] [word-spacing:0.035em] sm:text-[4.45rem] sm:leading-[1.09] sm:tracking-[-0.02em] md:text-[5.7rem] md:leading-[1.07] md:tracking-[-0.022em] md:[word-spacing:0.045em] lg:text-[6.55rem] xl:text-[7.45rem] xl:leading-[1.06] xl:tracking-[-0.024em] xl:[word-spacing:0.05em]">
                <span className="block md:text-justify md:[text-align-last:justify]">Nâng Tầm Trải</span>
                <span className="block md:text-justify md:[text-align-last:justify]">Nghiệm Đầu Tư</span>
                <span className="block md:text-justify md:[text-align-last:justify]">Cùng AI Chuyên</span>
                <span className="block">
                  Biệt tại{" "}
                  <span className="inline-block font-serif italic leading-[1.06] tracking-[-0.01em] text-[var(--primary)]">
                    ADN Capital
                  </span>
                </span>
              </h1>
              <p
                className="mt-8 max-w-3xl text-base leading-8 sm:text-lg sm:leading-9"
                style={{ color: "var(--text-secondary)" }}
              >
                {subheadline}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href="/auth?mode=register"
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-black sm:text-base"
                  style={{ background: "var(--primary)", color: "white" }}
                >
                  Đăng ký dùng thử MIỄN PHÍ <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#ecosystem"
                  className="inline-flex items-center gap-2 rounded-2xl border px-6 py-4 text-sm font-black sm:text-base"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  Trải nghiệm hệ sinh thái ADN <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </motion.div>

            <motion.div {...motionProps} transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}>
              <ControlRoomVisual />
            </motion.div>
          </div>
        </section>

        <section id="ecosystem" className="flex min-h-[100svh] w-full items-center px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="w-full">
            <motion.div {...motionProps} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-5xl">
                <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                  Hệ sinh thái ADN
                </p>
                <h2 className="mt-5 text-[clamp(2.75rem,5.8vw,6.2rem)] font-black uppercase leading-[0.99] tracking-[-0.06em]">
                  Một hệ sinh thái cho toàn bộ hành trình đầu tư
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
                  style={{ background: "var(--primary)", color: "white" }}
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
                    className="rounded-[2.35rem] border bg-white p-8 shadow-xl shadow-black/5 dark:bg-white/5"
                    style={{ borderColor: "var(--border)" }}
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
                    <h3 className="mt-3 text-4xl font-black tracking-[-0.04em]">{product.name}</h3>
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

        <section id="pricing" className="flex min-h-[100svh] w-full items-center px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="w-full">
            <motion.div {...motionProps} className="mb-10 max-w-5xl">
              <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                Hướng dẫn sử dụng
              </p>
              <h2 className="mt-5 text-[clamp(2.75rem,5.2vw,5.8rem)] font-black leading-[0.99] tracking-[-0.055em]">
                Bắt đầu miễn phí, có ADN Support khi cần đi sâu hơn.
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
                Trang chủ chỉ giải thích lựa chọn phù hợp. Bảng giá chi tiết và thanh toán PayOS nằm ở trang Bảng giá.
              </p>
            </motion.div>

            <div
              className="grid gap-0 overflow-hidden rounded-[2.5rem] border bg-white text-[var(--text-primary)] shadow-2xl shadow-black/5 dark:bg-[#151515] dark:text-white dark:shadow-black/40 lg:grid-cols-2"
              style={{ borderColor: "var(--border)" }}
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

        <section id="faq" className="min-h-[70svh] w-full px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <motion.div {...motionProps}>
              <p className="text-xs font-black uppercase tracking-[0.34em]" style={{ color: "var(--primary)" }}>
                FAQ
              </p>
              <h2 className="mt-6 text-[clamp(2.75rem,4.8vw,5.4rem)] font-black leading-[0.99] tracking-[-0.055em]">
                Những điểm cần rõ trước khi dùng.
              </h2>
            </motion.div>
            <div className="grid gap-4">
              {faqs.map((item) => (
                <motion.div
                  key={item.q}
                  {...motionProps}
                  className="rounded-[2rem] border bg-white p-6 dark:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
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

        <section id="contact" className="flex min-h-[70svh] w-full items-center px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div
            className="w-full rounded-[3rem] border bg-white p-8 text-center dark:bg-white/5 sm:p-12 lg:p-16"
            style={{ borderColor: "var(--border)" }}
          >
            <ShieldCheck className="mx-auto h-12 w-12 text-[var(--primary)]" />
            <h2 className="mx-auto mt-8 max-w-4xl text-[clamp(2.75rem,5.1vw,5.8rem)] font-black leading-[0.99] tracking-[-0.055em]">
              Mở ADN Capital và kiểm tra thị trường hôm nay.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl leading-8" style={{ color: "var(--text-secondary)" }}>
              Bắt đầu bằng dashboard dễ đọc, sau đó mở rộng sang ADN Lens, ADN ART và AIDEN khi cần phân tích sâu hơn.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/auth?mode=register" className="rounded-2xl px-6 py-4 font-black" style={{ background: "var(--primary)", color: "white" }}>
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

function ControlRoomVisual() {
  return (
    <div
      className="rounded-[2.2rem] border bg-white/85 p-4 text-[var(--text-primary)] shadow-2xl shadow-emerald-900/10 backdrop-blur dark:bg-[#161916] dark:text-white dark:shadow-emerald-950/20"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="rounded-[1.7rem] border bg-[var(--surface-2)] p-5 dark:bg-[#20231f]" style={{ borderColor: "var(--border)" }}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--primary)] dark:text-emerald-200/70">ADN Capital Control Room</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)] dark:text-white/55">Tích hợp đa lớp dữ liệu</p>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)] dark:border-white/10 dark:text-white/70" style={{ borderColor: "var(--border)" }}>
            15:30 VN
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.72fr_1fr_0.72fr]">
          <div className="grid gap-4">
            <DarkPanel title="ADN Pulse" subtitle="Nhịp thị trường">
              <div className="mt-4 h-16 rounded-2xl bg-[linear-gradient(135deg,rgba(239,68,68,.18),rgba(16,185,129,.22))]">
                <svg viewBox="0 0 240 70" className="h-full w-full" aria-hidden="true">
                  <path d="M4 48 C34 18, 60 60, 90 34 S142 20, 170 42 S210 12, 236 26" fill="none" stroke="#7dd3fc" strokeWidth="4" />
                </svg>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Thanh khoản" value="Theo dõi" />
                <Metric label="Độ rộng" value="Cân bằng" />
              </div>
            </DarkPanel>
            <DarkPanel title="ADN Radar" subtitle="Tín hiệu & trợ lý AIDEN">
              <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3 text-sm text-[var(--text-secondary)] dark:bg-black/20 dark:text-white/75">
                AIDEN: tín hiệu được đặt trong bối cảnh, không tự tạo lệnh.
              </div>
            </DarkPanel>
          </div>

          <DarkPanel title="ADN Score" subtitle="Chỉ số sức mạnh tổng hợp" center>
            <div
              className="mx-auto mt-6 h-48 w-48 rounded-full p-4"
              style={{
                background:
                  "conic-gradient(from 230deg, #ef4444 0deg, #f59e0b 82deg, #7c3aed 150deg, transparent 151deg)",
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[var(--surface-2)] dark:bg-[#20231f]">
                <p className="text-5xl font-black text-amber-300">8</p>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)] dark:text-white/55">Tích cực</p>
              </div>
            </div>
            <div className="mt-6 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-sm font-black text-amber-700 dark:text-amber-200">
              Gợi ý: theo dõi có kỷ luật
            </div>
          </DarkPanel>

          <div className="grid gap-4">
            <DarkPanel title="ADN Guard" subtitle="Quản trị rủi ro AI">
              <div className="mt-5 rounded-3xl bg-emerald-100/70 p-5 dark:bg-emerald-400/15">
                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-200">AN TOÀN</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)] dark:text-white/62">AI hỗ trợ theo dõi rủi ro hệ thống.</p>
              </div>
            </DarkPanel>
            <DarkPanel title="ADN Sync" subtitle="Đồng bộ trải nghiệm">
              <div className="mt-5 rounded-3xl bg-white/70 p-5 dark:bg-white/7">
                <p className="text-3xl font-black">HỆ THỐNG</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)] dark:text-white/62">Web, app và thông báo đi cùng quy trình vận hành.</p>
              </div>
            </DarkPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkPanel({
  title,
  subtitle,
  children,
  center = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`rounded-3xl border bg-white/72 p-5 shadow-sm shadow-black/5 dark:bg-black/16 dark:shadow-none ${center ? "text-center" : ""}`} style={{ borderColor: "var(--border)" }}>
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)] dark:text-white/55">{subtitle}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3 dark:bg-white/7">
      <p className="text-[var(--text-muted)] dark:text-white/45">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
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
          <div key={ticker} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-white/5">
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
          <div key={exchange} className="rounded-2xl bg-white p-3 text-center text-sm font-black dark:bg-white/5">
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
      className={`min-h-[650px] p-8 sm:p-10 lg:p-14 ${highlighted ? "bg-emerald-50/60 lg:border-l dark:bg-white/5" : "bg-white dark:bg-black/10"}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--text-muted)] dark:text-white/45">{eyebrow}</p>
        {highlighted ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-400/14 dark:text-amber-200">ADN SUPPORT</span> : null}
      </div>
      <h3 className="mt-12 font-serif text-[clamp(3rem,4.6vw,5.2rem)] font-black leading-none tracking-[-0.04em]">{title}</h3>
      <p className="mt-5 text-2xl font-black text-[var(--text-secondary)] dark:text-white/72">{subtitle}</p>
      <div className="mt-10 h-px bg-[var(--border)] dark:bg-white/10" />
      <div className="mt-10 grid gap-6">
        {items.map((item, index) => (
          <p key={item} className="grid grid-cols-[44px_1fr] gap-4 text-lg font-bold text-[var(--text-primary)] dark:text-white/82">
            <span className="font-mono text-[var(--text-muted)] dark:text-white/38">{String(index + 1).padStart(2, "0")}</span>
            <span>{item}</span>
          </p>
        ))}
      </div>
      <Link
        href={href}
        className={`mt-14 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-5 text-lg font-black ${highlighted ? "bg-[var(--primary)] text-white dark:bg-white dark:text-black" : "bg-[var(--text-primary)] text-[var(--page-surface)] dark:bg-black dark:text-white"}`}
      >
        {cta} <ArrowRight className="h-5 w-5" />
      </Link>
    </article>
  );
}
