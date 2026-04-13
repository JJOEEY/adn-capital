"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Shield, TrendingUp, Users, Percent, Layers, Zap,
  CheckCircle2, Phone, Mail, ChevronDown, Loader2,
} from "lucide-react";

const MARGIN_RATIOS = [
  "2:8 (Vay 80%)", "3:7 (Vay 70%)", "4:6 (Vay 60%)",
  "5:5 (Vay 50%)", "Khác (Liên hệ để được tư vấn)",
];
const LOAN_RANGES = [
  "Dưới 500 triệu", "500 triệu – 1 tỷ", "1 tỷ – 3 tỷ",
  "3 tỷ – 10 tỷ", "Trên 10 tỷ",
];

type Product = "ky-quy" | "mua-nhanh-ban-nhanh";

/* Icon background colour set per card (token-safe hex/rgba) */
const ICON_COLORS = [
  { bg: "rgba(46,77,61,0.15)",  border: "rgba(46,77,61,0.25)",  color: "#2E4D3D" }, // forest green
  { bg: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.20)", color: "#16a34a" }, // emerald
  { bg: "rgba(125,132,113,0.12)", border: "rgba(125,132,113,0.22)", color: "#7D8471" }, // sage
];
const PRODUCT_COLORS = [
  { bg: "rgba(22,163,74,0.08)",  border: "rgba(22,163,74,0.30)",  color: "#16a34a"  }, // emerald
  { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.30)", color: "#f59e0b"  }, // amber
];

