"use client";

import Link from "next/link";
import { Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { PricingClient } from "@/app/pricing/PricingClient";
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
    eyebrow: "Tổng quan thị trường",
    title: "Một màn hình để đọc nhịp thị trường trong ngày.",
    body: "Chỉ số, thanh khoản, độ rộng, tin tức và dòng tiền được gom trong một góc nhìn dễ hiểu.",
    points: ["Thanh khoản 3 sàn", "Độ rộng thị trường", "Bản tin trong ngày"],
  },
  {
    id: "product-adn-lens",
    name: PRODUCT_NAMES.stock,
    eyebrow: "Soi từng cổ phiếu",
    title: "Đặt cổ phiếu vào bối cảnh dữ liệu trước khi hành động.",
    body: "Kết hợp kỹ thuật, cơ bản, tin tức và nhận định AIDEN để giảm quyết định cảm tính.",
    points: ["Kỹ thuật và cơ bản", "Tin tức liên quan", "Góc nhìn AIDEN"],
  },
  {
    id: "product-adn-art",
    name: PRODUCT_NAMES.art,
    eyebrow: "Action • Risk • Trend",
    title: "Đọc trạng thái hành động, rủi ro và xu hướng mà không lộ công thức.",
    body: "Gauge trực quan giúp nhà đầu tư biết nên quan sát, thận trọng hay tiếp tục theo dõi.",
    points: ["Gauge trạng thái", "Không công khai công thức", "Theo dõi rủi ro"],
  },
];

const faqs = [
  {
    q: "ADN Capital có tự động đặt lệnh cho khách hàng không?",
    a: "Không. Các tính năng liên quan hành động giao dịch vẫn cần xác thực, phiên hợp lệ và xác nhận của người dùng. DNSE real submit không được bật công khai.",
  },
  {
    q: "AIDEN có tự tạo tín hiệu mua bán không?",
    a: "Không. AIDEN giải thích, tóm tắt và cá nhân hóa bối cảnh từ dữ liệu có sẵn; tín hiệu gốc đi theo luồng kiểm soát riêng.",
  },
  {
    q: "Dùng thử VIP 1 tuần có tự kích hoạt không?",
    a: "Trial được dành cho tài khoản mới/chưa từng kích hoạt VIP hoặc thanh toán, nhằm tránh lạm dụng khuyến mãi.",
  },
];

