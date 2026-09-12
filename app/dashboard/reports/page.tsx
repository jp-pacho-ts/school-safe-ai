import type { Metadata } from "next";

import { DashboardDataError } from "@/components/dashboard/dashboard-states";
import {
  ReportFilters,
  ReportListView,
  type ReportFilterErrors,
} from "@/components/dashboard/report-list";
import {
  isDashboardIncidentType,
  isDashboardStatus,
  type DashboardReportFilters,
} from "@/components/dashboard/dashboard-types";
import { requireCurrentStaff } from "@/lib/auth/staff";
import { listDashboardReports } from "@/lib/dashboard/reports";
import { DASHBOARD_MAX_PAGE_SIZE } from "@/lib/dashboard/validation";
import styles from "@/components/dashboard/dashboard.module.css";

export const metadata: Metadata = { title: "Reports" };

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

function filterFormValues(raw: RawSearchParams): DashboardReportFilters {
  const status = firstValue(raw.status);
  const incidentType = firstValue(raw.incidentType);
  const pageSize = Number(firstValue(raw.pageSize));

  return {
    status: status && isDashboardStatus(status) ? status : undefined,
    incidentType: incidentType && isDashboardIncidentType(incidentType) ? incidentType : undefined,
    from: firstValue(raw.from),
    to: firstValue(raw.to),
    reference: firstValue(raw.reference),
    pageSize:
      Number.isInteger(pageSize) &&
      pageSize > 0 &&
      pageSize <= DASHBOARD_MAX_PAGE_SIZE
        ? pageSize
        : undefined,
  };
}

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reports">) {
  await requireCurrentStaff();
  const raw = await searchParams;
  const { prisma } = await import("@/lib/prisma");
  const result = await listDashboardReports(raw, prisma);

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>REPORT MANAGEMENT</p>
          <h1>Report queue</h1>
          <p>Filter concerns, open their full record, and continue the review process.</p>
        </div>
      </div>
      {!result.ok ? (
        result.reason === "validation" ? (
          <ReportFilters
            values={filterFormValues(raw)}
            errors={
              result.fieldErrors && Object.keys(result.fieldErrors).length > 0
                ? result.fieldErrors as ReportFilterErrors
                : { page: result.message }
            }
          />
        ) : (
          <DashboardDataError
            title="Reports could not be loaded"
            description={result.message}
            headingLevel="h2"
            retryHref="/dashboard/reports"
          />
        )
      ) : (
        <ReportListView page={result.page} />
      )}
    </>
  );
}
