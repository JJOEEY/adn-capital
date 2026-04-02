import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { DollarSign, Check, Crown, Zap, Star, Gift, Shield } from "lucide-react";
import { PricingClient } from "./PricingClient";

export const metadata = { title: "Bảng Giá - ADN Capital" };

export default function PricingPage() {
  return (
    <MainLayout>
      <div className="p-3 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-full mb-4">
            <DollarSign className="w-3 h-3" />
            Bảng Giá Dịch Vụ
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Nâng cấp để giao dịch{" "}
            <span className="text-emerald-400">chuyên nghiệp hơn</span>
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto text-sm">
            Truy cập đầy đủ ADN Capital với phân tích chuyên sâu, tín hiệu ưu tiên và tư vấn cá nhân hóa theo lịch sử giao dịch.
          </p>
        </div>

        <PricingClient />

        {/* FAQ / Note */}
        <Card className="mt-8 p-6 text-center">
          <p className="text-sm text-neutral-400 mb-2">
            💳 Thanh toán qua <strong className="text-white">chuyển khoản ngân hàng</strong> hoặc{" "}
            <strong className="text-white">MoMo / ZaloPay</strong>
          </p>
          <p className="text-xs text-neutral-600">
            Liên hệ admin để kích hoạt tài khoản sau khi thanh toán · Hỗ trợ 24/7
          </p>
        </Card>
      </div>
    </MainLayout>
  );
}
