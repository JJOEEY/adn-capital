"use client";

/**
 * Payment button — creates a PayOS checkout link via the existing /api/payment/create-link
 * route ({ amount, description } -> { checkoutUrl }) and redirects. Client island.
 */

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export function PayButton({ amount, description, label, className }: { amount: number; description: string; label: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/payment/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount, description }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Không tạo được link thanh toán.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không thể chuyển sang trang thanh toán.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={pay} disabled={loading} className={`${className ?? ""} disabled:opacity-70`}>
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo link…</>
        ) : (
          <>{label} <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></>
        )}
      </button>
      {err && <p className="mt-2 text-center text-[12.5px] text-[var(--down)]">{err}</p>}
    </div>
  );
}

export default PayButton;
