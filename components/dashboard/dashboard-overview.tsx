import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  CircleCheck,
  ClipboardList,
  Eye,
  Inbox,
  XCircle,
} from "lucide-react";

import type { DashboardMetrics, DashboardReportSummary } from "./dashboard-types";
import { DashboardEmptyState } from "./dashboard-states";
import { ReportTable } from "./report-presenters";
import styles from "./dashboard.module.css";

const metricDefinitions = [
  { key: "total", label: "Total reports", hint: "All recorded reports", icon: ClipboardList },
  { key: "submitted", label: "Submitted", hint: "Waiting for review", icon: Inbox },
  { key: "underReview", label: "Under review", hint: "Being assessed", icon: Eye },
  { key: "actionTaken", label: "Action taken", hint: "Follow-up recorded", icon: CheckCheck },
  { key: "resolved", label: "Resolved", hint: "Review complete", icon: CircleCheck },
  { key: "dismissed", label: "Dismissed", hint: "Closed after review", icon: XCircle },
] as const;

export function DashboardOverview({
  metrics,
  recentReports,
}: {
  metrics: DashboardMetrics;
  recentReports: DashboardReportSummary[];
}) {
  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>OVERVIEW</p>
          <h1>School safety dashboard</h1>
          <p>Review incoming concerns and follow each report through its next steps.</p>
        </div>
        <Link href="/dashboard/reports" className={styles.primaryLink}>
          View all reports <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      <section aria-labelledby="report-metrics-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>REPORT SNAPSHOT</p>
            <h2 id="report-metrics-heading">Current report totals</h2>
          </div>
          <p>Counts include fictional competition data only.</p>
        </div>
        <dl className={styles.metricGrid}>
          {metricDefinitions.map(({ key, label, hint, icon: Icon }) => (
            <div key={key} className={styles.metricCard} data-metric={key}>
              <div className={styles.metricTopline}>
                <dt>{label}</dt>
                <span className={styles.metricIcon}><Icon size={20} aria-hidden="true" /></span>
              </div>
              <dd>{metrics[key].toLocaleString("en")}</dd>
              <p>{hint}</p>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="recent-reports-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>LATEST ACTIVITY</p>
            <h2 id="recent-reports-heading">Recent reports</h2>
          </div>
          <Link href="/dashboard/reports" className={styles.secondaryLink}>
            Browse report queue <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {recentReports.length > 0 ? (
          <ReportTable reports={recentReports} caption="Most recently submitted reports" />
        ) : (
          <DashboardEmptyState
            title="No reports yet"
            description="New reports will appear here after students submit them."
          />
        )}
      </section>
    </>
  );
}
