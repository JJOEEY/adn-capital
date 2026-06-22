"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Shell, Reveal } from "@/components/marketing/theme";

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

const TOC = [
  { id: "la-gi", label: "Margin chứng khoán là gì" },
  { id: "cach-hoat-dong", label: "Cách vay ký quỹ hoạt động" },
  { id: "margin-call", label: "Margin call tính ở giá nào" },
  { id: "may-tinh", label: "Máy tính margin" },
  { id: "rui-ro", label: "Rủi ro đòn bẩy & cách kiểm soát" },
  { id: "lai-suat", label: "Lãi suất margin: thị trường vs ADN" },
  { id: "faq", label: "Câu hỏi thường gặp" },
];

const FAQ_ITEMS = [
  {
    question: "Margin chứng khoán có hợp pháp tại Việt Nam không?",
    answer: "Có. Được quy định tại Thông tư 121/2020/TT-BTC, do UBCKNN cấp phép và giám sát.",
  },
  {
    question: "Tỉ lệ ký quỹ tối thiểu theo quy định là bao nhiêu?",
    answer: "Tỉ lệ cho vay tối đa không vượt 50% giá trị chứng khoán được phép margin. Mỗi công ty chứng khoán có thể áp dụng khác nhau.",
  },
  {
    question: "Lãi suất margin tính như thế nào?",
    answer: "Lãi ngày = Dư nợ × (Lãi suất/năm ÷ 365). Tích lũy hàng ngày, thu theo định kỳ tùy công ty chứng khoán.",
  },
  {
    question: "Margin call xảy ra khi nào?",
    answer: "Khi giá trị tài sản ròng (danh mục − dư nợ) giảm dưới ngưỡng ký quỹ duy trì tối thiểu. Không xử lý kịp, công ty chứng khoán có thể bán giải chấp.",
  },
  {
    question: "Có nên dùng margin cho nhà đầu tư mới không?",
    answer: "Không khuyến nghị. Đòn bẩy khuếch đại cả lợi nhuận lẫn thua lỗ. Cần nắm vững phân tích và quản lý vốn trước.",
  },
  {
    question: "ADN Capital hỗ trợ những cổ phiếu nào được margin?",
    answer: "Cổ phiếu HOSE và HNX đủ điều kiện thanh khoản và vốn hóa theo quy định UBCKNN. Liên hệ ADN Capital để nhận danh sách hiện hành.",
  },
];

type Product = "ky-quy" | "mua-nhanh-ban-nhanh";

const VON_PRESETS = [50_000_000, 100_000_000, 300_000_000, 500_000_000, 1_000_000_000];
const LOAN_PCTS = [50, 60, 70, 80];
const RATE_PRESETS = [5.99, 9, 12, 14];
const MAINTENANCE = 0.35;

