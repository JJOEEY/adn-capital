"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  LineChart,
  NotebookTabs,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";
import { ProductDemoImage } from "./ProductDemoImage";
import { PublicSiteFooter } from "./PublicSiteFooter";
import { PublicSiteHeader } from "./PublicSiteHeader";
import { publicBodyFont, publicSerifFont } from "./publicFonts";

const iconBySlug = {
  "adn-pulse": BarChart3,
  "adn-stock": LineChart,
  "adn-radar": Radar,
  "adn-rank": TrendingUp,
  "adn-art": Sparkles,
  "adn-diary": NotebookTabs,
};

const surveyQuestions = [
  {
    question: "Khi một khoản đầu tư vẫn còn đúng lý do ban đầu, anh/chị thường muốn giữ bao lâu?",
    answers: [
      { label: "Tôi có thể giữ vài tháng nếu câu chuyện doanh nghiệp vẫn tốt.", type: "value" },
      { label: "Tôi muốn xoay vòng nhanh khi cổ phiếu không còn chạy như kỳ vọng.", type: "trading" },
      { label: "Tôi chưa chắc, miễn là có mốc theo dõi rõ ràng.", type: "balanced" },
    ],
  },
  {
    question: "Khi tài khoản giảm, điều gì làm anh/chị khó chịu nhất?",
    answers: [
      { label: "Mất vốn lâu dài vì chọn sai doanh nghiệp hoặc sai chu kỳ ngành.", type: "value" },
      { label: "Bị kẹt tiền trong một mã đứng yên quá lâu.", type: "trading" },
      { label: "Không biết nên giữ, bán hay chờ thêm tín hiệu.", type: "balanced" },
    ],
  },
  {
    question: "Anh/chị ra quyết định tốt hơn theo cách nào?",
    answers: [
      { label: "Đọc bối cảnh doanh nghiệp, ngành và vùng giá quan trọng.", type: "value" },
      { label: "Theo dõi tín hiệu, thanh khoản và phản ứng giá trong phiên.", type: "trading" },
      { label: "Có báo cáo cuối ngày để nhìn lại trước khi hành động.", type: "balanced" },
    ],
  },
  {
    question: "Thói quen nào anh/chị muốn cải thiện trước?",
    answers: [
      { label: "Kiên nhẫn với vị thế tốt, không bán quá sớm.", type: "value" },
      { label: "Ra/vào có kế hoạch, không mua bán theo cảm xúc.", type: "trading" },
      { label: "Ghi lại giao dịch để biết mình thường sai ở đâu.", type: "balanced" },
    ],
  },
] as const;

