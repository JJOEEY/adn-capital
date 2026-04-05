import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { SignalMapClient } from "@/components/signals/SignalMapClient";
import { UpgradeVIP } from "@/components/ui/UpgradeVIP";
import { getCurrentDbUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bản đồ Tín hiệu - ADN Capital",
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Trang Bản đồ Tín hiệu (Signal Map) — phiên bản dashboard.
 * - Route được middleware NextAuth bảo vệ ở mức đăng nhập.
 * - Paywall VIP: tài khoản FREE sẽ thấy gợi ý nâng cấp.
 * - Lịch sử tín hiệu: chỉ dành cho PREMIUM hoặc ADMIN.
 */
export default async function DashboardSignalMapPage() {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    redirect("/auth");
  }

  const isAdmin = ADMIN_EMAILS.includes(dbUser.email?.toLowerCase() ?? "");
  const hasAccess = dbUser.role === "VIP" || isAdmin;

  // vipTier: PREMIUM nếu vipUntil > 90 ngày
  let isPremium = isAdmin; // Admin luôn có full access
  if (!isPremium && dbUser.role === "VIP" && dbUser.vipUntil) {
    const daysLeft = Math.ceil(
      (new Date(dbUser.vipUntil).getTime() - Date.now()) / 86400000
    );
    isPremium = daysLeft > 90;
  }

  return (
    <MainLayout>
      {hasAccess ? <SignalMapClient isPremium={isPremium} /> : <UpgradeVIP />}
    </MainLayout>
  );
}