export function HomePageV2() {
  const reduceMotion = useReducedMotion();
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 26 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.24 },
        transition: { duration: 0.55, ease: "easeOut" },
      };

  return (
    <PwaEntryRedirect>
      <main className="min-h-screen overflow-x-hidden" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
        <PublicSiteHeader />

        <section className="relative flex min-h-[100svh] w-full items-center overflow-hidden px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_86%_18%,rgba(22,101,52,0.26),transparent_34%),radial-gradient(circle_at_8%_72%,rgba(245,158,11,0.14),transparent_30%)]" />
          <div className="grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div {...motionProps}>
              <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>
                {BRAND.company} - {BRAND.tagline}
              </p>
              <h1 className="mt-8 max-w-6xl text-5xl font-black leading-[0.98] tracking-[-0.07em] sm:text-7xl lg:text-8xl 2xl:text-[8.5rem]">
                Nâng Tầm Trải Nghiệm Đầu Tư Cùng AI Chuyên Biệt tại{" "}
                <span className="font-serif italic tracking-[-0.05em] text-[var(--primary)]">ADN Capital</span>
              </h1>
              <p className="mt-8 max-w-4xl text-lg leading-8 sm:text-xl sm:leading-9" style={{ color: "var(--text-secondary)" }}>
                {subheadline}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/auth?mode=register" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-black" style={{ background: "var(--primary)", color: "white" }}>
                  Đăng ký dùng thử MIỄN PHÍ <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="#ecosystem" className="inline-flex items-center gap-2 rounded-2xl border px-6 py-4 text-base font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  Trải nghiệm hệ sinh thái ADN <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </motion.div>

            <motion.div {...motionProps} transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}>
              <div className="rounded-[3rem] border bg-white/75 p-4 shadow-2xl shadow-black/10 backdrop-blur dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="grid gap-4 lg:grid-cols-[0.72fr_1fr]">
                  <div className="rounded-[2rem] bg-[var(--surface-2)] p-5">
                    <div className="rounded-3xl bg-white p-5 dark:bg-white/5">
                      <p className="font-black">Nhà đầu tư cá nhân</p>
                      <p className="mt-2" style={{ color: "var(--text-secondary)" }}>Theo dõi thị trường trong ngày</p>
                    </div>
                    <div className="mt-36 rounded-3xl bg-white p-5 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>AIDEN Analyst</p>
                      <p className="mt-2 font-black">Giải thích dữ liệu, không tự tạo tín hiệu.</p>
                    </div>
                    <div className="mt-24 rounded-3xl bg-white p-5 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Luồng quyết định</p>
                      {["Đọc thị trường", "Chọn cơ hội", "Kiểm tra rủi ro", "Tự quyết định"].map((item) => (
                        <p key={item} className="mt-3 flex items-center gap-2 text-sm font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[2rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>ADN Capital Control Room</p>
                    <h2 className="mt-6 max-w-xl text-4xl font-black leading-tight">Một màn hình, nhiều lớp dữ liệu</h2>
                    <div className="mt-8 grid gap-4">
                      {[
                        ["Thị trường", "Thanh khoản, độ rộng, chỉ số"],
                        ["Cơ hội", "Tín hiệu mới và trạng thái theo dõi"],
                        ["Tư vấn", "Chat thường hoặc phân tích mã"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl border px-5 py-4" style={{ borderColor: "var(--border)" }}>
                          <span style={{ color: "var(--text-muted)" }}>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl bg-emerald-500/10 p-6">
                        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Quy tắc</p>
                        <p className="mt-4 text-5xl font-black">AN TOÀN</p>
                        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>AI hỗ trợ hiểu dữ liệu; hành động cuối cùng luôn do người dùng xác nhận.</p>
                      </div>
                      <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)" }}>
                        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Đồng bộ</p>
                        <p className="mt-4 text-5xl font-black">HỆ THỐNG</p>
                        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>Web, app và thông báo đi cùng một quy trình vận hành để giảm lệch thông tin.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="ecosystem" className="flex min-h-[100svh] w-full items-center px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="w-full">
            <motion.div {...motionProps} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>Hệ sinh thái ADN</p>
                <h2 className="mt-5 max-w-5xl text-5xl font-black uppercase tracking-[-0.05em] lg:text-7xl">
                  Một hệ sinh thái cho toàn bộ hành trình đầu tư
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/products" className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  Xem thêm <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/auth?mode=register" className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black" style={{ background: "var(--primary)", color: "white" }}>
                  Đăng ký dùng thử MIỄN PHÍ <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            <div id="products" className="mt-12 grid gap-5 lg:grid-cols-3">
              {ecosystemProducts.map((product) => (
                <motion.article
                  key={product.id}
                  id={product.id}
                  {...motionProps}
                  className="min-h-[560px] rounded-[2.5rem] border bg-white p-8 shadow-xl shadow-black/5 dark:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="text-xs font-black uppercase tracking-[0.26em]" style={{ color: "var(--text-muted)" }}>{product.eyebrow}</p>
                  <h3 className="mt-4 text-4xl font-black">{product.name}</h3>
                  <div className="mt-8 rounded-[2rem] bg-[var(--surface-2)] p-5">
                    <ProductMiniVisual name={product.name} />
                  </div>
                  <h4 className="mt-8 text-2xl font-black">{product.title}</h4>
                  <p className="mt-4 leading-8" style={{ color: "var(--text-secondary)" }}>{product.body}</p>
                  <div className="mt-6 grid gap-3">
                    {product.points.map((point) => (
                      <p key={point} className="flex items-center gap-2 font-bold" style={{ color: "var(--text-secondary)" }}>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" /> {point}
                      </p>
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="min-h-[100svh] w-full px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <motion.div {...motionProps} className="mb-10 max-w-5xl">
            <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>Bảng giá</p>
            <h2 className="mt-5 text-5xl font-black tracking-[-0.05em] lg:text-7xl">Bắt đầu miễn phí, nâng cấp khi cần sử dụng sâu hơn.</h2>
            <p className="mt-6 text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
              Mở tài khoản ngay để trải nghiệm VIP 1 tuần. Khách hàng mở tài khoản DNSE và bắt đầu giao dịch có thể nhận promo lên tới 40% sau khi mã khách hàng được admin duyệt.
            </p>
          </motion.div>
          <Suspense fallback={<div className="rounded-[2rem] border p-6 font-bold" style={{ borderColor: "var(--border)" }}>Dang tai bang gia...</div>}>
            <PricingClient />
          </Suspense>
        </section>

        <section id="faq" className="min-h-[70svh] w-full px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <motion.div {...motionProps}>
              <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>FAQ</p>
              <h2 className="mt-6 text-5xl font-black tracking-[-0.05em] lg:text-7xl">Những điểm cần rõ trước khi dùng.</h2>
            </motion.div>
            <div className="grid gap-4">
              {faqs.map((item) => (
                <motion.div key={item.q} {...motionProps} className="rounded-[2rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-xl font-black">{item.q}</h3>
                  <p className="mt-3 leading-8" style={{ color: "var(--text-secondary)" }}>{item.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="flex min-h-[70svh] w-full items-center px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="w-full rounded-[3rem] border bg-white p-8 text-center dark:bg-white/5 sm:p-12 lg:p-16" style={{ borderColor: "var(--border)" }}>
            <ShieldCheck className="mx-auto h-12 w-12 text-[var(--primary)]" />
            <h2 className="mx-auto mt-8 max-w-4xl text-5xl font-black tracking-[-0.05em] lg:text-7xl">Mở ADN Capital và kiểm tra thị trường hôm nay.</h2>
            <p className="mx-auto mt-6 max-w-2xl leading-8" style={{ color: "var(--text-secondary)" }}>
              Bắt đầu bằng dashboard dễ đọc, sau đó mở rộng sang ADN Lens, ADN ART và AIDEN khi cần phân tích sâu hơn.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/auth?mode=register" className="rounded-2xl px-6 py-4 font-black" style={{ background: "var(--primary)", color: "white" }}>Đăng ký dùng thử MIỄN PHÍ</Link>
              <Link href="/pricing" className="rounded-2xl border px-6 py-4 font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Xem bảng giá</Link>
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
      <div className="space-y-5">
        <div className="h-32 rounded-t-full border-8 border-b-0 border-emerald-500/50 bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200" />
        <div className="text-center">
          <p className="text-5xl font-black">2.70</p>
          <p className="font-black text-amber-500">TRUNG TÍNH</p>
        </div>
      </div>
    );
  }

  if (name === PRODUCT_NAMES.stock) {
    return (
      <div className="grid gap-3">
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
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        {[42, 64, 51, 80, 58, 76, 66].map((height, index) => (
          <div key={`${height}-${index}`} className="w-full rounded-t-xl bg-[var(--primary)]" style={{ height }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["HOSE", "HNX", "UPCOM"].map((exchange) => (
          <div key={exchange} className="rounded-2xl bg-white p-3 text-center text-sm font-black dark:bg-white/5">{exchange}</div>
        ))}
      </div>
    </div>
  );
}
