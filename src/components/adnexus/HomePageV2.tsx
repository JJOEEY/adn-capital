"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { BRAND } from "@/lib/brand/productNames";
import { PRODUCT_MODULES, PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";
import { PublicSiteHeader } from "./PublicSiteHeader";
import { PublicSiteFooter } from "./PublicSiteFooter";
import { ProductModuleCard } from "./ProductModuleCard";
import { ProductSceneVisual } from "./ProductScenes";

const heroModules = ["nexpulse", "nexpilot", "nexart", "aiden-advisory", "nexrank"];
const storyModules = [
  "nexpulse",
  "nexlens",
  "nexradar",
  "nexrank",
  "nexart",
  "nexguard",
  "nexvault",
  "nexlink",
  "nexpilot",
  "nexlab",
  "nexsentinel",
  "aiden-advisory",
];

const faqItems = [
  [
    "ADNexus có tự động đặt lệnh không?",
    "Không. Public workflow chỉ hỗ trợ đọc dữ liệu, xem trước hành động và giữ kỷ luật. Hành động nhạy cảm cần xác thực, phiên hợp lệ và chính sách cho phép.",
  ],
  [
    "AIDEN có tự sinh tín hiệu gốc không?",
    "Không. AIDEN giải thích, tóm tắt và cá nhân hóa theo dữ liệu/hồ sơ được phép. Tín hiệu gốc đi theo quy trình kiểm soát riêng.",
  ],
  [
    "NexLink đã public chưa?",
    "Chưa. NexLink là broker workflow pilot/admin cho tới khi có đủ xác thực, vận hành và sign-off.",
  ],
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export function HomePageV2() {
  const reduceMotion = useReducedMotion();
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 30 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.22 },
        transition: { duration: 0.6, ease: "easeOut" },
      };

  return (
    <PwaEntryRedirect>
      <main className="min-h-screen overflow-x-hidden md:snap-y md:snap-proximity" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <PublicSiteHeader />

        <section className="relative flex min-h-[100svh] w-screen snap-start items-center px-5 pb-20 pt-32 sm:px-8 lg:px-12 xl:px-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(22,101,52,0.20),transparent_34%),linear-gradient(135deg,rgba(6,30,20,0.12),transparent_45%)]" />
          <div className="grid w-full items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.div {...motionProps}>
              <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>
                {BRAND.platform} - {BRAND.tagline}
              </p>
              <h1 className="mt-8 max-w-6xl text-6xl font-black leading-[0.92] tracking-[-0.08em] sm:text-7xl lg:text-8xl 2xl:text-[9rem]">
                Nền tảng AI + Broker Workflow cho chứng khoán Việt Nam.
              </h1>
              <p className="mt-8 max-w-3xl text-xl leading-9" style={{ color: "var(--text-secondary)" }}>
                Phân tích thị trường, giữ kỷ luật giao dịch và kết nối danh mục/tài khoản trong một workflow duy nhất.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-black" style={{ background: "var(--primary)", color: "white" }}>
                  Dùng thử dashboard <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="#workflow" className="inline-flex items-center gap-2 rounded-2xl border px-6 py-4 text-base font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  Xem ADNexus vận hành danh mục <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-2">
                {heroModules.map((slug) => {
                  const product = PRODUCT_MODULES.find((item) => item.slug === slug);
                  return product ? (
                    <Link key={slug} href={`#product-${slug}`} className="rounded-full border px-4 py-2 text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      {product.shortName ?? product.name}
                    </Link>
                  ) : null;
                })}
              </div>
            </motion.div>

            <motion.div {...motionProps} transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}>
              <div className="adn-motion-frame rounded-[3rem] border bg-white/70 p-4 shadow-2xl shadow-black/10 backdrop-blur dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="grid gap-4 lg:grid-cols-[0.72fr_1fr]">
                  <div className="rounded-[2rem] bg-[var(--surface-2)] p-5">
                    <MiniPersona />
                    <div className="mt-24 rounded-3xl bg-white p-5 dark:bg-white/5 lg:mt-44">
                      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>AIDEN Analyst</p>
                      <p className="mt-2 font-black">Giải thích dữ liệu, không tự tạo tín hiệu.</p>
                    </div>
                    <div className="mt-10 rounded-3xl bg-white p-5 dark:bg-white/5 lg:mt-28">
                      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Luồng quyết định</p>
                      {["Đọc thị trường", "Chọn cơ hội", "Kiểm tra rủi ro", "Tự quyết định"].map((item) => (
                        <p key={item} className="mt-3 flex items-center gap-2 text-sm font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[2rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>ADNexus Control Room</p>
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
                        <p className="mt-4 text-5xl font-black">SAFE</p>
                        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>AI hỗ trợ hiểu dữ liệu; hành động cuối cùng luôn do người dùng xác nhận.</p>
                      </div>
                      <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)" }}>
                        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Đồng bộ</p>
                        <p className="mt-4 text-5xl font-black">1 nguồn</p>
                        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>Web, app và thông báo đọc cùng dữ liệu để giảm lệch thông tin.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <WorkflowSection motionProps={motionProps} />
        <ProductsSection motionProps={motionProps} />

        {storyModules.map((slug, index) => {
          const product = PRODUCT_MODULES.find((item) => item.slug === slug);
          if (!product) return null;
          const reverse = index % 2 === 1;
          return (
            <section key={product.slug} id={`product-${product.slug}`} className="flex min-h-[100svh] w-screen snap-start items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
              <div className={`grid w-full items-center gap-12 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <motion.div {...motionProps}>
                  <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>{product.name} - {product.pillar}</p>
                  <h2 className="mt-7 text-5xl font-black leading-[0.98] tracking-[-0.06em] lg:text-7xl">{product.outcome}</h2>
                  <p className="mt-7 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>{product.tagline}</p>
                  <div className="mt-8 grid gap-3">
                    {product.bullets.map((bullet) => (
                      <p key={bullet} className="flex items-center gap-3 font-bold" style={{ color: "var(--text-secondary)" }}>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" /> {bullet}
                      </p>
                    ))}
                  </div>
                  {product.safetyNote ? (
                    <div className="mt-8 rounded-2xl border p-4 text-sm leading-7" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      {product.safetyNote}
                    </div>
                  ) : null}
                  <Link href={product.status === "Admin" ? "/products/nexlink" : product.route} className="mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black" style={{ background: "var(--primary)", color: "white" }}>
                    Mở {product.shortName ?? product.name} <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
                <motion.div {...motionProps} transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}>
                  <ProductSceneVisual scene={product.scene} />
                </motion.div>
              </div>
            </section>
          );
        })}

        <UseCasesSection motionProps={motionProps} />
        <ResourcesSection motionProps={motionProps} />
        <PricingTeaser />
        <FaqSection motionProps={motionProps} />
        <FinalCta />
        <PublicSiteFooter />
      </main>
    </PwaEntryRedirect>
  );
}

function WorkflowSection({ motionProps }: { motionProps: Record<string, unknown> }) {
  const steps = [
    ["Đọc thị trường", "Chỉ số, thanh khoản, độ rộng, tin tức và dòng tiền được gom vào một góc nhìn thống nhất."],
    ["Chọn cơ hội", "Cơ hội được phân loại rõ: mới quan sát, đang theo dõi, đang nắm giữ hoặc đã kết thúc."],
    ["Kiểm tra rủi ro", "Mỗi hành động có vùng giá, tỷ trọng, mục tiêu và điểm sai để giữ kỷ luật."],
    ["Tự quyết định", "AI chỉ giải thích và tóm tắt. Người dùng xác nhận hành động cuối cùng."],
  ] as const;

  return (
    <section id="workflow" className="flex min-h-[100svh] w-screen snap-start items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid w-full gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <motion.div {...motionProps} className="self-center">
          <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>Quy trình</p>
          <h2 className="mt-8 text-6xl font-black leading-[0.95] tracking-[-0.06em] lg:text-7xl">Từ dữ liệu đến hành động có kiểm soát.</h2>
          <p className="mt-8 max-w-xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            ADNexus gom dữ liệu, phân loại cơ hội, kiểm tra rủi ro và giữ người dùng ở vị trí quyết định cuối cùng.
          </p>
        </motion.div>
        <div className="grid gap-5 md:grid-cols-2">
          {steps.map(([step, body], index) => (
            <motion.div key={step} {...motionProps} transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }} className="rounded-[2rem] border bg-white p-8 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
              <p className="text-6xl font-black opacity-10">0{index + 1}</p>
              <h3 className="mt-12 text-2xl font-black">{step}</h3>
              <p className="mt-4 leading-7" style={{ color: "var(--text-secondary)" }}>{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductsSection({ motionProps }: { motionProps: Record<string, unknown> }) {
  return (
    <section id="products" className="min-h-[100svh] w-screen snap-start px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <motion.div {...motionProps} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>NexSuite</p>
          <h2 className="mt-5 max-w-4xl text-5xl font-black tracking-[-0.05em] lg:text-7xl">Một product universe cho toàn bộ hành trình đầu tư.</h2>
        </div>
        <Link href="/products" className="inline-flex items-center gap-2 self-start rounded-2xl border px-5 py-3 font-black lg:self-auto" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Xem product hub <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PRODUCT_MODULES.map((product) => (
          <ProductModuleCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}

function MiniPersona() {
  return (
    <div className="rounded-3xl bg-white p-5 dark:bg-white/5">
      <p className="font-black">Nhà đầu tư cá nhân</p>
      <p className="mt-2" style={{ color: "var(--text-secondary)" }}>Theo dõi thị trường trong ngày</p>
    </div>
  );
}

function UseCasesSection({ motionProps }: { motionProps: Record<string, unknown> }) {
  const cases = [
    ["Nhà đầu tư cá nhân", "Đọc thị trường, theo dõi cơ hội và hỏi AIDEN trước khi ra quyết định."],
    ["Người quản trị danh mục", "Theo dõi tỷ trọng, vị thế, trạng thái rủi ro và hành động tiếp theo."],
    ["Đội vận hành ADN", "Theo dõi workflow, cảnh báo, bản tin và chất lượng dữ liệu từ một nơi."],
  ] as const;

  return (
    <section id="use-cases" className="flex min-h-[100svh] w-screen snap-start items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <div className="w-full">
        <motion.div {...motionProps} className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>Ứng dụng</p>
          <h2 className="mt-6 text-5xl font-black tracking-[-0.05em] lg:text-7xl">Dễ hiểu cho người mới, đủ kiểm soát cho người giao dịch nghiêm túc.</h2>
        </motion.div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {cases.map(([title, body]) => (
            <div key={title} className="rounded-[2rem] border bg-white p-8 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-2xl font-black">{title}</h3>
              <p className="mt-4 leading-8" style={{ color: "var(--text-secondary)" }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResourcesSection({ motionProps }: { motionProps: Record<string, unknown> }) {
  const rows = [
    ["Mẫu workflow", "Scan tín hiệu -> phân loại trạng thái -> hiển thị web/app -> cảnh báo nếu phù hợp."],
    ["Pilot insight", "Broker workflow đang ở trạng thái pilot/admin, không gọi DNSE runtime trên public homepage."],
    ["Safety copy", "Không cam kết lợi nhuận, không tự động giao dịch, không thay thế quyết định của nhà đầu tư."],
  ] as const;

  return (
    <section id="resources" className="flex min-h-[100svh] w-screen snap-start items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid w-full items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <motion.div {...motionProps}>
          <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>Bằng chứng vận hành</p>
          <h2 className="mt-7 text-5xl font-black leading-[0.98] tracking-[-0.06em] lg:text-7xl">Không dùng lời hứa trống. Chỉ mô tả luồng có thể kiểm chứng.</h2>
          <p className="mt-7 text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            ADNexus công khai cách hệ thống hỗ trợ quyết định: tín hiệu được chuẩn hóa, rủi ro được kiểm tra, AI chỉ giải thích, broker workflow chưa mở tự động đặt lệnh công khai.
          </p>
        </motion.div>
        <div className="rounded-[2rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
          {rows.map(([title, body]) => (
            <div key={title} className="border-b py-5 last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <p className="font-black">{title}</p>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section id="pricing-teaser" className="flex min-h-[80svh] w-screen snap-start items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <div className="w-full rounded-[3rem] border bg-[var(--primary)] p-8 text-white sm:p-12 lg:p-16" style={{ borderColor: "var(--border)" }}>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] opacity-70">Bảng giá</p>
            <h2 className="mt-5 max-w-4xl text-5xl font-black tracking-[-0.05em] lg:text-7xl">Bắt đầu bằng nền tảng lõi, mở rộng khi cần advisory và broker workflow.</h2>
          </div>
          <Link href="/pricing" className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 font-black text-[var(--primary)]">
            Xem gói dịch vụ <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function FaqSection({ motionProps }: { motionProps: Record<string, unknown> }) {
  return (
    <section id="faq" className="min-h-[80svh] w-screen snap-start px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>FAQ</p>
          <h2 className="mt-6 text-5xl font-black tracking-[-0.05em]">Những điều cần rõ trước khi dùng.</h2>
        </div>
        <div className="grid gap-4">
          {faqItems.map(([question, answer]) => (
            <motion.div key={question} {...motionProps} className="rounded-[2rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-black">{question}</h3>
              <p className="mt-3 leading-7" style={{ color: "var(--text-secondary)" }}>{answer}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="flex min-h-[70svh] w-screen snap-start items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-5xl text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-[var(--primary)]" />
        <h2 className="mt-8 text-5xl font-black tracking-[-0.05em] lg:text-7xl">Mở ADNexus và kiểm tra thị trường hôm nay.</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
          Bắt đầu với dashboard, NexPilot, NexART và AIDEN Advisory. Không cần tin vào lời hứa, hãy kiểm chứng bằng dữ liệu đang có.
        </p>
        <div className="mt-10 flex justify-center">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-black" style={{ background: "var(--primary)", color: "white" }}>
            Dùng thử ADNexus <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
