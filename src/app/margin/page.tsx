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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  KÃ QUá»¸ MARGIN
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const MARGIN_RATIOS = [
  "2:8 (Vay 80%)",
  "3:7 (Vay 70%)",
  "4:6 (Vay 60%)",
  "5:5 (Vay 50%)",
  "KhÃ¡c (LiÃªn há»‡ Ä‘á»ƒ Ä‘Æ°á»£c tÆ° váº¥n)",
];

const LOAN_RANGES = [
  "DÆ°á»›i 500 triá»‡u",
  "500 triá»‡u â€“ 1 tá»·",
  "1 tá»· â€“ 3 tá»·",
  "3 tá»· â€“ 10 tá»·",
  "TrÃªn 10 tá»·",
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
    if (!form.name.trim()) e.name = "Vui lÃ²ng nháº­p há» tÃªn.";
    if (!form.phone.trim()) e.phone = "Vui lÃ²ng nháº­p sá»‘ Ä‘iá»‡n thoáº¡i.";
    if (isKyQuy && !form.marginRatio) e.marginRatio = "Vui lÃ²ng chá»n tá»‰ lá»‡ kÃ½ quá»¹.";
    if (!form.loanAmount) e.loanAmount = "Vui lÃ²ng chá»n háº¡n má»©c vay.";
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
        body: JSON.stringify({
          ...form,
          marginRatio: isKyQuy ? form.marginRatio : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lá»—i");
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

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-10">

        {/* â”€â”€ Hero â”€â”€ */}
        <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-950/30 p-6 sm:p-8">
          <span className="inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] mb-3 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Dá»‹ch vá»¥ kÃ½ quá»¹
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            KÃ½ Quá»¹ <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Margin</span>
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl">
            Giáº£i phÃ¡p kÃ½ quá»¹ linh hoáº¡t, lÃ£i suáº¥t tá»‘i Æ°u â€” Ä‘á»“ng hÃ nh cÃ¹ng chiáº¿n lÆ°á»£c Ä‘áº§u tÆ° cá»§a báº¡n.
          </p>
        </div>

        {/* â”€â”€ HÃ ng 1 â”€â”€ */}
        <section className="space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">GIÃ TRá»Š Ná»”I Báº¬T Cá»¦A ADN CAPITAL</h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">TÃ i sáº£n cÃ ng lá»›n, Ä‘iá»u quan trá»ng nháº¥t lÃ  kiáº¿m tiá»n bá»n vá»¯ng tá»« lÃ£i kÃ©p</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard icon={<Shield className="w-5 h-5" />} iconBg="bg-blue-500/10 border-blue-500/20" iconColor="text-blue-400" title="Uy tÃ­n kháº³ng Ä‘á»‹nh" desc="HÆ¡n 10 nÄƒm lÃ m NÄT chuyÃªn nghiá»‡p, Ä‘á»“ng hÃ nh cÃ¹ng nhÃ  Ä‘áº§u tÆ° vá»›i dá»‹ch vá»¥ chuyÃªn nghiá»‡p vÃ  Ä‘Ã¡ng tin cáº­y." />
            <FeatureCard icon={<Layers className="w-5 h-5" />} iconBg="bg-emerald-500/10 border-emerald-500/20" iconColor="text-emerald-400" title="Giáº£i phÃ¡p linh hoáº¡t" desc="Äa dáº¡ng gÃ³i kÃ½ quá»¹, há»— trá»£ toÃ n diá»‡n vá»›i tá»‰ lá»‡ kÃ½ quá»¹ cao vÃ  há»£p phÃ¡p." />
            <FeatureCard icon={<Users className="w-5 h-5" />} iconBg="bg-purple-500/10 border-purple-500/20" iconColor="text-purple-400" title="TÆ° váº¥n cÃ¡ nhÃ¢n" desc="Äá»™i ngÅ© chuyÃªn gia cÃ¹ng há»‡ thá»‘ng Quant Trading sáºµn sÃ ng Ä‘á»“ng hÃ nh vÃ  tá»‘i Æ°u chiáº¿n lÆ°á»£c Ä‘áº§u tÆ°." />
          </div>
        </section>

        {/* â”€â”€ HÃ ng 2 â”€â”€ */}
        <section className="space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Sáº¢N PHáº¨M Äáº¶C THÃ™ Ná»”I Báº¬T</h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">Sáº£n pháº©m kÃ½ quá»¹ vÃ  sáº£n pháº©m há»— trá»£ Ä‘áº§u tÆ° ná»•i báº­t</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard icon={<Percent className="w-5 h-5" />} iconBg="bg-amber-500/10 border-amber-500/20" iconColor="text-amber-400" title="LÃ£i suáº¥t chá»‰ tá»« 5,99%/nÄƒm" desc="PhÃ­ giao dá»‹ch tá»« 0.1%. Tá»‘i Æ°u hÃ³a lá»£i nhuáº­n vÃ  giáº£m thiá»ƒu chi phÃ­." />
            <FeatureCard icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-cyan-500/10 border-cyan-500/20" iconColor="text-cyan-400" title="Tá»‰ lá»‡ kÃ½ quá»¹ cao" desc="Tá»‰ lá»‡ kÃ½ quá»¹ tá»« 25%, Ä‘a dáº¡ng nhu cáº§u sáº£n pháº©m." />
            <FeatureCard icon={<Zap className="w-5 h-5" />} iconBg="bg-yellow-500/10 border-yellow-500/20" iconColor="text-yellow-400" title="Mua nhanh â€“ BÃ¡n nhanh" desc="KhÃ´ng cáº§n pháº£i chá» T+2,5 Ä‘á»ƒ cÃ³ thá»ƒ bÃ¡n cá»• phiáº¿u, giáº£i phÃ¡p toÃ n diá»‡n cho NÄT lÆ°á»›t sÃ³ng." />
          </div>
        </section>

        {/* â”€â”€ Form tÆ° váº¥n â”€â”€ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-2">TÆ° Váº¥n Theo Nhu Cáº§u</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">Äiá»n thÃ´ng tin Ä‘á»ƒ Ä‘á»™i ngÅ© chuyÃªn gia ADN Capital liÃªn há»‡ tÆ° váº¥n sáº£n pháº©m phÃ¹ há»£p nháº¥t vá»›i chiáº¿n lÆ°á»£c Ä‘áº§u tÆ° cá»§a báº¡n.</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "TÆ° váº¥n hoÃ n toÃ n miá»…n phÃ­" },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "ThÃ´ng tin Ä‘Æ°á»£c báº£o máº­t tuyá»‡t Ä‘á»‘i" },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "Pháº£n há»“i trong vÃ²ng 2 giá» lÃ m viá»‡c" },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: "LÃ£i suáº¥t cáº¡nh tranh nháº¥t thá»‹ trÆ°á»ng" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  {item.icon}
                  <span className="text-sm text-neutral-300">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-800 pt-5">
              <p className="text-xs text-neutral-600 leading-relaxed">ThÃ´ng tin cá»§a quÃ½ NÄT sáº½ luÃ´n Ä‘Æ°á»£c báº£o máº­t tuyá»‡t Ä‘á»‘i theo chÃ­nh sÃ¡ch báº£o máº­t cá»§a ADN Capital.</p>
            </div>
          </div>

          {/* Right: form */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 sm:p-6">
            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-black text-white">ÄÄƒng kÃ½ thÃ nh cÃ´ng!</h3>
                <p className="text-sm text-neutral-400">Äá»™i ngÅ© ADN Capital sáº½ liÃªn há»‡ vá»›i báº¡n sá»›m nháº¥t cÃ³ thá»ƒ.</p>
                <button
                  onClick={() => { setSuccess(false); setForm({ name: "", email: "", phone: "", product: "ky-quy", marginRatio: "", loanAmount: "" }); }}
                  className="mt-2 text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Gá»­i thÃªm yÃªu cáº§u
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                {/* Há» tÃªn + SÄT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Há» vÃ  TÃªn" required icon={<Users className="w-4 h-4" />} error={errors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Nguyá»…n VÄƒn A"
                      className={inputCls(!!errors.name)}
                    />
                  </FormField>
                  <FormField label="Sá»‘ Ä‘iá»‡n thoáº¡i" required icon={<Phone className="w-4 h-4" />} error={errors.phone}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="0912 345 678"
                      className={inputCls(!!errors.phone)}
                    />
                  </FormField>
                </div>

                {/* Email */}
                <FormField label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="email@example.com"
                    className={inputCls(false)}
                  />
                </FormField>

                {/* Sáº£n pháº©m cáº§n tÆ° váº¥n */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">
                    Sáº£n pháº©m cáº§n tÆ° váº¥n <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProduct("ky-quy")}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        form.product === "ky-quy"
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                          : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.product === "ky-quy" ? "border-emerald-400" : "border-neutral-600"}`}>
                        {form.product === "ky-quy" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </div>
                      KÃ½ quá»¹
                    </button>
                    <button
                      type="button"
                      onClick={() => setProduct("mua-nhanh-ban-nhanh")}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        form.product === "mua-nhanh-ban-nhanh"
                          ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400"
                          : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.product === "mua-nhanh-ban-nhanh" ? "border-yellow-400" : "border-neutral-600"}`}>
                        {form.product === "mua-nhanh-ban-nhanh" && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                      </div>
                      Mua nhanh â€“ BÃ¡n nhanh
                    </button>
                  </div>
                </div>

                {/* Tá»‰ lá»‡ cho vay â€” chá»‰ hiá»‡n khi KÃ½ quá»¹ */}
                {isKyQuy && (
                  <FormField label="Tá»‰ lá»‡ cho vay" required icon={<ChevronDown className="w-4 h-4" />} error={errors.marginRatio}>
                    <select
                      value={form.marginRatio}
                      onChange={(e) => set("marginRatio", e.target.value)}
                      className={selectCls(!!errors.marginRatio)}
                    >
                      <option value="">Chá»n tá»‰ lá»‡ kÃ½ quá»¹...</option>
                      {MARGIN_RATIOS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </FormField>
                )}

                {/* Háº¡n má»©c vay */}
                <FormField label="Háº¡n má»©c vay mong muá»‘n" required error={errors.loanAmount}>
                  <select
                    value={form.loanAmount}
                    onChange={(e) => set("loanAmount", e.target.value)}
                    className={selectCls(!!errors.loanAmount)}
                  >
                    <option value="">Chá»n háº¡n má»©c...</option>
                    {LOAN_RANGES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </FormField>

                {errors.submit && <p className="text-xs text-red-400">{errors.submit}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Äang gá»­i...</>
                  ) : (
                    "ÄÄ‚NG KÃ TÆ¯ Váº¤N NGAY"
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

      </div>
    </MainLayout>
  );
}

/* â”€â”€ Sub-components â”€â”€ */
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
  `w-full px-3 py-2.5 rounded-xl bg-neutral-800 border text-sm text-white placeholder-neutral-600 focus:outline-none transition-colors ${
    hasErr ? "border-red-500/50 focus:border-red-500" : "border-neutral-700 focus:border-emerald-500/50"
  }`;

const selectCls = (hasErr: boolean) =>
  `w-full px-3 py-2.5 rounded-xl bg-neutral-800 border text-sm text-white focus:outline-none transition-colors appearance-none cursor-pointer ${
    hasErr ? "border-red-500/50 focus:border-red-500 text-red-400" : "border-neutral-700 focus:border-emerald-500/50"
  }`;

