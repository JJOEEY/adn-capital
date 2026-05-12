"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  LockKeyhole,
  Mail,
  Phone,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
} from "lucide-react";

const MIN_CAPITAL = 500_000_000;
const MAX_CAPITAL = 20_000_000_000;
const STEP_CAPITAL = 500_000_000;
const LEVERAGE_MULTIPLIER = 3;

const FAQ_ITEMS = [
  {
    question: "Hạn mức vay Margin tại ADN Capital là bao nhiêu?",
    answer:
      "Hạn mức được tư vấn theo vốn tự có, chất lượng danh mục, khẩu vị rủi ro và điều kiện thị trường. Với mô phỏng cơ bản, nhà đầu tư có thể ước tính sức mua khoảng 3 lần vốn tự có trước khi được tư vấn chi tiết.",
  },
  {
    question: "Điều kiện để mở tài khoản ký quỹ Margin?",
    answer:
      "Nhà đầu tư cần có tài khoản chứng khoán hợp lệ, hoàn tất hồ sơ ký quỹ và đáp ứng điều kiện về tài sản bảo đảm, danh mục được phép giao dịch margin và các quy định quản trị rủi ro hiện hành.",
  },
  {
    question: "Lãi suất vay Margin hiện tại?",
    answer:
      "Lãi suất phụ thuộc quy mô vốn, chương trình ưu đãi và thời điểm giải ngân. ADN Capital sẽ liên hệ để tư vấn mức phù hợp sau khi nhận thông tin nhu cầu của nhà đầu tư.",
  },
];

const BENEFITS = [
  {
    title: "Sức mua có kỷ luật",
    text: "Tối ưu hạn mức theo vốn thật, không khuyến khích dùng đòn bẩy vượt khả năng chịu rủi ro.",
    icon: Scale,
  },
  {
    title: "Tốc độ xử lý riêng tư",
    text: "Thông tin nhu cầu được chuyển tới đội ngũ tư vấn để phản hồi theo ngữ cảnh tài khoản.",
    icon: LockKeyhole,
  },
  {
    title: "Quản trị bằng dữ liệu",
    text: "ADN ART hỗ trợ nhận diện trạng thái rủi ro, giúp quá trình dùng margin bớt cảm tính.",
    icon: ShieldCheck,
  },
];

type FormState = {
  name: string;
  phone: string;
  email: string;
  tickers: string;
};

const initialForm: FormState = {
  name: "",
  phone: "",
  email: "",
  tickers: "",
};

