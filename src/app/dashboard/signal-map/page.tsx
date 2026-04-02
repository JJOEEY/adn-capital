import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { SignalMapClient } from "@/components/signals/SignalMapClient";
import { UpgradeVIP } from "@/components/ui/UpgradeVIP";
import { getCurrentDbUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bản đồ Tín hiệu - ADN Capital",
};

/**
 * Trang Bản đồ Tín hiệu (Signal Map) — phiên bản dashboard.
 * - Route được middleware NextAuth bảo vệ ở mức đăng nhập.
 * - Paywall VIP: tài khoản FREE sẽ thấy gợi ý nâng cấp.
 */
export default async function DashboardSignalMapPage() {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    redirect("/auth");
  }

  const isVip = dbUser.role === "VIP";

  return (
    <MainLayout>
      {isVip ? <SignalMapClient /> : <UpgradeVIP />}
    </MainLayout>
  );
}
