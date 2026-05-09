"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Calculator,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Layers,
  Loader2,
  Mail,
  Percent,
  Phone,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";

const MARGIN_RATIOS = [
  "2:8 (Vay 80%)",
  "3:7 (Vay 70%)",
  "4:6 (Vay 60%)",
  "5:5 (Vay 50%)",
  "Khác (Liên hệ để được tư vấn)",
];

const LOAN_RANGES = [
  "Dưới 500 triệu",
  "500 triệu - 1 tỷ",
  "1 tỷ - 3 tỷ",
  "3 tỷ - 10 tỷ",
  "Trên 10 tỷ",
];

const TRUST_BADGES = [
  { label: "Lãi suất", value: "5.99%/năm", icon: Percent },
  { label: "Phí giao dịch", value: "0.1%", icon: BadgePercent },
  { label: "Tỉ lệ ký quỹ", value: "25%", icon: Shield },
  { label: "Kinh nghiệm", value: "10+ năm", icon: Users },
];

const FAQ_ITEMS = [
  {
    question: "Margin chứng khoán có hợp pháp tại Việt Nam không?",
    answer: "Có. Được quy định tại Thông tư 121/2020/TT-BTC, do UBCKNN cấp phép và giám sát.",
  },
  {
    question: "Tỉ lệ ký quỹ tối thiểu theo quy định là bao nhiêu?",
    answer: "Tỉ lệ cho vay tối đa không vượt 50% giá trị chứng khoán được phép margin. Mỗi CTCK có thể áp dụng khác nhau.",
  },
  {
    question: "Lãi suất margin tính như thế nào?",
    answer: "Lãi ngày = Dư nợ × (Lãi suất/năm ÷ 365). Tích lũy hàng ngày, thu theo định kỳ tùy CTCK.",
  },
  {
    question: "Margin call xảy ra khi nào?",
    answer:
      "Khi giá trị tài sản ròng (danh mục − dư nợ) giảm dưới ngưỡng ký quỹ duy trì tối thiểu. Không xử lý kịp, công ty chứng khoán có thể bán giải chấp.",
  },
  {
    question: "Có nên dùng margin cho nhà đầu tư mới không?",
    answer: "Không khuyến nghị. Đòn bẩy khuếch đại cả lợi nhuận lẫn thua lỗ. Cần nắm vững phân tích và quản lý vốn trước.",
  },
  {
    question: "ADN Capital hỗ trợ những cổ phiếu nào được margin?",
    answer:
      "Cổ phiếu HOSE và HNX đủ điều kiện thanh khoản và vốn hóa theo quy định UBCKNN. Liên hệ ADN Capital để nhận danh sách hiện hành.",
  },
];

type Product = "ky-quy" | "mua-nhanh-ban-nhanh";