function formatVnd(value: number) {
  if (value >= 1_000_000_000) {
    const amount = value / 1_000_000_000;
    return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)} tỷ`;
  }

  return `${Math.round(value / 1_000_000)} triệu`;
}

export default function MarginPageClient() {
  const [capital, setCapital] = useState(3_000_000_000);
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const purchasingPower = useMemo(() => capital * LEVERAGE_MULTIPLIER, [capital]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Vui lòng nhập họ và tên.";
    if (!form.phone.trim()) nextErrors.phone = "Vui lòng nhập số điện thoại.";
    return nextErrors;
  };

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/margin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          product: "ky-quy",
          marginRatio: "Sức mua dự kiến x3",
          loanAmount: `Vốn tự có ${formatVnd(capital)} - sức mua dự kiến ${formatVnd(purchasingPower)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể gửi yêu cầu tư vấn.");

      setSuccess(true);
      setForm(initialForm);
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Không thể gửi yêu cầu tư vấn." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <article className="min-h-screen bg-[var(--page-surface)] px-4 py-6 text-[var(--text-primary)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <section id="tu-van" className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                <BadgeCheck className="h-4 w-4 text-[var(--primary)]" />
                Wealth-native margin advisory
              </div>

              <div className="space-y-5">
                <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                  Đặc Quyền Đòn Bẩy Tài Chính Cùng ADN Capital
                </h1>
                <p className="max-w-2xl text-base leading-8 text-[var(--text-secondary)] sm:text-lg">
                  Kích hoạt sức mua có kiểm soát, tối ưu chi phí vốn và giữ kỷ luật rủi ro trong từng quyết định dùng margin.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--glass-surface)] p-5 shadow-[var(--shadow-float)] backdrop-blur-md sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-muted-foreground text-[var(--text-muted)] uppercase">
                      Vốn tự có
                    </p>
                    <p className="mt-2 font-sans text-3xl font-extrabold tracking-tight text-foreground text-[var(--text-primary)]">
                      {formatVnd(capital)}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--primary-light)] text-[var(--primary)]">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                </div>

                <input
                  type="range"
                  min={MIN_CAPITAL}
                  max={MAX_CAPITAL}
                  step={STEP_CAPITAL}
                  value={capital}
                  onChange={(event) => setCapital(Number(event.target.value))}
                  aria-label="Vốn tự có"
                  className="mt-6 h-2 w-full cursor-pointer accent-[var(--primary)]"
                />

                <div className="mt-5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground text-[var(--text-muted)] uppercase">
                    <Calculator className="h-4 w-4 text-[var(--primary)]" />
                    Sức mua dự kiến
                  </div>
                  <p
                    className="mt-3 font-sans text-5xl font-extrabold leading-none tracking-tighter text-primary text-[var(--primary)]"
                    style={{ textShadow: "0 0 28px var(--glow-primary)" }}
                  >
                    {formatVnd(purchasingPower)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    Mô phỏng theo hệ số x3. Hạn mức thực tế phụ thuộc hồ sơ, danh mục và chính sách rủi ro tại thời điểm tư vấn.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {BENEFITS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                      <Icon className="h-5 w-5 text-[var(--primary)]" />
                      <h3 className="mt-3 text-sm font-black text-[var(--text-primary)]">{item.title}</h3>
                      <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-lg border border-[var(--border-strong)] bg-[var(--glass-surface-strong)] p-5 shadow-[var(--shadow-float)] backdrop-blur-md sm:p-6">
              {success ? (
                <SuccessState
                  onReset={() => {
                    setSuccess(false);
                    setErrors({});
                  }}
                />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                      Private Desk
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--text-primary)]">
                      Kích Hoạt Đặc Quyền Vay Margin
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                      Gửi nhu cầu vốn, ADN Capital sẽ liên hệ để tư vấn hạn mức và cấu trúc đòn bẩy phù hợp.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="margin-name"
                      label="Họ và tên"
                      required
                      error={errors.name}
                      icon={<UserRound className="h-4 w-4" />}
                    >
                      <input
                        id="margin-name"
                        type="text"
                        value={form.name}
                        onChange={(event) => setField("name", event.target.value)}
                        placeholder="Nhập họ và tên"
                        className={inputClass(Boolean(errors.name))}
                      />
                    </FormField>

                    <FormField
                      id="margin-phone"
                      label="Số điện thoại"
                      required
                      error={errors.phone}
                      icon={<Phone className="h-4 w-4" />}
                    >
                      <input
                        id="margin-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(event) => setField("phone", event.target.value)}
                        placeholder="Nhập số điện thoại"
                        className={inputClass(Boolean(errors.phone))}
                      />
                    </FormField>
                  </div>

                  <FormField id="margin-email" label="Email" icon={<Mail className="h-4 w-4" />}>
                    <input
                      id="margin-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setField("email", event.target.value)}
                      placeholder="Nhập email"
                      className={inputClass(false)}
                    />
                  </FormField>

                  <FormField id="margin-tickers" label="Danh mục quan tâm" icon={<TrendingUp className="h-4 w-4" />}>
                    <input
                      id="margin-tickers"
                      type="text"
                      value={form.tickers}
                      onChange={(event) => setField("tickers", event.target.value)}
                      placeholder="Mã cổ phiếu hoặc nhóm ngành"
                      className={inputClass(false)}
                    />
                  </FormField>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold tracking-widest text-muted-foreground text-[var(--text-muted)] uppercase">Vốn tự có đang chọn</span>
                      <span className="font-sans text-sm font-extrabold tracking-tight text-primary text-[var(--primary)]">{formatVnd(capital)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold tracking-widest text-muted-foreground text-[var(--text-muted)] uppercase">Sức mua dự kiến</span>
                      <span className="font-sans text-sm font-extrabold tracking-tight text-primary text-[var(--primary)]">
                        {formatVnd(purchasingPower)}
                      </span>
                    </div>
                  </div>

                  {errors.submit && (
                    <p className="rounded-lg border border-[var(--danger)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--danger)]">
                      {errors.submit}
                    </p>
                  )}

                  <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full rounded-lg font-black">
                    {submitting ? "Đang gửi..." : "[ Khám Phá Đặc Quyền ]"}
                  </Button>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--primary-light)] p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" />
                      <div>
                        <p className="text-sm font-black text-[var(--text-primary)]">
                          ADN ART - AI Risk Management
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                          Lớp quản trị rủi ro hỗ trợ đánh giá trạng thái thị trường trước khi mở rộng đòn bẩy.
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </aside>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Margin Advisory Framework
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Dịch vụ tư vấn margin của ADN Capital tập trung vào ba lớp: xác định nhu cầu vốn hợp lý, kiểm tra mức chịu rủi ro và xây dựng phương án sử dụng đòn bẩy theo kỷ luật danh mục. Mục tiêu không phải dùng tối đa hạn mức, mà là dùng đúng mức khi xác suất và bối cảnh thị trường cho phép.
              </p>
            </div>
          </section>

          <section id="faq" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--primary-light)] text-[var(--primary)]">
                <ChevronDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  FAQ
                </p>
                <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                  Câu Hỏi Thường Gặp Về Margin
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={item.question}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                    >
                      <span className="text-sm font-black text-[var(--text-primary)]">{item.question}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--primary)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <p className="border-t border-[var(--border)] px-4 py-4 text-sm leading-7 text-[var(--text-secondary)]">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <p className="text-center text-xs leading-6 text-[var(--text-muted)]">
            Thông tin trên trang chỉ phục vụ mục đích tư vấn sản phẩm tài chính, không phải khuyến nghị mua bán chứng khoán.
          </p>
        </div>
      </article>
    </MainLayout>
  );
}

function inputClass(hasError: boolean) {
  return [
    "w-full rounded-lg border bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition",
    "placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]",
    hasError ? "border-[color:var(--danger)]" : "border-[var(--border)]",
  ].join(" ");
}

function FormField({
  id,
  label,
  required,
  icon,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  icon?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
        {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
        <span>
          {label}
          {required && <span className="text-[var(--danger)]"> *</span>}
        </span>
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--primary-light)] text-[var(--primary)]">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-2xl font-black text-[var(--text-primary)]">Đã nhận yêu cầu tư vấn</h3>
      <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--text-secondary)]">
        ADN Capital sẽ liên hệ để xác nhận nhu cầu vốn và tư vấn cấu trúc margin phù hợp.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
      >
        Gửi yêu cầu khác
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