const packages = [
  {
    name: "ADN Base",
    period: "3 tháng",
    focus: "Làm quen có kỷ luật",
    bullets: ["Xem dữ liệu công khai", "Tra cứu cổ phiếu cơ bản", "Tập thói quen ghi nhật ký"],
  },
  {
    name: "ADN VIP",
    period: "6 tháng",
    focus: "Dùng công cụ hằng ngày",
    bullets: ["Mở đầy đủ công cụ phân tích", "Theo dõi lộ trình rõ ràng", "Nhận hỗ trợ khi cần kiểm tra cách dùng"],
    featured: true,
  },
  {
    name: "ADN Premium",
    period: "12 tháng",
    focus: "Theo sát phương pháp",
    bullets: ["Ưu tiên hỗ trợ trong quá trình sử dụng", "Đồng bộ quyền dùng theo tài khoản", "Phù hợp người muốn theo đuổi nghiêm túc"],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
};

export function HomePageV2() {
  const shouldReduceMotion = useReducedMotion();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const finished = answers.length === surveyQuestions.length;
  const currentQuestion = surveyQuestions[Math.min(questionIndex, surveyQuestions.length - 1)];

  const profile = useMemo(() => {
    const score = answers.reduce(
      (acc, item) => {
        acc[item as keyof typeof acc] += 1;
        return acc;
      },
      { value: 0, trading: 0, balanced: 0 },
    );

    if (score.trading > score.value && score.trading >= score.balanced) {
      return {
        title: "Nhóm giao dịch linh hoạt",
        body: "Anh/chị phù hợp với nhịp quan sát nhanh hơn, nhưng vẫn cần kỷ luật cho từng quyết định mua bán.",
        tools: ["ADN Radar", "ADN ART", "ADN Stock", "ADN Diary"],
      };
    }

    if (score.value >= score.trading && score.value >= score.balanced) {
      return {
        title: "Nhóm nắm giữ theo câu chuyện doanh nghiệp",
        body: "Anh/chị hợp với cách chọn doanh nghiệp, theo dõi ngành và kiên nhẫn với vị thế còn đúng lý do ban đầu.",
        tools: ["ADN Pulse", "ADN Rank", "ADN Stock", "ADN Diary"],
      };
    }

    return {
      title: "Nhóm cần lộ trình rõ ràng",
      body: "Anh/chị nên bắt đầu bằng khung quan sát an toàn: hiểu thị trường, tra cứu từng mã và ghi lại quyết định.",
      tools: ["ADN Pulse", "ADN Stock", "ADN ART", "ADN Diary"],
    };
  }, [answers]);

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, margin: "-80px" },
        variants: fadeUp,
        transition: { duration: 0.65, ease: "easeOut" },
      };

  const chooseAnswer = (type: string) => {
    const next = [...answers, type];
    setAnswers(next);
    setQuestionIndex(Math.min(next.length, surveyQuestions.length - 1));
  };

  const resetSurvey = () => {
    setAnswers([]);
    setQuestionIndex(0);
  };

  return (
    <main className={`${publicBodyFont.variable} ${publicSerifFont.variable} ${publicBodyFont.className} adn-public-type min-h-screen`}>
      <PwaEntryRedirect />
      <PublicSiteHeader />

      <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:px-12 xl:px-16" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-75 [background:radial-gradient(circle_at_18%_12%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_30%),radial-gradient(circle_at_72%_10%,rgba(255,255,255,0.1),transparent_26%)]" />
        <div className="relative mx-auto grid max-w-[1600px] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <motion.div {...motionProps}>
            <p className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
              <Sparkles className="h-4 w-4" /> ADN - Hệ thống giao dịch định lượng
            </p>
            <h1 className="mt-7 text-[clamp(3.6rem,8vw,9.4rem)] font-black leading-[1.15] tracking-tight">
              Hiểu rõ bản thân{" "}
              <span className={`${publicSerifFont.className} block font-black italic`} style={{ color: "var(--primary)" }}>
                trước khi chọn cách đầu tư.
              </span>
            </h1>
            <p className="mt-7 max-w-3xl text-xl font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              ADN Capital giúp anh/chị nhận biết phong cách phù hợp với bản thân: nắm giữ theo doanh nghiệp,
              giao dịch linh hoạt theo nhịp thị trường, hay cần một lộ trình quan sát rõ ràng hơn.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="#journey"
                className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-sm font-black"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                Làm bài test 3 phút <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#tools"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-4 text-sm font-black"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Xem công cụ hỗ trợ <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            {...motionProps}
            className="rounded-[2.4rem] border p-5"
            style={{ borderColor: "var(--border-strong)", background: "var(--bg-elevated)" }}
          >
            <div className="rounded-[1.8rem] p-6" style={{ background: "var(--bg-surface)" }}>
              <p className="text-sm font-black" style={{ color: "var(--primary)" }}>
                Kết quả sau bài test
              </p>
              <h2 className="mt-4 text-[clamp(2.2rem,4vw,4.6rem)] font-black leading-[1.15] tracking-tight">
                Một hồ sơ đầu tư rõ ràng, không phải một danh sách mã để mua ngay.
              </h2>
              <div className="mt-7 grid gap-3">
                {["Phong cách đầu tư phù hợp với bản thân", "Nhịp nắm giữ nên theo", "Công cụ ADN nên dùng trước", "Rủi ro cần kiểm soát"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border px-5 py-4" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                    <Check className="h-5 w-5" style={{ color: "var(--success)" }} />
                    <span className="text-base font-semibold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="journey" className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
        <div className="mx-auto grid max-w-[1600px] gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <motion.div {...motionProps}>
            <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
              Bài test nhận diện phong cách
            </p>
            <h2 className="mt-5 text-[clamp(3rem,6vw,7.2rem)] font-black leading-[1.15] tracking-tight">
              Không bắt đầu bằng mã cổ phiếu.
              <span className={`${publicSerifFont.className} mt-2 block font-black italic`} style={{ color: "var(--primary)" }}>
                Bắt đầu bằng cách anh/chị ra quyết định.
              </span>
            </h2>
            <p className="mt-7 max-w-xl text-lg font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              Người mới đi từ vàng, bất động sản hoặc tiết kiệm sang chứng khoán thường không thiếu mã để mua.
              Thứ cần rõ trước là thời gian nắm giữ, mức chịu lỗ và cách theo dõi thị trường của chính mình.
            </p>
          </motion.div>

          <motion.div {...motionProps} className="rounded-[2rem] border p-5" style={{ borderColor: "var(--border-strong)", background: "var(--bg-elevated)" }}>
            {finished ? (
              <div className="p-4 sm:p-6">
                <p className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>
                  Kết quả gợi ý
                </p>
                <h3 className="mt-4 text-[clamp(2.2rem,4vw,4.8rem)] font-black leading-[1.15] tracking-tight">{profile.title}</h3>
                <p className="mt-4 text-lg font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
                  {profile.body}
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {profile.tools.map((tool) => (
                    <div key={tool} className="rounded-2xl border p-4 text-base font-semibold" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                      {tool}
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={resetSurvey}
                    className="rounded-full border px-5 py-3 text-sm font-black"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    Làm lại bài test
                  </button>
                  <Link
                    href="#tools"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
                    style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                  >
                    Xem công cụ phù hợp <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-black" style={{ color: "var(--primary)" }}>
                    Câu {questionIndex + 1}/{surveyQuestions.length}
                  </p>
                  <span className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    Chọn một đáp án
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(answers.length / surveyQuestions.length) * 100}%`, background: "var(--primary)" }}
                  />
                </div>
                <h3 className="mt-8 text-[clamp(2.2rem,4vw,4.8rem)] font-black leading-[1.15] tracking-tight">
                  {currentQuestion.question}
                </h3>
                <div className="mt-8 grid gap-4">
                  {currentQuestion.answers.map((answer, index) => (
                    <button
                      key={answer.label}
                      type="button"
                      onClick={() => chooseAnswer(answer.type)}
                      className="group grid grid-cols-[42px_1fr] items-center gap-4 rounded-[1.3rem] border p-4 text-left transition hover:-translate-y-0.5"
                      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                        {index + 1}
                      </span>
                      <span className="text-lg font-semibold leading-[1.35]">{answer.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <section id="tools" className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
        <div className="mx-auto max-w-[1600px]">
          <motion.div {...motionProps} className="max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
              Công cụ ADN Capital
            </p>
            <h2 className="mt-5 text-[clamp(3rem,6vw,7.2rem)] font-black leading-[1.15] tracking-tight">
              Mỗi công cụ là một cách nhìn.
              <span className={`${publicSerifFont.className} block font-black italic`} style={{ color: "var(--primary)" }}>
                Không cần dùng thừa.
              </span>
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-10">
            {PUBLIC_PRODUCT_MODULES.map((product, index) => {
              const Icon = iconBySlug[product.slug as keyof typeof iconBySlug] ?? Sparkles;
              return (
                <motion.article
                  key={product.slug}
                  {...motionProps}
                  className="grid overflow-hidden rounded-[2.2rem] border lg:grid-cols-[0.86fr_1.14fr]"
                  style={{ borderColor: "var(--border-strong)", background: "var(--bg-surface)" }}
                >
                  <div className="flex min-h-[380px] flex-col justify-between p-6 sm:p-8">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
                        <Icon className="h-4 w-4" /> {product.name}
                      </p>
                      <h3 className="mt-6 text-[clamp(2.2rem,3.6vw,4.8rem)] font-black leading-[1.15] tracking-tight">
                        {product.outcome}
                      </h3>
                      <p className="mt-5 text-lg font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
                        {product.tagline}
                      </p>
                    </div>
                    <Link
                      href={`/products/${product.slug}`}
                      className="mt-8 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
                      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                    >
                      Xem giới thiệu <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="relative min-h-[380px] overflow-hidden border-t lg:min-h-[520px] lg:border-l lg:border-t-0" style={{ borderColor: "var(--border)", background: "#090B0F" }}>
                    <ProductDemoImage
                      src={product.demoImage}
                      alt={`Ảnh demo ${product.name}`}
                      productName={product.name}
                      sizes="(min-width: 1024px) 54vw, 100vw"
                      className="object-cover object-top"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.02),rgba(5,7,10,0.16)_54%,rgba(5,7,10,0.82))]" />
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="membership" className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
        <div className="mx-auto max-w-[1600px]">
          <motion.div {...motionProps} className="max-w-5xl">
            <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
              Hệ sinh thái ADNCapital
            </p>
            <h2 className="mt-5 text-[clamp(3rem,6vw,7.4rem)] font-black leading-[1.15] tracking-tight">
              Mở khóa toàn diện{" "}
              <span className={`${publicSerifFont.className} block font-black italic`} style={{ color: "var(--primary)" }}>
                giải pháp đầu tư.
              </span>
            </h2>
            <p className="mt-6 max-w-3xl text-lg font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              Sau khi hiểu phong cách và công cụ phù hợp, anh/chị chọn thời hạn sử dụng theo nhu cầu.
              Quyền dùng được quản lý theo tài khoản ADN, rõ ngày bắt đầu và ngày hết hạn.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {packages.map((item) => (
              <motion.div
                key={item.name}
                {...motionProps}
                className="rounded-[2rem] border p-7"
                style={{
                  borderColor: item.featured ? "color-mix(in srgb, var(--primary) 55%, var(--border))" : "var(--border)",
                  background: item.featured ? "color-mix(in srgb, var(--primary) 10%, var(--bg-surface))" : "var(--bg-surface)",
                }}
              >
                <ShieldCheck className="h-6 w-6" style={{ color: "var(--primary)" }} />
                <p className="mt-8 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                  {item.focus}
                </p>
                <h3 className="mt-3 text-4xl font-black leading-[1.15] tracking-tight">{item.name}</h3>
                <p className="mt-3 text-2xl font-black" style={{ color: "var(--primary)" }}>
                  {item.period}
                </p>
                <div className="mt-7 grid gap-3">
                  {item.bullets.map((bullet) => (
                    <p key={bullet} className="flex items-start gap-3 text-sm font-normal leading-7" style={{ color: "var(--text-secondary)" }}>
                      <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                      {bullet}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
        <motion.div
          {...motionProps}
          className="mx-auto max-w-[1300px] rounded-[2.4rem] border p-8 text-center sm:p-12"
          style={{ borderColor: "var(--border-strong)", background: "var(--bg-elevated)" }}
        >
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
            Trải nghiệm dịch vụ
          </p>
          <h2 className="mx-auto mt-5 max-w-4xl text-[clamp(3rem,6vw,7rem)] font-black leading-[1.15] tracking-tight">
            Bắt đầu bằng một hồ sơ đầu tư rõ ràng.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
            ADN Capital không đưa anh/chị vào một danh sách mã để mua ngay. Trải nghiệm đầu tiên là hiểu phong cách,
            chọn đúng công cụ, rồi dùng dữ liệu để ra quyết định có kỷ luật hơn.
          </p>
          <Link
            href="/auth?mode=register"
            className="mt-9 inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-black"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            Mở tài khoản ADN <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}

export default HomePageV2;
