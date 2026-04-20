import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { getCurrentDbUser } from "@/lib/current-user";
import { DnseTradingClient } from "@/components/broker/DnseTradingClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DNSE Trading - ADN Capital",
};

export default async function DnseTradingPage() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    redirect("/auth");
  }
  if (dbUser.systemRole !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <MainLayout>
      <DnseTradingClient />
    </MainLayout>
  );
}
