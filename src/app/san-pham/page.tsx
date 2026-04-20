"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  MessageSquare,
  Zap,
  Wallet,
  ArrowRight,
  TrendingUp,
  Newspaper,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  SẢN PHẨM DỊCH VỤ — Tổng quan các tính năng ADN Capital
 * ═══════════════════════════════════════════════════════════════════════════ */

const services = [
  {
    href: "/terminal",
    icon: MessageSquare,
    iconStyle: { background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.20)", color: "#10b981" },
    badge: "HOT",
    badgeStyle: { background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)" },
    bulletColor: "#10b981",
    ctaColor: "#10b981",
    title: "Chat AI",
    subtitle: "Trợ lý đầu tư thông minh",
    desc: "Hỏi đáp phân tích kỹ thuật, cơ bản, vĩ mô với AI chuyên sâu về thị trường chứng khoán Việt Nam. Phân tích cổ phiếu, đọc báo cáo tài chính nhanh chóng.",
    features: [
      "Phân tích kỹ thuật theo yêu cầu",
      "Tóm tắt báo cáo tài chính",
      "Market sentiment & vĩ mô",
      "Luận điểm Long / Short",
    ],
  },
  {
    href: "/dashboard/signal-map",
    icon: Zap,
    iconStyle: { background: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.20)", color: "#eab308" },
    badge: null,
    badgeStyle: null,
    bulletColor: "#eab308",
    ctaColor: "#eab308",
    title: "ADN AI Broker",
    subtitle: "Trợ lý đồng hành khuyến nghị đầu tư",
    desc: "Nhận tín hiệu mua/bán theo hệ thống Quant Trading của ADN Capital — bộ lọc đa chiều, tối ưu cho thị trường Việt Nam với tỷ lệ thắng thực chiến cao.",
    features: [
      "Tín hiệu mua/bán tự động",
      "Bộ lọc Volume & sức mạnh cùng lúc",
      "Lịch sử tín hiệu đầy đủ",
      "Thông báo theo thời gian thực",
    ],
  },
  {
    href: "/dashboard/dnse-trading",
    icon: Wallet,
    iconStyle: { background: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.20)", color: "#3b82f6" },
    badge: "NEW",
    badgeStyle: { background: "rgba(59,130,246,0.15)", color: "#3b82f6", borderColor: "rgba(59,130,246,0.25)" },
    bulletColor: "#3b82f6",
    ctaColor: "#3b82f6",
    title: "DNSE Trading",
    subtitle: "Kết nối tài khoản & đặt lệnh",
    desc: "Kết nối tài khoản DNSE chính để theo dõi NAV, danh mục đang nắm giữ và thực hiện đặt lệnh mua bán chủ động theo cơ chế an toàn của ADN Capital.",
    features: [
      "Kết nối tài khoản DNSE chính",
      "Theo dõi NAV và danh mục nắm giữ",
      "Xem lịch sử lệnh gần nhất",
      "Đặt lệnh chủ động theo từng mã",
    ],
  },
];

export default function SanPhamPage() {
  const { data: session } = useSession();
  const systemRole = (session?.user as { systemRole?: string } | undefined)?.systemRole;
  const isAdminOrWriter = systemRole === "ADMIN" || systemRole === "WRITER";

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-gradient-to-br from-neutral-900 via-neutral-900 to-blue-950/20 p-6 sm:p-8">
          <span className="inline-block text-[12px] font-bold text-blue-400 uppercase tracking-[0.3em] mb-3 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
            ADN Capital Platform
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Sản Phẩm &{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Dịch Vụ
            </span>
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl">
            Hệ sinh thái công cụ đầu tư chứng khoán toàn diện — từ phân tích kỹ thuật, AI hỗ trợ đến tín hiệu giao dịch theo thời gian thực.
          </p>
        </div>

        {/* ── Service Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <Link key={svc.href} href={svc.href}>
                <div className="group relative h-full border rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  {/* Badge */}
                  {svc.badge && (
                    <span className="absolute top-4 right-4 text-[11px] font-black px-2 py-0.5 rounded-full tracking-widest border" style={svc.badgeStyle ?? {}}>
                      {svc.badge}
                    </span>
                  )}

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-200" style={svc.iconStyle}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-black mb-0.5" style={{ color: "var(--text-primary)" }}>{svc.title}</h2>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{svc.subtitle}</p>

                  {/* Desc */}
                  <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-secondary)" }}>{svc.desc}</p>

                  {/* Feature list */}
                  <ul className="space-y-2 mb-5">
                    {svc.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: svc.bulletColor }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="flex items-center gap-1 text-xs font-bold group-hover:gap-2 transition-all" style={{ color: svc.ctaColor }}>
                    Xem ngay <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            );
          })}

          {/* ── Tin Tức Tài Chính (ADMIN / WRITER only) ── */}
          {isAdminOrWriter && (
            <Link href="/khac/tin-tuc">
              <div className="group relative h-full border rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <span className="absolute top-4 right-4 text-[11px] font-black px-2 py-0.5 rounded-full tracking-widest border" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)" }}>
                  BETA
                </span>

                <div className="w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-200" style={{ background: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.20)", color: "#3b82f6" }}>
                  <Newspaper className="w-6 h-6" />
                </div>

                <h2 className="text-lg font-black mb-0.5" style={{ color: "var(--text-primary)" }}>Tin Tức Tài Chính</h2>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>CMS — Quản trị nội dung AI</p>

                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-secondary)" }}>
                  Hệ thống tin tức tài chính tích hợp AI tóm tắt. Đọc tin theo chuyên mục, phân tích sentiment tự động, luồng duyệt bài chuyên nghiệp.
                </p>

                <ul className="space-y-2 mb-5">
                  {["AI tóm tắt bài viết", "Phân tích Tích cực / Tiêu cực", "Luồng duyệt bài WRITER → ADMIN", "Giao diện CafeF / VNExpress"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#3b82f6" }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-1 text-xs font-bold group-hover:gap-2 transition-all" style={{ color: "#3b82f6" }}>
                  Xem ngay <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* ── Margin CTA ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 flex-shrink-0 rounded-xl border flex items-center justify-center" style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.20)", color: "#10b981" }}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black mb-0.5" style={{ color: "var(--text-primary)" }}>Ký Quỹ Margin</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lãi suất từ 5,99%/năm — Tư vấn miễn phí, phản hồi trong 2 giờ.</p>
          </div>
          <Link href="/margin">
            <button className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer" style={{ background: "#10b981", color: "#000" }}>
              Đăng ký tư vấn <ArrowRight className="w-3 h-3" />
            </button>
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}
