"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  MessageSquare,
  Zap,
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
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-400",
    gradientFrom: "from-emerald-500/10",
    badge: "HOT",
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
    iconBg: "bg-yellow-500/10 border-yellow-500/20",
    iconColor: "text-yellow-400",
    gradientFrom: "from-yellow-500/10",
    badge: null,
    title: "Tín Hiệu",
    subtitle: "Bản đồ tín hiệu giao dịch",
    desc: "Nhận tín hiệu mua/bán theo hệ thống Quant Trading của ADN Capital — bộ lọc đa chiều, tối ưu cho thị trường Việt Nam với tỷ lệ thắng thực chiến cao.",
    features: [
      "Tín hiệu mua/bán tự động",
      "Bộ lọc Volume & sức mạnh cùng lúc",
      "Lịch sử tín hiệu đầy đủ",
      "Thông báo theo thời gian thực",
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
        <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-blue-950/20 p-6 sm:p-8">
          <span className="inline-block text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] mb-3 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
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
                <div className={`group relative h-full bg-gradient-to-b ${svc.gradientFrom} to-transparent bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer`}>
                  {/* Badge */}
                  {svc.badge && (
                    <span className="absolute top-4 right-4 text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full tracking-widest">
                      {svc.badge}
                    </span>
                  )}

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 ${svc.iconBg} ${svc.iconColor} transition-transform group-hover:scale-110 duration-200`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-black text-white mb-0.5">{svc.title}</h2>
                  <p className="text-xs text-neutral-500 mb-3">{svc.subtitle}</p>

                  {/* Desc */}
                  <p className="text-sm text-neutral-400 leading-relaxed mb-5">{svc.desc}</p>

                  {/* Feature list */}
                  <ul className="space-y-2 mb-5">
                    {svc.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${svc.iconColor.replace("text-", "bg-")}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className={`flex items-center gap-1 text-xs font-bold ${svc.iconColor} group-hover:gap-2 transition-all`}>
                    Xem ngay <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            );
          })}

          {/* ── Tin Tức Tài Chính (ADMIN / WRITER only) ── */}
          {isAdminOrWriter && (
            <Link href="/khac/tin-tuc">
              <div className="group relative h-full bg-gradient-to-b from-blue-500/10 to-transparent bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
                <span className="absolute top-4 right-4 text-[9px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full tracking-widest">
                  BETA
                </span>

                <div className="w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 bg-blue-500/10 border-blue-500/20 text-blue-400 transition-transform group-hover:scale-110 duration-200">
                  <Newspaper className="w-6 h-6" />
                </div>

                <h2 className="text-lg font-black text-white mb-0.5">Tin Tức Tài Chính</h2>
                <p className="text-xs text-neutral-500 mb-3">CMS — Quản trị nội dung AI</p>

                <p className="text-sm text-neutral-400 leading-relaxed mb-5">
                  Hệ thống tin tức tài chính tích hợp AI tóm tắt. Đọc tin theo chuyên mục, phân tích sentiment tự động, luồng duyệt bài chuyên nghiệp.
                </p>

                <ul className="space-y-2 mb-5">
                  {["AI tóm tắt bài viết", "Phân tích Tích cực / Tiêu cực", "Luồng duyệt bài WRITER → ADMIN", "Giao diện CafeF / VNExpress"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="w-1 h-1 rounded-full flex-shrink-0 bg-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:gap-2 transition-all">
                  Xem ngay <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* ── Margin CTA ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-white mb-0.5">Ký Quỹ Margin</h3>
            <p className="text-xs text-neutral-500">Lãi suất từ 5,99%/năm — Tư vấn miễn phí, phản hồi trong 2 giờ.</p>
          </div>
          <Link href="/margin">
            <button className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all cursor-pointer">
              Đăng ký tư vấn <ArrowRight className="w-3 h-3" />
            </button>
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}
