import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateReportStatusAction } from "@/app/dashboard/actions";
import { ReportDetailView } from "@/components/dashboard/report-detail";
import { DashboardDataError } from "@/components/dashboard/dashboard-states";
import { requireCurrentStaff } from "@/lib/auth/staff";
import { getDashboardReportDetail } from "@/lib/dashboard/reports";

export const metadata: Metadata = { title: "Report detail" };

export default async function ReportDetailPage({
  params,
}: PageProps<"/dashboard/reports/[reportId]">) {
  // Layouts and pages can render independently, so authorize this data read at
  // the page boundary as well as in the surrounding dashboard layout.
  await requireCurrentStaff();
  const { reportId } = await params;
  const { prisma } = await import("@/lib/prisma");
  const result = await getDashboardReportDetail(reportId, prisma);

  if (!result.ok) {
    if (result.reason === "validation" || result.reason === "not_found") {
      notFound();
    }

    return (
      <DashboardDataError
        title="Report details could not be loaded"
        description={result.message}
        retryHref={`/dashboard/reports/${encodeURIComponent(reportId)}`}
      />
    );
  }

  return (
    <ReportDetailView
      report={result.report}
      statusAction={updateReportStatusAction}
    />
  );
}
