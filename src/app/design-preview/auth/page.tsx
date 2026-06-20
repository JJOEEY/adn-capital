/**
 * /design-preview/auth — login / register, warm-editorial style. Minimal chrome (no nav/footer),
 * split layout: brand panel + auth card. Reads ?mode=register|login.
 */

import { Check } from "lucide-react";
import { fontVars, dpCSS } from "../theme";
import { AuthCard } from "../AuthCard";

const PERKS = [
  "Quét toàn thị trường mỗi phiên",
  "Tín hiệu có điểm vào và mức cắt lỗ",
  "7 ngày dùng thử VIP, không mất phí",
];

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "register" ? "register" : "login";

  return (
    <div className={`${fontVars} dp-root min-h-[100dvh] antialiased`} style={{ fontFamily: "var(--f-sans)", background: "var(--canvas)", color: "var(--ink)" }}>
      <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('dp-theme')==='dark'){document.currentScript.parentElement.classList.add('dp-dark');document.documentElement.style.colorScheme='dark';}}catch(e){}" }} />
      <style>{dpCSS}</style>
      <div className="grid min-h-[100dvh] lg:grid-cols-2">
        {/* brand panel */}
        <div className="dp-cta relative hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <a href="/design-preview" className="flex w-fit items-center gap-2.5 text-[var(--cream)]">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-white/15 text-sm font-bold">A</span>
            <span className="text-[16px] font-semibold tracking-tight">ADN Capital</span>
          </a>
          <div>
            <h2 className="dp-display max-w-[16ch] text-[clamp(2rem,2.8vw,2.8rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--cream)]">
              Đầu tư bằng <span className="italic text-[var(--gold)]">dữ liệu</span>, không bằng cảm tính.
            </h2>
            <ul className="mt-8 space-y-3.5">
              {PERKS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-[15.5px] font-light text-white/85">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/12 text-[var(--gold)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[13px] font-light text-white/55">Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</p>
        </div>

        {/* auth card */}
        <div className="flex items-center justify-center px-5 py-14 sm:px-8">
          <div className="w-full max-w-[420px]">
            <a href="/design-preview" className="mb-10 flex w-fit items-center gap-2.5 lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--moss)] text-sm font-bold text-white">A</span>
              <span className="text-[16px] font-semibold tracking-tight">ADN Capital</span>
            </a>
            <AuthCard initialMode={initialMode} />
          </div>
        </div>
      </div>
    </div>
  );
}
