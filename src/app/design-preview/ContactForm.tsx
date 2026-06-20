"use client";

/**
 * Contact form — client island. Demo submit (shows a thank-you). Wire `submit` to a real
 * endpoint / email service before production.
 */

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const inputCls =
  "w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--moss)]";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true); // TODO: POST to a real contact/email endpoint
  }

  if (sent) {
    return (
      <div className="dp-panel flex flex-col items-center justify-center px-7 py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--mint)] text-[var(--moss)]">
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h3 className="dp-display mt-5 text-[22px] font-bold">Đã nhận lời nhắn của bạn.</h3>
        <p className="mt-2 max-w-[36ch] text-[15px] font-light leading-[1.55] text-[var(--ink-muted)]">ADN sẽ liên hệ lại sớm. Trong lúc chờ, bạn cứ làm bài test phong cách hoặc xem bảng giá.</p>
        <button type="button" onClick={() => setSent(false)} className="dp-btn dp-btn-ghost mt-6">Gửi lời nhắn khác</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="dp-panel p-7 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="dp-mono mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Họ tên</span>
          <input required name="name" placeholder="Nguyễn Văn A" className={inputCls} />
        </label>
        <label className="block">
          <span className="dp-mono mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Email hoặc số điện thoại</span>
          <input required name="contact" placeholder="ban@email.com" className={inputCls} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="dp-mono mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Bạn cần hỗ trợ gì?</span>
        <textarea required name="message" rows={4} placeholder="Mô tả ngắn gọn câu hỏi của bạn…" className={`${inputCls} resize-none`} />
      </label>
      <button type="submit" className="dp-btn dp-btn-solid dp-btn-lg mt-6 w-full justify-center">
        Gửi lời nhắn <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </form>
  );
}

export default ContactForm;
