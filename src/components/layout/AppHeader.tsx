"use client";

import { usePathname } from "next/navigation";
import { Bell, RefreshCw, Bot } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";

export function AppHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Map pathname to title/breadcrumb
  const getBreadcrumb = () => {
    if (pathname === "/dashboard") return "Dashboard · Tổng quan thị trường";
    if (pathname === "/art") return "Sản phẩm · Chỉ báo ART";
    if (pathname === "/terminal") return "Sản phẩm · Tư vấn đầu tư";
    if (pathname === "/dashboard/signal-map") return "Sản phẩm · ADN AI Broker";
    if (pathname === "/margin") return "Dịch vụ · Ký quỹ";
    if (pathname === "/journal") return "Dịch vụ · Nhật ký giao dịch";
    if (pathname === "/pricing") return "Khác · Bảng giá";
    if (pathname === "/backtest") return "Khác · Backtest";
    if (pathname === "/hdsd") return "Khác · Hướng dẫn sử dụng";
    if (pathname === "/profile") return "Tài khoản · Thông tin cá nhân";
    if (pathname === "/admin") return "Hệ thống · Quản lý";
    return "ADN Capital · Investment System";
  };

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/art") return "Chỉ báo ART";
    if (pathname === "/terminal") return "Tư vấn đầu tư";
    if (pathname === "/dashboard/signal-map") return "ADN AI Broker";
    if (pathname === "/margin") return "Ký quỹ Margin";
    if (pathname === "/journal") return "Nhật ký giao dịch";
    if (pathname === "/pricing") return "Bảng giá dịch vụ";
    if (pathname === "/backtest") return "Backtest chiến thuật";
    if (pathname === "/hdsd") return "Hướng dẫn sử dụng";
    if (pathname === "/profile") return "Trang cá nhân";
    if (pathname === "/admin") return "Quản lý hệ thống";
    return "ADN Capital";
  };

  if (!mounted) return <div className="h-14" />;

  return (
    <header
      className="h-14 px-6 flex items-center justify-between shrink-0 sticky top-0 z-30"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left: Title + Breadcrumb */}
      <div className="flex flex-col">
        <h1 className="text-[17px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
          {getPageTitle()}
        </h1>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {getBreadcrumb()}
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium"
          style={{ background: "rgba(23,54,39,0.40)", color: "var(--text-secondary)" }}
        >
          <Bot className="w-3 h-3" />
          ADN AI SYSTEM
        </div>

        <button
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Bell className="w-4 h-4" />
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex items-center gap-2 h-9 px-4 rounded-lg border"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>
    </header>
  );
}
