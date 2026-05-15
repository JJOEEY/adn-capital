import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { CmsInsightsDashboard } from "@/components/admin/CmsInsightsDashboard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CmsInsightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  });

  if (user?.systemRole !== "ADMIN") redirect("/");

  return (
    <MainLayout>
      <CmsInsightsDashboard />
    </MainLayout>
  );
}
