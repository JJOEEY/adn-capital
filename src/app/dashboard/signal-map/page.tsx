import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { SignalMapClient } from "@/components/signals/SignalMapClient";
import { UpgradeVIP } from "@/components/ui/UpgradeVIP";
import { getCurrentDbUser } from "@/lib/current-user";
import { resolveEffectiveEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bản đồ Tín hiệu - ADN Capital",
};

export default async function DashboardSignalMapPage() {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    redirect("/auth");
  }

  const isAdmin = dbUser.systemRole === "ADMIN";
  const entitlement = await resolveEffectiveEntitlement(
    dbUser.id,
    dbUser.role,
    dbUser.vipUntil ?? null
  );

  const hasAccess = entitlement.badge !== "FREE" || isAdmin;
  const isPremium = isAdmin || entitlement.badge === "PREMIUM";

  return (
    <MainLayout>
      {hasAccess ? <SignalMapClient isPremium={isPremium} showExecutionActions={hasAccess} /> : <UpgradeVIP />}
    </MainLayout>
  );
}
