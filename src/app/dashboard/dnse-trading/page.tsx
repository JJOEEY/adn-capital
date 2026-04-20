import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { getCurrentDbUser } from "@/lib/current-user";
import { DnseTradingClient } from "@/components/broker/DnseTradingClient";
import { DnseTradingExtendedPanels } from "@/components/broker/DnseTradingExtendedPanels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DNSE Trading - ADN Capital",
};

export default async function DnseTradingPage() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    redirect("/auth");
  }

  return (
    <MainLayout>
      <DnseTradingClient />
      <DnseTradingExtendedPanels />
    </MainLayout>
  );
}
