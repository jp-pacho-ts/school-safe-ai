import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  MessageSquareText,
  UserRound,
  UserRoundX,
} from "lucide-react";

import {
  dashboardIncidentLabels,
  dashboardStatusLabels,
  formatDashboardDate,
  formatDashboardDateTime,
  type DashboardHistoryEntry,
  type DashboardReportDetail,
  type StatusUpdateAction,
} from "./dashboard-types";
import { ReporterBadge, StatusBadge } from "./report-presenters";
import { StatusUpdateForm } from "./status-update-form";
import styles from "./dashboard.module.css";

function actorLabel(entry: DashboardHistoryEntry) {
  if (!entry.changedBy) {
    return entry.status === "SUBMITTED" ? "Report submission" : "System update";
  }

  const role = {
    STUDENT: "Student",
    TEACHER: "Teacher",
    ADMIN: "Administrator",
  }[entry.changedBy.role];
  return `${entry.changedBy.name} - ${role}`;
}

function StatusHistory({ history }: { history: DashboardHistoryEntry[] }) {
  return (
    <section className={styles.detailCard} aria-labelledby="status-history-heading">
      <div className={styles.cardHeading}>
        <span className={styles.cardIcon}><Clock3 size={19} aria-hidden="true" /></span>
        <div>
          <p className={styles.sectionKicker}>INTERNAL RECORD</p>
          <h2 id="status-history-heading">Status history</h2>
        </div>
      </div>
      {history.length > 0 ? (
        <ol className={styles.historyList}>
          {history.map((entry) => (
            <li key={entry.id}>
              <span className={styles.historyMarker} aria-hidden="true" />
              <div className={styles.historyContent}>
                <div className={styles.historyTopline}>
                  <StatusBadge status={entry.status} />
                  <time dateTime={entry.changedAt}>{formatDashboardDateTime(entry.changedAt)}</time>
                </div>
                <p className={styles.historyActor}>{actorLabel(entry)}</p>
                {entry.note ? (
                  <div className={styles.historyNote}>
                    <MessageSquareText size={16} aria-hidden="true" />
                    <p><strong>Internal note:</strong> {entry.note}</p>
                  </div>
                ) : (
                  <p className={styles.noNote}>No internal note was added.</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : <p className={styles.mutedCopy}>No status events have been recorded.</p>}
    </section>
  );
}

function ReporterDetails({ report }: { report: DashboardReportDetail }) {
  if (report.isAnonymous) {
    return (
      <div className={styles.reporterPrivacy}>
        <UserRoundX size={21} aria-hidden="true" />
        <div>
          <strong>Anonymous report</strong>
          <p>No reporter identity is attached to this report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reporterPrivacy}>
      <UserRound size={21} aria-hidden="true" />
      <div>
        <strong>{report.reporter?.name ?? report.reporterName ?? "Name not available"}</strong>
        {report.reporter ? <p>{report.reporter.email}</p> : null}
        {report.reporterName && !report.reporter ? (
          <p>Name supplied with the report; identity has not been verified.</p>
        ) : null}
      </div>
    </div>
  );
}

export function ReportDetailView({
  report,
  statusAction,
}: {
  report: DashboardReportDetail;
  statusAction: StatusUpdateAction;
}) {
  return (
    <>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol>
          <li><Link href="/dashboard">Overview</Link></li>
          <li><ChevronRight size={14} aria-hidden="true" /><Link href="/dashboard/reports">Reports</Link></li>
          <li aria-current="page"><ChevronRight size={14} aria-hidden="true" />Report detail</li>
        </ol>
      </nav>

      <div className={styles.detailHeading}>
        <div>
          <p className={styles.eyebrow}>REPORT DETAIL</p>
          <h1>{report.referenceNumber}</h1>
          <div className={styles.headingBadges}>
            <StatusBadge status={report.status} />
            <ReporterBadge isAnonymous={report.isAnonymous} />
          </div>
        </div>
        <Link href="/dashboard/reports" className={styles.secondaryLink}>Back to report queue</Link>
      </div>

      <div className={styles.detailLayout}>
        <div className={styles.detailPrimary}>
          <section className={styles.detailCard} aria-labelledby="incident-heading">
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon}><MessageSquareText size={19} aria-hidden="true" /></span>
              <div>
                <p className={styles.sectionKicker}>SUBMITTED CONCERN</p>
                <h2 id="incident-heading">Incident details</h2>
              </div>
            </div>
            <dl className={styles.factGrid}>
              <div>
                <dt>Incident type</dt>
                <dd>{dashboardIncidentLabels[report.incidentType]}</dd>
              </div>
              <div>
                <dt><CalendarDays size={16} aria-hidden="true" /> Incident date</dt>
                <dd>{formatDashboardDate(report.incidentDate)}</dd>
              </div>
              <div>
                <dt><MapPin size={16} aria-hidden="true" /> Location</dt>
                <dd>{report.location}</dd>
              </div>
              <div>
                <dt><Clock3 size={16} aria-hidden="true" /> Received</dt>
                <dd>{formatDashboardDateTime(report.createdAt)}</dd>
              </div>
            </dl>
            <div className={styles.descriptionBlock}>
              <h3>Description</h3>
              <p>{report.description}</p>
            </div>
          </section>

          <section className={styles.detailCard} aria-labelledby="reporter-heading">
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon}><UserRound size={19} aria-hidden="true" /></span>
              <div>
                <p className={styles.sectionKicker}>REPORTER PRIVACY</p>
                <h2 id="reporter-heading">Reporter information</h2>
              </div>
            </div>
            <ReporterDetails report={report} />
          </section>

          <StatusHistory history={report.history} />
        </div>

        <aside className={styles.detailSidebar} aria-labelledby="update-status-heading">
          <div className={styles.updateCard}>
            <p className={styles.sectionKicker}>NEXT STEP</p>
            <h2 id="update-status-heading">Update report status</h2>
            <p className={styles.currentStatusCopy}>
              Current status: <strong>{dashboardStatusLabels[report.status]}</strong>
            </p>
            <StatusUpdateForm
              reportId={report.id}
              currentStatus={report.status}
              action={statusAction}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
