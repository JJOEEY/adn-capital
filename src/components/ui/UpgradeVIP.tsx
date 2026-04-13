"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Loader2, Zap } from "lucide-react";

/**
 * Khối paywall hiển thị cho tài khoản FREE.
 * Không render dữ liệu tín hiệu để tránh lộ tính năng VIP.
 */
export function UpgradeVIP() {
  const router = useRouter();
  const [dangTaoThanhToan, setDangTaoThanhToan] = useState(false);
  const [loiThanhToan, setLoiThanhToan] = useState<string | null>(null);

  async function handleNangCapVip() {
    try {
      setDangTaoThanhToan(true);
      setLoiThanhToan(null);

      const response = await fetch("/api/payment/create", {
        method: "POST",
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Không tạo được link thanh toán PayOS");
      }

      router.push(data.checkoutUrl);
    } catch (error) {
      setLoiThanhToan(
        error instanceof Error
          ? error.message
          : "Không thể chuyển sang trang thanh toán",
      );
    } finally {
      setDangTaoThanhToan(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-8">
      <div
        className="w-full max-w-2xl rounded-2xl border p-8 text-center md:p-12"
        style={{
          background: "var(--surface)",
          borderColor: "rgba(234,179,8,0.20)",
        }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border"
          style={{ borderColor: "rgba(234,179,8,0.30)", background: "rgba(234,179,8,0.15)" }}
        >
          <Crown className="h-8 w-8" style={{ color: "#eab308" }} />
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#eab308" }}>
          VIP Paywall
        </p>
        <h1 className="mx-auto max-w-xl text-2xl font-black leading-tight md:text-4xl" style={{ color: "var(--text-primary)" }}>
          ⚡️ TÍNH NĂNG DÀNH RIÊNG CHO TÀI KHOẢN VIP. Hãy nâng cấp để xem Siêu Cổ Phiếu realtime!
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 md:text-base" style={{ color: "var(--text-muted)" }}>
          Tài khoản FREE chỉ xem được phần giới thiệu. Để mở khóa bảng tín hiệu realtime, cần nâng cấp gói VIP.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleNangCapVip}
            disabled={dangTaoThanhToan}
            className="inline-flex min-w-[250px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: "#eab308", color: "#000" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ca8a04")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#eab308")}
          >
            {dangTaoThanhToan ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo mã QR...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Nâng cấp VIP ngay - 1.000.000đ
              </>
            )}
          </button>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition"
            style={{
              borderColor: "rgba(234,179,8,0.30)",
              background: "transparent",
              color: "#fde047",
            }}
          >
            Xem bảng giá
          </Link>
        </div>

        {loiThanhToan && (
          <p className="mt-4 text-sm" style={{ color: "var(--danger)" }}>{loiThanhToan}</p>
        )}
      </div>
    </div>
  );
}
