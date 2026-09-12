import Link from "next/link";
import { ArrowUpRight, UserRound, UserRoundX } from "lucide-react";

import {
  dashboardIncidentLabels,
  dashboardStatusLabels,
  formatDashboardDate,
  formatDashboardDateTime,
  type DashboardReportStatus,
  type DashboardReportSummary,
} from "./dashboard-types";
import styles from "./dashboard.module.css";

export function StatusBadge({ status }: { status: DashboardReportStatus }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      <span className={styles.statusDot} aria-hidden="true" />
      {dashboardStatusLabels[status]}
    </span>
  );
}

export function ReporterBadge({ isAnonymous }: { isAnonymous: boolean }) {
  return (
    <span className={styles.reporterBadge}>
      {isAnonymous ? (
        <UserRoundX size={15} aria-hidden="true" />
      ) : (
        <UserRound size={15} aria-hidden="true" />
      )}
      {isAnonymous ? "Anonymous" : "Name included"}
    </span>
  );
}

export function ReportTable({
  reports,
  caption,
}: {
  reports: DashboardReportSummary[];
  caption: string;
}) {
  return (
    <div className={styles.tableFrame}>
      <table className={styles.reportTable}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Report</th>
            <th scope="col">Incident</th>
            <th scope="col">Location</th>
            <th scope="col">Received</th>
            <th scope="col">Status</th>
            <th scope="col"><span className={styles.srOnly}>Open report</span></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td data-label="Report">
                <Link
                  href={`/dashboard/reports/${encodeURIComponent(report.id)}`}
                  prefetch={false}
                  className={styles.referenceLink}
                >
                  {report.referenceNumber}
                </Link>
                <ReporterBadge isAnonymous={report.isAnonymous} />
              </td>
              <td data-label="Incident">
                <strong>{dashboardIncidentLabels[report.incidentType]}</strong>
                <span>{formatDashboardDate(report.incidentDate)}</span>
              </td>
              <td data-label="Location">{report.location}</td>
              <td data-label="Received">{formatDashboardDateTime(report.createdAt)}</td>
              <td data-label="Status"><StatusBadge status={report.status} /></td>
              <td data-label="Action">
                <Link
                  href={`/dashboard/reports/${encodeURIComponent(report.id)}`}
                  prefetch={false}
                  className={styles.openLink}
                  aria-label={`Open report ${report.referenceNumber}`}
                >
                  Open <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
