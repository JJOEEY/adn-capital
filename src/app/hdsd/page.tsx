"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/components/providers/ThemeProvider";
import { BookOpen, Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function HDSDPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <MainLayout>
      <div className="w-full py-6 md:py-10 px-4 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h1 className={`text-xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Hướng Dẫn Sử Dụng
            </h1>
            <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-lg tracking-widest">
              UPDATING
            </span>
          </div>
          <p className={`text-sm ${isDark ? "text-white/40" : "text-slate-500"}`}>
            Hướng dẫn chi tiết cách sử dụng các công cụ trong hệ sinh thái ADN Capital.
          </p>
        </div>

        {/* Updating state */}
        <Card className="p-12 md:p-20">
          <div className="flex flex-col items-center justify-center text-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${
              isDark ? "bg-amber-500/10 border border-amber-500/20" : "bg-amber-50 border border-amber-200"
            }`}>
              <Construction className={`w-10 h-10 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
            </div>
            <h2 className={`text-2xl font-black mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              Đang cập nhật nội dung
            </h2>
            <p className={`text-sm max-w-md leading-relaxed ${isDark ? "text-white/40" : "text-slate-500"}`}>
              Chúng tôi đang xây dựng hướng dẫn sử dụng chi tiết cho tất cả các sản phẩm đầu tư.
              Nội dung sẽ bao gồm hướng dẫn RS Rating, Chat AI, Tín hiệu giao dịch và nhiều công cụ khác.
            </p>
            <div className={`mt-8 flex items-center gap-2 text-xs ${isDark ? "text-white/25" : "text-slate-400"}`}>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Coming soon...
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