function fmtVnd(n: number) {
  if (!Number.isFinite(n)) return "--";
  return `${Math.round(n).toLocaleString("vi-VN")} đ`;
}
function fmtShort(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  return `${Math.round(n / 1_000_000)} triệu`;
}

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

  // Máy tính margin
  const [von, setVon] = useState(100_000_000);
  const [loanPct, setLoanPct] = useState(50);
  const [rate, setRate] = useState(5.99);
  const buyingPower = von / (1 - loanPct / 100);
  const debt = buyingPower - von;
  const interestDay = (debt * rate) / 100 / 365;
  const interestYear = (debt * rate) / 100;
  const callDropPct = buyingPower > 0 ? ((debt / (1 - MAINTENANCE) - buyingPower) / buyingPower) * 100 : 0;

  const isKyQuy = form.product === "ky-quy";

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Vui lòng nhập họ tên.";
    if (!form.phone.trim()) nextErrors.phone = "Vui lòng nhập số điện thoại.";
    if (isKyQuy && !form.marginRatio) nextErrors.marginRatio = "Vui lòng chọn tỉ lệ ký quỹ.";
    if (!form.loanAmount) {
      nextErrors.loanAmount = isKyQuy ? "Vui lòng chọn hạn mức vay." : "Vui lòng nhập cổ phiếu muốn giao dịch.";
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
        body: JSON.stringify({ ...form, marginRatio: isKyQuy ? form.marginRatio : undefined }),
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

  const setField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const setProduct = (product: Product) => {
    setForm((prev) => ({ ...prev, product, marginRatio: "" }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.marginRatio;
      return next;
    });
  };

  const goToForm = () => {
    const ratioLabel = MARGIN_RATIOS.find((r) => r.includes(`Vay ${loanPct}%`));
    setForm((prev) => ({ ...prev, product: "ky-quy", marginRatio: ratioLabel ?? prev.marginRatio }));
    document.getElementById("tu-van")?.scrollIntoView({ behavior: "smooth" });
  };

  const fieldCls = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors";
  const fieldStyle = (err?: boolean) => ({
    background: "var(--canvas)",
    border: `1px solid ${err ? "var(--down)" : "var(--hairline)"}`,
    color: "var(--ink)",
  });

  return (
    <Shell>
      <main className="mx-auto max-w-[1180px] px-5 sm:px-8">
        {/* HERO */}
        <section className="grid items-start gap-10 border-b border-[var(--hairline)] py-14 sm:py-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
              Cẩm nang · Cập nhật 2026
            </p>
            <h1 className="dp-display mt-4 text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[1.05] tracking-tight">
              Margin chứng khoán: hiểu cho đúng trước khi vay
            </h1>
            <p className="mt-5 max-w-[56ch] text-[18px] font-light leading-[1.65] text-[var(--ink-muted)]">
              Vay ký quỹ là dùng tiền công ty chứng khoán để mua thêm cổ phiếu. Đòn bẩy nhân lời, nhưng cũng nhân lỗ — bài này nói thẳng cả hai mặt, rồi mới tới lãi suất.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#tu-van" className="dp-btn dp-btn-solid dp-btn-lg">
                Nhận tư vấn lãi suất <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#la-gi" className="dp-btn dp-btn-ghost dp-btn-lg">Đọc cẩm nang</a>
            </div>
            <p className="dp-mono mt-5 text-[13px] text-[var(--ink-muted)]">
              Lãi từ <b className="text-[var(--moss)]">5,99%/năm</b> · phí <b className="text-[var(--moss)]">0,1%</b> · tuân Thông tư 121/2020
            </p>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-5">
            <div className="dp-panel p-5 sm:p-6">
              <p className="dp-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Trong bài này</p>
              <nav className="mt-3">
                {TOC.map((item, i) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center justify-between border-b border-[var(--hairline)] py-2.5 text-[14.5px] text-[var(--ink-muted)] transition-colors last:border-0 hover:text-[var(--moss)]"
                  >
                    <span>{item.label}</span>
                    <span className="dp-mono text-[12px] text-[var(--ink-faint)]">{String(i + 1).padStart(2, "0")}</span>
                  </a>
                ))}
              </nav>
            </div>
          </Reveal>
        </section>

        {/* LÀ GÌ */}
        <Section id="la-gi" title="Margin chứng khoán là gì?">
          <p>
            Margin là vay tiền công ty chứng khoán để mua thêm cổ phiếu, lấy chính danh mục làm tài sản đảm bảo.
            Có 100 triệu, vay thêm 100 triệu, sức mua thành 200 triệu.
          </p>
          <Highlight label="Ví dụ hai chiều">
            Cổ phiếu lên 10% thì lời gấp đôi trên vốn. Nhưng xuống 10% thì lỗ cũng gấp đôi — và lãi vay vẫn chạy mỗi ngày dù tài khoản đang âm.
          </Highlight>
        </Section>

        {/* CÁCH HOẠT ĐỘNG */}
        <Section id="cach-hoat-dong" title="Cách vay ký quỹ hoạt động">
          <div className="grid gap-3 sm:grid-cols-4">
            {["Mở tài khoản ký quỹ", "Đặt lệnh dùng sức mua", "Lãi tính theo ngày", "Trả lãi & gốc"].map((step, i) => (
              <div key={step} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
                <span className="dp-mono text-[12px] font-semibold text-[var(--gold)]">Bước {i + 1}</span>
                <p className="mt-2 text-[15px] font-medium text-[var(--ink)]">{step}</p>
              </div>
            ))}
          </div>
          <Formula label="Công thức tính lãi ngày">Lãi ngày = Dư nợ × (Lãi suất/năm ÷ 365)</Formula>
          <p>
            Tỉ lệ ký quỹ ban đầu thường quanh 50–75% tùy cổ phiếu và chính sách từng công ty chứng khoán.
            Tỉ lệ duy trì thường quanh 30–40%; nếu tài sản giảm dưới ngưỡng này, tài khoản có thể bị cảnh báo.
          </p>
        </Section>

        {/* MARGIN CALL */}
        <Section id="margin-call" title="Margin call là gì và tính ở giá nào">
          <p>
            Margin call là lúc tài khoản tụt dưới ngưỡng an toàn, công ty chứng khoán gọi bạn nộp thêm tiền.
            Không kịp thì họ bán giải chấp — bán bằng mọi giá để thu nợ về.
          </p>
          <Formula label="Ngưỡng cảnh báo">V &lt; D ÷ (1 − m)　·　V: giá trị danh mục, D: dư nợ, m: tỉ lệ duy trì</Formula>
          <Highlight label="Ví dụ margin call" tone="warn">
            Danh mục 200 triệu gồm vốn 100 triệu và vay 100 triệu, tỉ lệ duy trì 35%. Tài khoản có thể bị margin call khi danh mục giảm xuống quanh 153,8 triệu (tức cổ phiếu giảm ~23%). Không bổ sung tiền kịp, công ty chứng khoán bán giải chấp.
          </Highlight>
        </Section>

        {/* MÁY TÍNH */}
        <section id="may-tinh" className="border-t border-[var(--hairline)] py-14 sm:py-16">
          <div className="max-w-[640px]">
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">Công cụ · Miễn phí</p>
            <h2 className="dp-display mt-3 text-[clamp(1.6rem,3vw,2.3rem)] font-bold leading-tight">Máy tính margin</h2>
            <p className="mt-3 text-[16px] font-light leading-[1.6] text-[var(--ink-muted)]">
              Nhập vốn và tỉ lệ vay — xem ngay sức mua, lãi phải trả mỗi ngày và giá cổ phiếu rơi tới đâu thì bị margin call.
            </p>
          </div>
          <div className="dp-panel mt-7 p-5 sm:p-7">
            <div className="grid gap-7 lg:grid-cols-2">
              <div className="space-y-5">
                <CalcField label="Vốn tự có">
                  <div className="flex flex-wrap gap-2">
                    {VON_PRESETS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVon(v)}
                        className="dp-num rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors"
                        style={
                          von === v
                            ? { background: "var(--moss)", color: "#fff" }
                            : { background: "var(--canvas)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }
                        }
                      >
                        {fmtShort(v)}
                      </button>
                    ))}
                  </div>
                </CalcField>
                <CalcField label="Tỉ lệ cho vay (trên giá trị danh mục)">
                  <div className="flex flex-wrap gap-2">
                    {LOAN_PCTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLoanPct(p)}
                        className="dp-num rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors"
                        style={
                          loanPct === p
                            ? { background: "var(--moss)", color: "#fff" }
                            : { background: "var(--canvas)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }
                        }
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </CalcField>
                <CalcField label="Lãi suất / năm">
                  <div className="flex flex-wrap gap-2">
                    {RATE_PRESETS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRate(r)}
                        className="dp-num rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors"
                        style={
                          rate === r
                            ? { background: "var(--moss)", color: "#fff" }
                            : { background: "var(--canvas)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }
                        }
                      >
                        {r.toLocaleString("vi-VN")}%{r === 5.99 ? " · ADN" : ""}
                      </button>
                    ))}
                  </div>
                </CalcField>
              </div>

              <div className="flex flex-col gap-3.5 rounded-2xl p-6" style={{ background: "var(--moss)", color: "#fff" }}>
                <CalcOut label="Sức mua tối đa" value={fmtVnd(buyingPower)} big />
                <CalcOut label="Dư nợ vay" value={fmtVnd(debt)} />
                <CalcOut label="Lãi vay mỗi ngày" value={fmtVnd(interestDay)} />
                <CalcOut label="Lãi vay mỗi năm" value={fmtVnd(interestYear)} />
                <CalcOut label={`Margin call khi danh mục giảm (duy trì ${Math.round(MAINTENANCE * 100)}%)`} value={`${callDropPct.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} last />
                <button type="button" onClick={goToForm} className="dp-btn dp-btn-on-dark mt-1 justify-center">
                  Nhận tư vấn với mức lãi này <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Formula label="Công thức">Lãi ngày = Dư nợ × (Lãi suất/năm ÷ 365)　·　Margin call khi V &lt; D ÷ (1 − m)</Formula>
          </div>
        </section>

        {/* RỦI RO */}
        <Section id="rui-ro" title="Rủi ro đòn bẩy và cách kiểm soát">
          <div className="grid gap-4 md:grid-cols-2">
            <RiskCard title="Khuếch đại thua lỗ">
              Đòn bẩy làm lời tăng nhanh hơn, nhưng cũng khiến lỗ tăng nhanh hơn khi thị trường đi ngược kỳ vọng.
            </RiskCard>
            <RiskCard title="Lãi suất tích lũy mỗi ngày">
              Lãi margin tính theo ngày. Mức phổ biến trên thị trường quanh 8–14%/năm, nên chi phí vốn phải được kiểm soát.
            </RiskCard>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Không dồn toàn bộ sức mua vào một cổ phiếu.",
              "Đặt ngưỡng cắt lỗ trước khi mở vị thế.",
              "Không full margin khi thị trường biến động mạnh.",
              "Theo dõi danh mục và dư nợ mỗi ngày.",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-[15px] text-[var(--ink-muted)]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--up)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* LÃI SUẤT */}
        <section id="lai-suat" className="border-t border-[var(--hairline)] py-14 sm:py-16">
          <div className="max-w-[640px]">
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">So sánh</p>
            <h2 className="dp-display mt-3 text-[clamp(1.6rem,3vw,2.3rem)] font-bold leading-tight">Lãi suất margin: thị trường vs ADN</h2>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <CompareCard title="Thị trường chung" value="8–14%/năm" text="Mức phổ biến tùy công ty chứng khoán và cổ phiếu." />
            <CompareCard title="ADN Capital" value="từ 5,99%/năm" text="Chênh lãi này ăn thẳng vào lời của bạn khi ôm hàng dài." highlight cta={<a href="#tu-van" className="dp-btn dp-btn-solid mt-4" style={{ padding: ".5rem 1rem", fontSize: 13 }}>Khoá mức 5,99% <ArrowRight className="h-3.5 w-3.5" /></a>} />
            <CompareCard title="Phí giao dịch" value="0,1%" text="Tối ưu tổng chi phí khi dùng vốn vay ký quỹ." />
          </div>
        </section>

        {/* VÌ SAO ADN */}
        <Section id="vi-sao-adn" title="Vì sao chọn ADN Capital">
          <ul className="divide-y divide-[var(--hairline)]">
            {[
              ["Lãi suất thấp, phí cạnh tranh", "Từ 5,99%/năm và phí 0,1% — giữ lại nhiều lợi nhuận hơn cho danh mục dài hạn."],
              ["Tư vấn theo khẩu vị rủi ro", "Đội ngũ tư vấn hạn mức và tỉ lệ vay phù hợp năng lực chịu rủi ro, không khuyến khích full margin."],
              ["Dữ liệu hỗ trợ ra quyết định", "Theo dõi thị trường, danh mục và dư nợ để chủ động trước margin call."],
              ["Tuân thủ quy định", "Hoạt động theo Thông tư 121/2020/TT-BTC, dưới giám sát của UBCKNN."],
            ].map(([t, d]) => (
              <li key={t} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <h3 className="dp-display shrink-0 text-[18px] font-semibold sm:w-[260px]">{t}</h3>
                <p className="text-[15px] leading-[1.6] text-[var(--ink-muted)]">{d}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* FAQ */}
        <section id="faq" className="border-t border-[var(--hairline)] py-14 sm:py-16">
          <div className="max-w-[640px]">
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">Hỏi đáp</p>
            <h2 className="dp-display mt-3 text-[clamp(1.6rem,3vw,2.3rem)] font-bold leading-tight">Câu hỏi thường gặp về margin</h2>
          </div>
          <div className="mt-7 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="dp-faq rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15.5px] font-semibold text-[var(--ink)]">
                  {item.question}
                  <ChevronDown className="dp-faq-icon h-4 w-4 shrink-0 text-[var(--ink-faint)]" />
                </summary>
                <p className="mt-3 text-[15px] leading-[1.7] text-[var(--ink-muted)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FORM */}
        <section id="tu-van" className="py-14 sm:py-16">
          <div className="dp-cta overflow-hidden rounded-[24px] p-6 sm:p-10" style={{ color: "#fff" }}>
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--gold)" }}>Tư vấn theo nhu cầu</p>
                <h2 className="dp-display mt-3 text-[clamp(1.7rem,3vw,2.4rem)] font-bold leading-tight" style={{ color: "#fff" }}>
                  Để lại số, ADN gọi lại trong 2 giờ làm việc
                </h2>
                <div className="mt-6 space-y-3">
                  {["Tư vấn hoàn toàn miễn phí.", "Tối ưu lãi suất theo hạn mức và danh mục.", "Thông tin được bảo mật."].map((t) => (
                    <div key={t} className="flex items-center gap-3 text-[15px]" style={{ color: "rgba(255,255,255,0.86)" }}>
                      <Check className="h-4 w-4 shrink-0" style={{ color: "#aed3b7" }} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-[13px] leading-[1.6]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Thông tin của quý nhà đầu tư được dùng cho mục đích tư vấn sản phẩm. Hoạt động theo Thông tư 121/2020/TT-BTC.
                </p>
              </div>

              <div className="rounded-[18px] p-5 sm:p-6" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)" }}>
                {success ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "rgba(174,211,183,0.18)" }}>
                      <Check className="h-7 w-7" style={{ color: "#aed3b7" }} />
                    </div>
                    <h3 className="dp-display text-[20px] font-bold" style={{ color: "#fff" }}>Đã nhận yêu cầu!</h3>
                    <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.8)" }}>ADN Capital sẽ liên hệ với bạn sớm nhất.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSuccess(false);
                        setForm({ name: "", email: "", phone: "", product: "ky-quy", marginRatio: "", loanAmount: "" });
                      }}
                      className="mt-1 text-[13px] underline"
                      style={{ color: "#aed3b7" }}
                    >
                      Gửi thêm yêu cầu
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <FormField label="Họ và tên" required error={errors.name}>
                        <input type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Nguyễn Văn A" className={fieldCls} style={fieldStyle(!!errors.name)} />
                      </FormField>
                      <FormField label="Số điện thoại" required error={errors.phone}>
                        <input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="0912 345 678" className={fieldCls} style={fieldStyle(!!errors.phone)} />
                      </FormField>
                    </div>
                    <FormField label="Email">
                      <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="email@example.com (không bắt buộc)" className={fieldCls} style={fieldStyle(false)} />
                    </FormField>
                    <FormField label="Sản phẩm cần tư vấn" required>
                      <div className="grid grid-cols-2 gap-2">
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
                              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors"
                              style={
                                selected
                                  ? { background: "rgba(174,211,183,0.16)", border: "1px solid #aed3b7", color: "#fff" }
                                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.7)" }
                              }
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </FormField>
                    {isKyQuy && (
                      <FormField label="Tỉ lệ cho vay" required error={errors.marginRatio}>
                        <select value={form.marginRatio} onChange={(e) => setField("marginRatio", e.target.value)} className={`${fieldCls} appearance-none`} style={fieldStyle(!!errors.marginRatio)}>
                          <option value="">Chọn tỉ lệ ký quỹ...</option>
                          {MARGIN_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </FormField>
                    )}
                    {isKyQuy ? (
                      <FormField label="Hạn mức vay mong muốn" required error={errors.loanAmount}>
                        <select value={form.loanAmount} onChange={(e) => setField("loanAmount", e.target.value)} className={`${fieldCls} appearance-none`} style={fieldStyle(!!errors.loanAmount)}>
                          <option value="">Chọn hạn mức...</option>
                          {LOAN_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </FormField>
                    ) : (
                      <FormField label="Cổ phiếu muốn giao dịch T0" required error={errors.loanAmount}>
                        <input type="text" value={form.loanAmount} onChange={(e) => setField("loanAmount", e.target.value)} placeholder="VD: VNM, FPT, HPG..." className={fieldCls} style={fieldStyle(!!errors.loanAmount)} />
                      </FormField>
                    )}
                    {errors.submit && <p className="text-[13px]" style={{ color: "#f4b9ad" }}>{errors.submit}</p>}
                    <button type="submit" disabled={submitting} className="dp-btn dp-btn-on-dark w-full justify-center disabled:opacity-60" style={{ padding: ".8rem" }}>
                      {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Đang gửi...</>) : "Gửi yêu cầu tư vấn"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <p className="mt-8 flex items-start gap-2 text-center text-[13px] italic leading-[1.6] text-[var(--ink-faint)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Thông tin trong bài mang tính tham khảo, không phải khuyến nghị đầu tư. Margin là đòn bẩy — nhà đầu tư cần tự đánh giá khả năng chịu rủi ro trước khi sử dụng.</span>
          </p>
        </section>
      </main>

      {/* Sticky CTA mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hairline)] p-3 lg:hidden" style={{ background: "color-mix(in srgb, var(--canvas) 92%, transparent)", backdropFilter: "blur(10px)" }}>
        <a href="#tu-van" className="dp-btn dp-btn-solid w-full justify-center">Nhận tư vấn lãi suất từ 5,99% <ArrowRight className="h-4 w-4" /></a>
      </div>
    </Shell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="border-t border-[var(--hairline)] py-14 sm:py-16">
      <h2 className="dp-display max-w-[760px] text-[clamp(1.6rem,3vw,2.3rem)] font-bold leading-tight">{title}</h2>
      <div className="mt-6 max-w-[760px] space-y-5 text-[16px] leading-[1.7] text-[var(--ink-muted)]">{children}</div>
    </section>
  );
}

function Highlight({ label, tone = "moss", children }: { label: string; tone?: "moss" | "warn"; children: ReactNode }) {
  const accent = tone === "warn" ? "var(--down)" : "var(--moss)";
  return (
    <div className="rounded-[14px] border border-[var(--hairline)] p-5" style={{ background: "linear-gradient(160deg,#fcfbf6,#eef0e9)", borderLeft: `3px solid ${accent}` }}>
      <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent }}>{label}</p>
      <p className="mt-2 text-[15px] leading-[1.65] text-[var(--ink-muted)]">{children}</p>
    </div>
  );
}

function Formula({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[var(--hairline)] p-4" style={{ background: "var(--surface-2)" }}>
      <p className="dp-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">{label}</p>
      <p className="dp-mono mt-2 text-[15px] font-semibold text-[var(--ink)]">{children}</p>
    </div>
  );
}

function RiskCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <AlertTriangle className="h-5 w-5" style={{ color: "var(--down)" }} />
      <h3 className="dp-display mt-3 text-[17px] font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-[var(--ink-muted)]">{children}</p>
    </div>
  );
}

function CompareCard({ title, value, text, highlight, cta }: { title: string; value: string; text: string; highlight?: boolean; cta?: ReactNode }) {
  return (
    <div
      className="flex flex-col rounded-2xl p-6"
      style={
        highlight
          ? { background: "linear-gradient(160deg,#fcfbf6,#eef0e9)", border: "2px solid var(--moss)" }
          : { background: "var(--surface)", border: "1px solid var(--hairline)" }
      }
    >
      <p className="dp-mono text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: highlight ? "var(--gold)" : "var(--ink-faint)" }}>{title}</p>
      <p className="dp-display dp-num mt-2 text-[30px] font-bold" style={{ color: highlight ? "var(--moss)" : "var(--ink)" }}>{value}</p>
      <p className="mt-3 text-[14px] leading-[1.55] text-[var(--ink-muted)]">{text}</p>
      {cta}
    </div>
  );
}

function CalcField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="dp-mono mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">{label}</p>
      {children}
    </div>
  );
}

function CalcOut({ label, value, big, last }: { label: string; value: string; big?: boolean; last?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3" style={last ? {} : { borderBottom: "1px solid rgba(255,255,255,0.14)", paddingBottom: 12 }}>
      <span className="text-[13.5px]" style={{ color: "rgba(255,255,255,0.82)" }}>{label}</span>
      <span className={`dp-num ${big ? "dp-display text-[28px] font-bold" : "text-[17px] font-semibold"}`}>{value}</span>
    </div>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="dp-mono mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "rgba(255,255,255,0.66)" }}>
        {label} {required && <span style={{ color: "#f4b9ad" }}>*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[12px]" style={{ color: "#f4b9ad" }}>{error}</p>}
    </div>
  );
}
