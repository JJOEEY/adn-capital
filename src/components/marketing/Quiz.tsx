"use client";

/**
 * Investor-style quiz — interactive client island for the marketing homepage.
 * User answers 4 questions, gets an investing-style profile + the ADN tools that fit.
 * Logic adapted from the existing HomePageV2 survey (which the user likes).
 */

import { useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

type Style = "value" | "trading" | "balanced";

const QUESTIONS: { q: string; answers: { label: string; type: Style }[] }[] = [
  {
    q: "Khi một khoản đầu tư vẫn còn đúng lý do ban đầu, bạn muốn giữ bao lâu?",
    answers: [
      { label: "Giữ vài tháng nếu câu chuyện doanh nghiệp còn tốt.", type: "value" },
      { label: "Xoay vòng nhanh khi cổ phiếu không chạy như kỳ vọng.", type: "trading" },
      { label: "Chưa chắc, miễn là có mốc theo dõi rõ ràng.", type: "balanced" },
    ],
  },
  {
    q: "Khi tài khoản giảm, điều gì làm bạn khó chịu nhất?",
    answers: [
      { label: "Mất vốn dài hạn vì chọn sai doanh nghiệp hoặc sai chu kỳ.", type: "value" },
      { label: "Bị kẹt tiền trong một mã đứng yên quá lâu.", type: "trading" },
      { label: "Không biết nên giữ, bán hay chờ thêm tín hiệu.", type: "balanced" },
    ],
  },
  {
    q: "Bạn ra quyết định tốt hơn theo cách nào?",
    answers: [
      { label: "Đọc bối cảnh doanh nghiệp, ngành và vùng giá quan trọng.", type: "value" },
      { label: "Theo dõi tín hiệu, thanh khoản và phản ứng giá trong phiên.", type: "trading" },
      { label: "Có báo cáo cuối ngày để nhìn lại trước khi hành động.", type: "balanced" },
    ],
  },
  {
    q: "Thói quen nào bạn muốn cải thiện trước?",
    answers: [
      { label: "Kiên nhẫn với vị thế tốt, không bán quá sớm.", type: "value" },
      { label: "Ra vào có kế hoạch, không mua bán theo cảm xúc.", type: "trading" },
      { label: "Ghi lại giao dịch để biết mình thường sai ở đâu.", type: "balanced" },
    ],
  },
];

const PROFILES: Record<Style, { title: string; body: string; tools: { name: string; href: string }[] }> = {
  trading: {
    title: "Nhà giao dịch linh hoạt",
    body: "Bạn hợp với nhịp quan sát nhanh, nhưng vẫn cần kỷ luật cho từng quyết định mua bán.",
    tools: [
      { name: "AIDEN", href: "/products/adn-stock" },
      { name: "Chỉ báo ART", href: "/products/adn-art" },
      { name: "Xếp hạng RANK", href: "/products/adn-rank" },
    ],
  },
  value: {
    title: "Nhà đầu tư theo doanh nghiệp",
    body: "Bạn hợp với cách chọn doanh nghiệp tốt, theo dõi ngành và kiên nhẫn với vị thế còn đúng lý do.",
    tools: [
      { name: "Cổ phiếu & RS", href: "/products/adn-stock" },
      { name: "Xếp hạng RANK", href: "/products/adn-rank" },
      { name: "AIDEN", href: "/products/adn-stock" },
    ],
  },
  balanced: {
    title: "Người cần lộ trình rõ ràng",
    body: "Bạn nên bắt đầu bằng khung quan sát an toàn: hiểu thị trường, tra cứu từng mã rồi ghi lại quyết định.",
    tools: [
      { name: "Nhịp thị trường", href: "/products/adn-pulse" },
      { name: "Chỉ báo ART", href: "/products/adn-art" },
      { name: "AIDEN", href: "/products/adn-stock" },
    ],
  },
};

export function Quiz() {
  const [answers, setAnswers] = useState<Style[]>([]);
  const finished = answers.length === QUESTIONS.length;
  const index = Math.min(answers.length, QUESTIONS.length - 1);
  const current = QUESTIONS[index];

  const profile = useMemo(() => {
    const score = answers.reduce(
      (a, t) => ((a[t] += 1), a),
      { value: 0, trading: 0, balanced: 0 } as Record<Style, number>,
    );
    if (score.trading > score.value && score.trading >= score.balanced) return PROFILES.trading;
    if (score.value >= score.trading && score.value >= score.balanced) return PROFILES.value;
    return PROFILES.balanced;
  }, [answers]);

  return (
    <div className="dp-quiz">
      {!finished ? (
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-[var(--moss)]">
              Bạn là nhà đầu tư kiểu nào?
            </span>
            <span className="dp-num text-[12.5px] font-medium text-[var(--ink-faint)]">{answers.length + 1} / {QUESTIONS.length}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-[var(--moss)] transition-[width] duration-500" style={{ width: `${(answers.length / QUESTIONS.length) * 100}%` }} />
          </div>

          <h3 className="mt-6 text-[clamp(1.3rem,2.4vw,1.6rem)] font-bold leading-[1.25] tracking-[-0.01em]">{current.q}</h3>

          <div className="mt-6 grid gap-3">
            {current.answers.map((a, i) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAnswers((prev) => [...prev, a.type])}
                className="dp-quiz-opt group flex items-start gap-3 text-left"
              >
                <span className="dp-quiz-num">{String.fromCharCode(65 + i)}</span>
                <span className="text-[15px] font-medium leading-[1.4]">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <span className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-[var(--moss)]">Kết quả của bạn</span>
          <h3 className="mt-3 text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold leading-[1.15] tracking-[-0.02em]">{profile.title}</h3>
          <p className="mt-3 text-[15.5px] font-normal leading-[1.55] text-[var(--ink-muted)]">{profile.body}</p>

          <p className="mt-7 text-[12.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">Công cụ phù hợp với bạn</p>
          <div className="mt-3 grid gap-2.5">
            {profile.tools.map((t) => (
              <a key={t.name} href={t.href} className="dp-quiz-tool group flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                  <Check className="h-4 w-4 text-[var(--moss)]" strokeWidth={2.5} /> {t.name}
                </span>
                <ArrowRight className="h-4 w-4 text-[var(--ink-faint)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--moss)]" strokeWidth={2} />
              </a>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="/auth?mode=register" className="dp-btn dp-btn-solid dp-btn-lg">
              Mở tài khoản ngay <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </a>
            <button type="button" onClick={() => setAnswers([])} className="dp-btn dp-btn-ghost dp-btn-lg">
              <RotateCcw className="h-4 w-4" strokeWidth={2} /> Làm lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Quiz;
