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
          <div
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-4"
            style={{ background: "var(--primary-light)", border: "1px solid var(--border)", color: "var(--primary)" }}
          >
            <DollarSign className="w-3 h-3" />
            Bảng Giá Dịch Vụ
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: "var(--text-primary)" }}>
            Nâng cấp để giao dịch{" "}
            <span style={{ color: "var(--primary)" }}>chuyên nghiệp hơn</span>
          </h1>
          <p className="max-w-lg mx-auto text-sm" style={{ color: "var(--text-secondary)" }}>
            Truy cập đầy đủ ADN Capital với phân tích chuyên sâu, tín hiệu ưu tiên và tư vấn cá nhân hóa theo lịch sử giao dịch.
          </p>
        </div>

        <PricingClient />

        {/* FAQ / Note */}
        <Card className="mt-8 p-6 text-center">
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            💳 Thanh toán qua <strong style={{ color: "var(--text-primary)" }}>chuyển khoản ngân hàng</strong> hoặc{" "}
            <strong style={{ color: "var(--text-primary)" }}>MoMo / ZaloPay</strong>
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Liên hệ admin để kích hoạt tài khoản sau khi thanh toán · Hỗ trợ 24/7
          </p>
        </Card>
      </div>
    </MainLayout>
  );
}
