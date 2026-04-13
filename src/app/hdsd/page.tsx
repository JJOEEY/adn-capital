"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { BookOpen, Construction } from "lucide-react";

export default function HDSDPage() {
  return (
    <MainLayout>
      <div className="w-full py-6 md:py-10 px-4 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5" style={{ color: "#f59e0b" }} />
            <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              Hướng Dẫn Sử Dụng
            </h1>
            <span
              className="text-[11px] font-black px-2 py-0.5 rounded-lg tracking-widest"
              style={{
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              UPDATING
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Hướng dẫn chi tiết cách sử dụng các công cụ trong hệ sinh thái ADN Capital.
          </p>
        </div>

        {/* Updating state */}
        <div
          className="glow-card rounded-[14px] border transition-all duration-200 p-12 md:p-20"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.20)" }}
            >
              <Construction className="w-10 h-10" style={{ color: "#f59e0b" }} />
            </div>
            <h2 className="text-2xl font-black mb-3" style={{ color: "var(--text-primary)" }}>
              Đang cập nhật nội dung
            </h2>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Chúng tôi đang xây dựng hướng dẫn sử dụng chi tiết cho tất cả các sản phẩm đầu tư.
              Nội dung sẽ bao gồm hướng dẫn RS Rating, Chat AI, Tín hiệu giao dịch và nhiều công cụ khác.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#f59e0b" }}
              />
              Coming soon...
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
