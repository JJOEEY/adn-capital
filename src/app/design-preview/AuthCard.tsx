"use client";

/**
 * Auth card — client island. Toggle login/register. Demo only (no real auth wired).
 * Google button + email form are visual; wire to NextAuth (signIn("google")) before production.
 */

import { useState } from "react";
import { ArrowRight } from "lucide-react";

const inputCls =
  "w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--moss)]";

const labelCls = "dp-mono mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]";

export function AuthCard({ initialMode }: { initialMode: "login" | "register" }) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const isReg = mode === "register";

  return (
    <div className="w-full">
      <h1 className="dp-display text-[clamp(2rem,4vw,2.6rem)] font-bold leading-tight tracking-[-0.015em]">
        {isReg ? "Tạo tài khoản ADN" : "Đăng nhập ADN"}
      </h1>
      <p className="mt-2 text-[15.5px] font-light text-[var(--ink-muted)]">
        {isReg ? "Miễn phí, kèm 7 ngày dùng thử gói VIP." : "Tiếp tục hành trình đầu tư của bạn."}
      </p>

      <button type="button" className="dp-btn mt-8 w-full justify-center gap-3 border border-[var(--hairline)] bg-[var(--surface)] py-3 text-[15px] font-medium hover:border-[var(--moss)]">
        <img src="https://cdn.simpleicons.org/google" alt="" className="h-[18px] w-[18px]" /> Tiếp tục với Google
      </button>

      <div className="my-6 flex items-center gap-4 text-[12.5px] font-light text-[var(--ink-faint)]">
        <span className="h-px flex-1 bg-[var(--hairline)]" /> hoặc dùng email <span className="h-px flex-1 bg-[var(--hairline)]" />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {isReg && (
          <label className="block">
            <span className={labelCls}>Họ tên</span>
            <input required name="name" placeholder="Nguyễn Văn A" className={inputCls} />
          </label>
        )}
        <label className="block">
          <span className={labelCls}>Email</span>
          <input required type="email" name="email" placeholder="ban@email.com" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Mật khẩu</span>
          <input required type="password" name="password" placeholder="••••••••" className={inputCls} />
        </label>
        <button type="submit" className="dp-btn dp-btn-solid dp-btn-lg w-full justify-center">
          {isReg ? "Tạo tài khoản" : "Đăng nhập"} <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>

      {isReg && (
        <p className="mt-4 text-[12.5px] font-light leading-[1.5] text-[var(--ink-faint)]">
          Bằng việc tạo tài khoản, bạn đồng ý với điều khoản sử dụng của ADN Capital.
        </p>
      )}

      <p className="mt-7 text-center text-[14.5px] font-light text-[var(--ink-muted)]">
        {isReg ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <button type="button" onClick={() => setMode(isReg ? "login" : "register")} className="font-semibold text-[var(--moss)] hover:underline">
          {isReg ? "Đăng nhập" : "Đăng ký miễn phí"}
        </button>
      </p>
    </div>
  );
}

export default AuthCard;