export default function MarginPage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    product: "ky-quy" as Product, marginRatio: "", loanAmount: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isKyQuy = form.product === "ky-quy";

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name = "Vui lòng nhập họ tên.";
    if (!form.phone.trim()) e.phone = "Vui lòng nhập số điện thoại.";
    if (isKyQuy && !form.marginRatio) e.marginRatio = "Vui lòng chọn tỉ lệ ký quỹ.";
    if (!form.loanAmount) e.loanAmount = isKyQuy ? "Vui lòng chọn hạn mức vay." : "Vui lòng nhập cổ phiếu muốn giao dịch.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/margin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, marginRatio: isKyQuy ? form.marginRatio : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi");
      setSuccess(true);
    } catch (err) {
      setErrors({ submit: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const setProduct = (p: Product) => {
    setForm((prev) => ({ ...prev, product: p, marginRatio: "" }));
    setErrors((prev) => { const e = { ...prev }; delete e.marginRatio; return e; });
  };

  /* Shared input classes */
  const inputBase = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors";
  const inputStyle = (hasErr: boolean) => ({
    background: "var(--surface-2)",
    border: `1px solid ${hasErr ? "rgba(192,57,43,0.50)" : "var(--border)"}`,
    color: "var(--text-primary)",
  });

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-10">

        {/* ─── Hero Banner ─── */}
        <div
          className="rounded-2xl overflow-hidden p-6 sm:p-8"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <span
            className="inline-block text-[12px] font-bold uppercase tracking-[0.3em] mb-3 px-3 py-1 rounded-full"
            style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border)" }}
          >
            Dịch vụ ký quỹ
          </span>
          <h1 className="text-3xl sm:text-4xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
            Ký Quỹ{" "}
            <span style={{ color: "var(--primary)" }}>Margin</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Giải pháp ký quỹ linh hoạt, lãi suất tối ưu — đồng hành cùng chiến lược đầu tư của bạn.
          </p>
        </div>

        {/* ─── Feature cards: Values ─── */}
        <section className="space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              GIÁ TRỊ NỔI BẬT CỦA ADN CAPITAL
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-muted)" }}>
              Tài sản càng lớn, điều quan trọng nhất là kiếm tiền bền vững từ lãi kép
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard icon={<Shield className="w-5 h-5" />}      c={ICON_COLORS[0]} title="Uy tín khẳng định"   desc="Hơn 10 năm làm NĐT chuyên nghiệp, đồng hành cùng nhà đầu tư với dịch vụ chuyên nghiệp và đáng tin cậy." />
            <FeatureCard icon={<Layers className="w-5 h-5" />}      c={ICON_COLORS[1]} title="Giải pháp linh hoạt" desc="Đa dạng gói ký quỹ, hỗ trợ toàn diện với tỉ lệ ký quỹ cao và hợp pháp." />
            <FeatureCard icon={<Users className="w-5 h-5" />}       c={ICON_COLORS[2]} title="Tư vấn cá nhân"      desc="Đội ngũ chuyên gia cùng hệ thống Quant Trading sẵn sàng đồng hành và tối ưu chiến lược đầu tư." />
          </div>
        </section>

        {/* ─── Feature cards: Products ─── */}
        <section className="space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              SẢN PHẨM ĐẶC THÙ NỔI BẬT
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-muted)" }}>
              Sản phẩm ký quỹ và sản phẩm hỗ trợ đầu tư nổi bật
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard icon={<Percent className="w-5 h-5" />}    c={ICON_COLORS[0]} title="Lãi suất chỉ từ 5,99%/năm" desc="Phí giao dịch từ 0.1%. Tối ưu hóa lợi nhuận và giảm thiểu chi phí." />
            <FeatureCard icon={<TrendingUp className="w-5 h-5" />} c={ICON_COLORS[1]} title="Tỉ lệ ký quỹ cao"          desc="Tỉ lệ ký quỹ từ 25%, đa dạng nhu cầu sản phẩm." />
            <FeatureCard icon={<Zap className="w-5 h-5" />}        c={ICON_COLORS[2]} title="Mua nhanh – Bán nhanh"     desc="Không cần phải chờ T+2,5 để có thể bán cổ phiếu, giải pháp toàn diện cho NĐT lướt sóng." />
          </div>
        </section>

        {/* ─── CTA + Form ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
                Tư Vấn Theo Nhu Cầu
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Điền thông tin để đội ngũ chuyên gia ADN Capital liên hệ tư vấn sản phẩm phù hợp nhất với chiến lược đầu tư của bạn.
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Tư vấn hoàn toàn miễn phí",
                "Thông tin được bảo mật tuyệt đối",
                "Phản hồi trong vòng 2 giờ làm việc",
                "Lãi suất cạnh tranh nhất thị trường",
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#16a34a" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{text}</span>
                </div>
              ))}
            </div>
            <div className="pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Thông tin của quý NĐT sẽ luôn được bảo mật tuyệt đối theo chính sách bảo mật của ADN Capital.
              </p>
            </div>
          </div>

          {/* Right: form card */}
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.20)" }}
                >
                  <CheckCircle2 className="w-7 h-7" style={{ color: "#16a34a" }} />
                </div>
                <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Đăng ký thành công!</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Đội ngũ ADN Capital sẽ liên hệ với bạn sớm nhất có thể.
                </p>
                <button
                  onClick={() => { setSuccess(false); setForm({ name: "", email: "", phone: "", product: "ky-quy", marginRatio: "", loanAmount: "" }); }}
                  className="mt-2 text-xs hover:underline cursor-pointer"
                  style={{ color: "#16a34a" }}
                >
                  Gửi thêm yêu cầu
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Họ và Tên" required icon={<Users className="w-4 h-4" />} error={errors.name}>
                    <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nguyễn Văn A"
                      className={inputBase} style={inputStyle(!!errors.name)} />
                  </FormField>
                  <FormField label="Số điện thoại" required icon={<Phone className="w-4 h-4" />} error={errors.phone}>
                    <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912 345 678"
                      className={inputBase} style={inputStyle(!!errors.phone)} />
                  </FormField>
                </div>
                <FormField label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com"
                    className={inputBase} style={inputStyle(false)} />
                </FormField>

                {/* Product selector */}
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                    Sản phẩm cần tư vấn <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "ky-quy" as Product,             label: "Ký quỹ",              pc: PRODUCT_COLORS[0] },
                      { val: "mua-nhanh-ban-nhanh" as Product, label: "Mua nhanh – Bán nhanh", pc: PRODUCT_COLORS[1] },
                    ].map(({ val, label, pc }) => {
                      const sel = form.product === val;
                      return (
                        <button key={val} type="button" onClick={() => setProduct(val)}
                          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                          style={sel
                            ? { background: pc.bg, border: `1px solid ${pc.border}`, color: pc.color }
                            : { background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
                          }
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ border: `2px solid ${sel ? pc.color : "var(--text-muted)"}` }}
                          >
                            {sel && <div className="w-1.5 h-1.5 rounded-full" style={{ background: pc.color }} />}
                          </div>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isKyQuy && (
                  <FormField label="Tỉ lệ cho vay" required icon={<ChevronDown className="w-4 h-4" />} error={errors.marginRatio}>
                    <select value={form.marginRatio} onChange={(e) => set("marginRatio", e.target.value)}
                      className={`${inputBase} appearance-none cursor-pointer`} style={inputStyle(!!errors.marginRatio)}>
                      <option value="">Chọn tỉ lệ ký quỹ...</option>
                      {MARGIN_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                )}

                {isKyQuy ? (
                  <FormField label="Hạn mức vay mong muốn" required error={errors.loanAmount}>
                    <select value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)}
                      className={`${inputBase} appearance-none cursor-pointer`} style={inputStyle(!!errors.loanAmount)}>
                      <option value="">Chọn hạn mức...</option>
                      {LOAN_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                ) : (
                  <FormField label="Cổ phiếu muốn giao dịch T0" required error={errors.loanAmount}>
                    <input type="text" value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)}
                      placeholder="VD: VNM, FPT, HPG..." className={inputBase} style={inputStyle(!!errors.loanAmount)} />
                  </FormField>
                )}

                {errors.submit && <p className="text-xs" style={{ color: "var(--danger)" }}>{errors.submit}</p>}

                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  style={{ background: "var(--primary)", color: "#EBE2CF" }}>
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Đang gửi...</>
                    : "ĐĂNG KÝ TƯ VẤN NGAY"
                  }
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

/* ─── Sub-components ─── */
function FeatureCard({ icon, c, title, desc }: {
  icon: React.ReactNode;
  c: { bg: string; border: string; color: string };
  title: string; desc: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 transition-all hover:-translate-y-1 duration-200"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
    </div>
  );
}

function FormField({ label, required, icon, error, children }: {
  label: string; required?: boolean; icon?: React.ReactNode; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
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
      {error && <p className="text-[12px] mt-1" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}