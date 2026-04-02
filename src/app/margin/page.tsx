"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Shield,
  TrendingUp,
  Users,
  Percent,
  Layers,
  Zap,
  CheckCircle2,
  Phone,
  Mail,
  ChevronDown,
  Loader2,
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
  "500 triệu – 1 tỷ",
  "1 tỷ – 3 tỷ",
  "3 tỷ – 10 tỷ",
  "Trên 10 tỷ",
];

type Product = "ky-quy" | "mua-nhanh-ban-nhanh";

export default function MarginPage() {
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
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên.";
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const setProduct = (p: Product) => {
    setForm((prev) => ({ ...prev, product: p, marginRatio: "" }));
    setErrors((prev) => { const e = { ...prev }; delete e.marginRatio; return e; });
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-10">

        <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-950/30 p-6 sm:p-8">
          <span className="inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] mb-3 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Dịch vụ ký quỹ
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Ký Quỹ <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Margin</span>
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl">
            Giải pháp ký quỹ linh hoạt, lãi suất tối ưu — đồng hành cùng chiến lược đầu tư của bạn.
          </p>
        </div>

        <section className="space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">GIÁ TRỊ NỔI BẬT CỦA ADN CAPITAL</h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">Tài sản càng lớn, điều quan trọng nhất là kiếm tiền bền vững từ lãi kép</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard icon={<Shield className="w-5 h-5" />} iconBg="bg-blue-500/10 border-blue-500/20" iconColor="text-blue-400" title="Uy tín khẳng định" desc="Hơn 10 năm làm NĐT chuyên nghiệp, đồng hành cùng nhà đầu tư với dịch vụ chuyên nghiệp và đáng tin cậy." />
            <FeatureCard icon={<Layers className="w-5 h-5" />} iconBg="bg-emerald-500/10 border-emerald-500/20" iconColor="text-emerald-400" title="Giải pháp linh hoạt" desc="Đa dạng gói ký quỹ, hỗ trợ toàn diện với tỉ lệ ký quỹ cao và hợp pháp." />
            <FeatureCard icon={<Users className="w-5 h-5" />} iconBg="bg-purple-500/10 border-purple-500/20" iconColor="text-purple-400" title="Tư vấn cá nhân" desc="Đội ngũ chuyên gia cùng hệ thống Quant Trading sẵn sàng đồng hành và tối ưu chiến lược đầu tư." />
          </div>
        </section>

        <section className="space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">SẢN PHẨM ĐẶC THÙ NỔI BẬT</h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">Sản phẩm ký quỹ và sản phẩm hỗ trợ đầu tư nổi bật</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard icon={<Percent className="w-5 h-5" />} iconBg="bg-amber-500/10 border-amber-500/20" iconColor="text-amber-400" title="Lãi suất chỉ từ 5,99%/năm" desc="Phí giao dịch từ 0.1%. Tối ưu hóa lợi nhuận và giảm thiểu chi phí." />
            <FeatureCard icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-cyan-500/10 border-cyan-500/20" iconColor="text-cyan-400" title="Tỉ lệ ký quỹ cao" desc="Tỉ lệ ký quỹ từ 25%, đa dạng nhu cầu sản phẩm." />
            <FeatureCard icon={<Zap className="w-5 h-5" />} iconBg="bg-yellow-500/10 border-yellow-500/20" iconColor="text-yellow-400" title="Mua nhanh – Bán nhanh" desc="Không cần phải chờ T+2,5 để có thể bán cổ phiếu, giải pháp toàn diện cho NĐT lướt sóng." />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-2">Tư Vấn Theo Nhu Cầu</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">Điền thông tin để đội ngũ chuyên gia ADN Capital liên hệ tư vấn sản phẩm phù hợp nhất với chiến lược đầu tư của bạn.</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "Tư vấn hoàn toàn miễn phí" },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "Thông tin được bảo mật tuyệt đối" },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "Phản hồi trong vòng 2 giờ làm việc" },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "Lãi suất cạnh tranh nhất thị trường" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  {item.icon}
                  <span className="text-sm text-neutral-300">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-800 pt-5">
              <p className="text-xs text-neutral-600 leading-relaxed">Thông tin của quý NĐT sẽ luôn được bảo mật tuyệt đối theo chính sách bảo mật của ADN Capital.</p>
            </div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 sm:p-6">
            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-black text-white">Đăng ký thành công!</h3>
                <p className="text-sm text-neutral-400">Đội ngũ ADN Capital sẽ liên hệ với bạn sớm nhất có thể.</p>
                <button
                  onClick={() => { setSuccess(false); setForm({ name: "", email: "", phone: "", product: "ky-quy", marginRatio: "", loanAmount: "" }); }}
                  className="mt-2 text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Gửi thêm yêu cầu
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Họ và Tên" required icon={<Users className="w-4 h-4" />} error={errors.name}>
                    <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nguyễn Văn A" className={inputCls(!!errors.name)} />
                  </FormField>
                  <FormField label="Số điện thoại" required icon={<Phone className="w-4 h-4" />} error={errors.phone}>
                    <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912 345 678" className={inputCls(!!errors.phone)} />
                  </FormField>
                </div>
                <FormField label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" className={inputCls(false)} />
                </FormField>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">
                    Sản phẩm cần tư vấn <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setProduct("ky-quy")}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${form.product === "ky-quy" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"}`}>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.product === "ky-quy" ? "border-emerald-400" : "border-neutral-600"}`}>
                        {form.product === "ky-quy" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </div>
                      Ký quỹ
                    </button>
                    <button type="button" onClick={() => setProduct("mua-nhanh-ban-nhanh")}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${form.product === "mua-nhanh-ban-nhanh" ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400" : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"}`}>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.product === "mua-nhanh-ban-nhanh" ? "border-yellow-400" : "border-neutral-600"}`}>
                        {form.product === "mua-nhanh-ban-nhanh" && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                      </div>
                      Mua nhanh – Bán nhanh
                    </button>
                  </div>
                </div>
                {isKyQuy && (
                  <FormField label="Tỉ lệ cho vay" required icon={<ChevronDown className="w-4 h-4" />} error={errors.marginRatio}>
                    <select value={form.marginRatio} onChange={(e) => set("marginRatio", e.target.value)} className={selectCls(!!errors.marginRatio)}>
                      <option value="">Chọn tỉ lệ ký quỹ...</option>
                      {MARGIN_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                )}
                {isKyQuy ? (
                  <FormField label="Hạn mức vay mong muốn" required error={errors.loanAmount}>
                    <select value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)} className={selectCls(!!errors.loanAmount)}>
                      <option value="">Chọn hạn mức...</option>
                      {LOAN_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                ) : (
                  <FormField label="Cổ phiếu muốn giao dịch T0" required error={errors.loanAmount}>
                    <input type="text" value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)} placeholder="VD: VNM, FPT, HPG..." className={inputCls(!!errors.loanAmount)} />
                  </FormField>
                )}
                {errors.submit && <p className="text-xs text-red-400">{errors.submit}</p>}
                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Đang gửi...</> : "ĐĂNG KÝ TƯ VẤN NGAY"}
                </button>
              </form>
            )}
          </div>
        </section>

      </div>
    </MainLayout>
  );
}

function FeatureCard({ icon, iconBg, iconColor, title, desc }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; title: string; desc: string;
}) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 transition-all hover:-translate-y-1 duration-200">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${iconBg} ${iconColor}`}>{icon}</div>
      <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function FormField({ label, required, icon, error, children }: {
  label: string; required?: boolean; icon?: React.ReactNode; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{icon}</span>}
        <div className={icon ? "pl-9" : ""}>{children}</div>
      </div>
      {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = (hasErr: boolean) =>
  `w-full px-3 py-2.5 rounded-xl bg-neutral-800 border text-sm text-white placeholder-neutral-600 focus:outline-none transition-colors ${hasErr ? "border-red-500/50 focus:border-red-500" : "border-neutral-700 focus:border-emerald-500/50"}`;

const selectCls = (hasErr: boolean) =>
  `w-full px-3 py-2.5 rounded-xl bg-neutral-800 border text-sm text-white focus:outline-none transition-colors appearance-none cursor-pointer ${hasErr ? "border-red-500/50 focus:border-red-500 text-red-400" : "border-neutral-700 focus:border-emerald-500/50"}`;