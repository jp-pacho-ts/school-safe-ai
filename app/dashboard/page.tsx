import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DashboardDataError } from "@/components/dashboard/dashboard-states";
import { requireCurrentStaff } from "@/lib/auth/staff";
import { getDashboardOverview } from "@/lib/dashboard/reports";

export default async function DashboardPage() {
  await requireCurrentStaff();
  const { prisma } = await import("@/lib/prisma");
  const result = await getDashboardOverview(prisma);

  if (!result.ok) return <DashboardDataError description={result.message} />;

  return (
    <DashboardOverview
      metrics={result.overview.metrics}
      recentReports={result.overview.recentReports}
    />
  );
}