export default function MarginPageClient() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    product: "ky-quy" as Product,
    marginRatio: "",
    loanAmount: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isKyQuy = form.product === "ky-quy";

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Vui lòng nhập họ tên.";
    if (!form.phone.trim()) nextErrors.phone = "Vui lòng nhập số điện thoại.";
    if (isKyQuy && !form.marginRatio) nextErrors.marginRatio = "Vui lòng chọn tỉ lệ ký quỹ.";
    if (!form.loanAmount) {
      nextErrors.loanAmount = isKyQuy
        ? "Vui lòng chọn hạn mức vay."
        : "Vui lòng nhập cổ phiếu muốn giao dịch.";
    }
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/margin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          marginRatio: isKyQuy ? form.marginRatio : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không thể gửi yêu cầu tư vấn.");
      setSuccess(true);
    } catch (error) {
      setErrors({ submit: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setProduct = (product: Product) => {
    setForm((prev) => ({ ...prev, product, marginRatio: "" }));
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.marginRatio;
      return nextErrors;
    });
  };

  const inputBase = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors";
  const inputStyle = (hasError: boolean) => ({
    background: "var(--surface-2)",
    border: `1px solid ${hasError ? "rgba(192,57,43,0.50)" : "var(--border)"}`,
    color: "var(--text-primary)",
  });

  return (
    <MainLayout>
      <article className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
        <section
          className="overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="max-w-4xl">
            <span
              className="mb-4 inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.3em]"
              style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border)" }}
            >
              Giải pháp Margin
            </span>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl" style={{ color: "var(--text-primary)" }}>
              Margin Chứng Khoán — Hướng Dẫn Toàn Diện & Giải Pháp Vay Ký Quỹ Lãi Suất Thấp
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 sm:text-base" style={{ color: "var(--text-secondary)" }}>
              Hiểu đúng cơ chế, tính toán rủi ro và tối ưu chi phí vốn với dịch vụ margin chuyên nghiệp từ ADN Capital.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#tu-van"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-all active:scale-[0.98]"
                style={{ background: "var(--primary)", color: "#EBE2CF" }}
              >
                Đăng ký tư vấn miễn phí <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#faq"
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-2)" }}
              >
                Xem câu hỏi thường gặp
              </a>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Thông tin nổi bật">
          {TRUST_BADGES.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className="rounded-2xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Icon className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {badge.label}
                </p>
                <p className="mt-1 text-xl font-black" style={{ color: "var(--text-primary)" }}>
                  {badge.value}
                </p>
              </div>
            );
          })}
        </section>

        <ContentSection title="Margin chứng khoán là gì?">
          <p>
            Margin chứng khoán là hình thức vay ký quỹ tại công ty chứng khoán để tăng sức mua cổ phiếu.
            Nhà đầu tư dùng một phần vốn tự có, phần còn lại là khoản vay được bảo đảm bằng chính danh mục chứng khoán.
          </p>
          <HighlightBox icon={<Calculator className="h-5 w-5" />} title="Ví dụ dễ hiểu">
            Vốn tự có 100 triệu + vay 100 triệu = sức mua 200 triệu. Nếu cổ phiếu tăng 10%, lợi nhuận tương đương
            khoảng 20% trên vốn tự có. Ngược lại, nếu cổ phiếu giảm 10%, mức lỗ cũng bị khuếch đại lên khoảng 20%.
          </HighlightBox>
        </ContentSection>

        <ContentSection title="Cách hoạt động của margin trong thực tế">
          <div className="grid gap-3 sm:grid-cols-4">
            {["Mở tài khoản", "Đặt lệnh", "Tính lãi", "Thanh toán"].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <span className="text-xs font-black" style={{ color: "var(--primary)" }}>
                  Bước {index + 1}
                </span>
                <p className="mt-2 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
          <FormulaBox label="Công thức tính lãi ngày">
            Lãi ngày = Dư nợ × (Lãi suất/năm ÷ 365)
          </FormulaBox>
          <p>
            Tỉ lệ ký quỹ ban đầu thường nằm quanh 50-75% tùy cổ phiếu và chính sách từng công ty chứng khoán.
            Tỉ lệ duy trì thường quanh 30-40%; nếu tài sản giảm dưới ngưỡng này, tài khoản có thể bị cảnh báo.
          </p>
        </ContentSection>

        <ContentSection title="Cách tính margin call và mức giá cảnh báo">
          <FormulaBox label="Công thức cảnh báo">
            V &lt; D ÷ (1 − m)
          </FormulaBox>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Trong đó: V là giá trị danh mục, D là dư nợ, m là tỉ lệ duy trì.
          </p>
          <HighlightBox icon={<AlertTriangle className="h-5 w-5" />} title="Ví dụ margin call">
            Mua danh mục 200 triệu gồm vốn 100 triệu và vay 100 triệu. Nếu tỉ lệ duy trì là 35%,
            tài khoản có thể bị margin call khi danh mục giảm dưới khoảng 153,8 triệu. Nếu không bổ sung tiền
            hoặc giảm dư nợ kịp thời, công ty chứng khoán có thể bán giải chấp.
          </HighlightBox>
        </ContentSection>

        <ContentSection title="Rủi ro khi sử dụng margin và cách kiểm soát">
          <div className="grid gap-4 md:grid-cols-2">
            <RiskCard title="Khuếch đại thua lỗ" text="Đòn bẩy làm lợi nhuận tăng nhanh hơn, nhưng cũng khiến thua lỗ tăng nhanh hơn khi thị trường đi ngược kỳ vọng." />
            <RiskCard title="Lãi suất tích lũy" text="Lãi margin được tính theo ngày. Mức phổ biến trên thị trường thường quanh 8-14%/năm, vì vậy chi phí vốn cần được kiểm soát." />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Không dùng toàn bộ sức mua cho một cổ phiếu.",
              "Đặt ngưỡng cắt lỗ trước khi mở vị thế.",
              "Không dùng full margin khi thị trường biến động mạnh.",
              "Theo dõi danh mục và dư nợ hàng ngày.",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#16a34a" }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ContentSection>

        <ContentSection title="Lãi suất margin — so sánh thị trường">
          <div className="grid gap-4 md:grid-cols-3">
            <CompareCard title="Thị trường chung" value="8-14%/năm" text="Mức tham khảo phổ biến tùy công ty chứng khoán, cổ phiếu và chương trình vay." />
            <CompareCard title="ADN Capital" value="Từ 5.99%/năm" text="Giải pháp tối ưu chi phí vốn cho khách hàng cần tư vấn margin chuyên nghiệp." highlight />
            <CompareCard title="Phí giao dịch ADN" value="Từ 0.1%" text="Tối ưu tổng chi phí giao dịch khi sử dụng vốn vay ký quỹ." />
          </div>
        </ContentSection>

        <ContentSection title="Tại sao chọn ADN Capital?">
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { icon: Shield, title: "Kỷ luật rủi ro", text: "Tư vấn theo khả năng chịu rủi ro." },
              { icon: Percent, title: "Chi phí thấp", text: "Lãi suất và phí cạnh tranh." },
              { icon: Layers, title: "Gói linh hoạt", text: "Nhiều lựa chọn theo nhu cầu vốn." },
              { icon: TrendingUp, title: "Dữ liệu hỗ trợ", text: "Theo dõi thị trường và danh mục." },
              { icon: Users, title: "Đồng hành", text: "Đội ngũ tư vấn sát nhu cầu." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl p-4"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <Icon className="h-5 w-5" style={{ color: "var(--primary)" }} />
                  <h3 className="mt-3 text-sm font-black" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </ContentSection>

        <section
          id="faq"
          className="rounded-3xl p-5 sm:p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="mb-5 flex items-center gap-3">
            <HelpCircle className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-xl font-black sm:text-2xl" style={{ color: "var(--text-primary)" }}>
              Câu hỏi thường gặp về margin chứng khoán
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <summary className="cursor-pointer list-none text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section id="tu-van" className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                Tư Vấn Theo Nhu Cầu
              </h2>
              <p className="text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                Điền thông tin để đội ngũ chuyên gia ADN Capital liên hệ tư vấn sản phẩm phù hợp nhất với chiến lược đầu tư của bạn.
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Tư vấn hoàn toàn miễn phí.",
                "Thông tin được bảo mật.",
                "Phản hồi trong vòng 2 giờ làm việc.",
                "Tối ưu chi phí vốn theo nhu cầu.",
              ].map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#16a34a" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
            <p className="border-t pt-5 text-xs leading-6" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Thông tin của quý nhà đầu tư được sử dụng cho mục đích tư vấn sản phẩm và chăm sóc khách hàng.
            </p>
          </div>

          <div
            className="rounded-3xl p-5 sm:p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {success ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.20)" }}
                >
                  <CheckCircle2 className="h-7 w-7" style={{ color: "#16a34a" }} />
                </div>
                <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                  Đăng ký thành công!
                </h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Đội ngũ ADN Capital sẽ liên hệ với bạn sớm nhất có thể.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setForm({ name: "", email: "", phone: "", product: "ky-quy", marginRatio: "", loanAmount: "" });
                  }}
                  className="mt-2 cursor-pointer text-xs hover:underline"
                  style={{ color: "#16a34a" }}
                >
                  Gửi thêm yêu cầu
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Họ và Tên" required icon={<Users className="h-4 w-4" />} error={errors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => setField("name", event.target.value)}
                      placeholder="Nguyễn Văn A"
                      className={inputBase}
                      style={inputStyle(!!errors.name)}
                    />
                  </FormField>
                  <FormField label="Số điện thoại" required icon={<Phone className="h-4 w-4" />} error={errors.phone}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => setField("phone", event.target.value)}
                      placeholder="0912 345 678"
                      className={inputBase}
                      style={inputStyle(!!errors.phone)}
                    />
                  </FormField>
                </div>

                <FormField label="Email" icon={<Mail className="h-4 w-4" />}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    placeholder="email@example.com"
                    className={inputBase}
                    style={inputStyle(false)}
                  />
                </FormField>

                <div>
                  <label className="mb-2 block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Sản phẩm cần tư vấn <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { value: "ky-quy" as Product, label: "Ký quỹ Margin" },
                      { value: "mua-nhanh-ban-nhanh" as Product, label: "Mua nhanh - Bán nhanh" },
                    ].map((item) => {
                      const selected = form.product === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setProduct(item.value)}
                          className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
                          style={
                            selected
                              ? { background: "var(--primary-light)", border: "1px solid var(--border)", color: "var(--primary)" }
                              : { background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
                          }
                        >
                          <span
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                            style={{ border: `2px solid ${selected ? "var(--primary)" : "var(--text-muted)"}` }}
                          >
                            {selected && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />}
                          </span>
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isKyQuy && (
                  <FormField label="Tỉ lệ cho vay" required icon={<ChevronDown className="h-4 w-4" />} error={errors.marginRatio}>
                    <select
                      value={form.marginRatio}
                      onChange={(event) => setField("marginRatio", event.target.value)}
                      className={`${inputBase} cursor-pointer appearance-none`}
                      style={inputStyle(!!errors.marginRatio)}
                    >
                      <option value="">Chọn tỉ lệ ký quỹ...</option>
                      {MARGIN_RATIOS.map((ratio) => (
                        <option key={ratio} value={ratio}>
                          {ratio}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}

                {isKyQuy ? (
                  <FormField label="Hạn mức vay mong muốn" required error={errors.loanAmount}>
                    <select
                      value={form.loanAmount}
                      onChange={(event) => setField("loanAmount", event.target.value)}
                      className={`${inputBase} cursor-pointer appearance-none`}
                      style={inputStyle(!!errors.loanAmount)}
                    >
                      <option value="">Chọn hạn mức...</option>
                      {LOAN_RANGES.map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : (
                  <FormField label="Cổ phiếu muốn giao dịch T0" required error={errors.loanAmount}>
                    <input
                      type="text"
                      value={form.loanAmount}
                      onChange={(event) => setField("loanAmount", event.target.value)}
                      placeholder="VD: VNM, FPT, HPG..."
                      className={inputBase}
                      style={inputStyle(!!errors.loanAmount)}
                    />
                  </FormField>
                )}

                {errors.submit && (
                  <p className="text-xs" style={{ color: "var(--danger)" }}>
                    {errors.submit}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#EBE2CF" }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    "Đăng ký tư vấn ngay"
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

        <p className="text-center text-xs italic leading-6" style={{ color: "var(--text-muted)" }}>
          Thông tin trong bài mang tính tham khảo, không phải khuyến nghị đầu tư. Nhà đầu tư cần tự đánh giá khả năng chịu rủi ro
          trước khi quyết định sử dụng đòn bẩy tài chính.
        </p>
      </article>
    </MainLayout>
  );
}

function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="space-y-5 rounded-3xl p-5 sm:p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-xl font-black sm:text-2xl" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="space-y-5 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

function HighlightBox({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--primary-light)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <div className="mb-2 flex items-center gap-2 font-black" style={{ color: "var(--primary)" }}>
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
        {children}
      </p>
    </div>
  );
}

function FormulaBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 font-mono text-sm"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <p className="mb-2 font-sans text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="font-black">{children}</p>
    </div>
  );
}

function RiskCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <AlertTriangle className="h-5 w-5" style={{ color: "#f59e0b" }} />
      <h3 className="mt-3 text-sm font-black" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {text}
      </p>
    </div>
  );
}

function CompareCard({ title, value, text, highlight }: { title: string; value: string; text: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: highlight ? "var(--primary-light)" : "var(--surface-2)",
        border: `1px solid ${highlight ? "rgba(46,77,61,0.35)" : "var(--border)"}`,
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <p className="mt-2 text-2xl font-black" style={{ color: highlight ? "var(--primary)" : "var(--text-primary)" }}>
        {value}
      </p>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {text}
      </p>
    </div>
  );
}

function FormField({
  label,
  required,
  icon,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
            {icon}
          </span>
        )}
        <div className={icon ? "pl-9" : ""}>{children}</div>
      </div>
      {error && (
        <p className="mt-1 text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
