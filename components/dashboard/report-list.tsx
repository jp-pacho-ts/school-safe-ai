import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, SearchX } from "lucide-react";

import {
  dashboardIncidentLabels,
  dashboardIncidentTypes,
  dashboardStatusLabels,
  dashboardStatuses,
  type DashboardReportFilters,
  type DashboardReportPage,
} from "./dashboard-types";
import { DashboardEmptyState } from "./dashboard-states";
import { ReportTable } from "./report-presenters";
import styles from "./dashboard.module.css";

export type ReportFilterErrors = Partial<
  Record<"status" | "incidentType" | "from" | "to" | "reference" | "page" | "pageSize", string>
>;

function FilterError({ id, children }: { id: string; children?: string }) {
  return children ? <span id={id} className={styles.fieldError}>{children}</span> : null;
}

export function ReportFilters({
  values = {},
  errors,
}: {
  values?: DashboardReportFilters;
  errors?: ReportFilterErrors;
}) {
  return (
    <form action="/dashboard/reports" method="get" className={styles.filterPanel}>
      <div className={styles.filterHeader}>
        <div>
          <Filter size={19} aria-hidden="true" />
          <h2>Filter reports</h2>
        </div>
        <Link href="/dashboard/reports" className={styles.clearLink}>Clear filters</Link>
      </div>

      {errors && Object.keys(errors).length > 0 ? (
        <div className={styles.filterAlert} role="alert">
          Check the highlighted filters and try again.
        </div>
      ) : null}

      <div className={styles.filterGrid}>
        <label className={styles.filterField}>
          <span>Reference number</span>
          <input
            name="reference"
            type="search"
            defaultValue={values.reference ?? ""}
            maxLength={32}
            placeholder="SSA- or DEMO-"
            aria-invalid={errors?.reference ? true : undefined}
            aria-describedby={errors?.reference ? "reference-filter-error" : undefined}
          />
          <FilterError id="reference-filter-error">{errors?.reference}</FilterError>
        </label>

        <label className={styles.filterField}>
          <span>Status</span>
          <select
            name="status"
            defaultValue={values.status ?? ""}
            aria-invalid={errors?.status ? true : undefined}
            aria-describedby={errors?.status ? "status-filter-error" : undefined}
          >
            <option value="">All statuses</option>
            {dashboardStatuses.map((status) => (
              <option key={status} value={status}>{dashboardStatusLabels[status]}</option>
            ))}
          </select>
          <FilterError id="status-filter-error">{errors?.status}</FilterError>
        </label>

        <label className={styles.filterField}>
          <span>Incident type</span>
          <select
            name="incidentType"
            defaultValue={values.incidentType ?? ""}
            aria-invalid={errors?.incidentType ? true : undefined}
            aria-describedby={errors?.incidentType ? "incident-type-filter-error" : undefined}
          >
            <option value="">All incident types</option>
            {dashboardIncidentTypes.map((type) => (
              <option key={type} value={type}>{dashboardIncidentLabels[type]}</option>
            ))}
          </select>
          <FilterError id="incident-type-filter-error">{errors?.incidentType}</FilterError>
        </label>

        <label className={styles.filterField}>
          <span>Incident date from</span>
          <input
            name="from"
            type="date"
            defaultValue={values.from ?? ""}
            min="1900-01-01"
            aria-invalid={errors?.from ? true : undefined}
            aria-describedby={errors?.from ? "from-filter-error" : undefined}
          />
          <FilterError id="from-filter-error">{errors?.from}</FilterError>
        </label>

        <label className={styles.filterField}>
          <span>Incident date to</span>
          <input
            name="to"
            type="date"
            defaultValue={values.to ?? ""}
            min="1900-01-01"
            aria-invalid={errors?.to ? true : undefined}
            aria-describedby={errors?.to ? "to-filter-error" : undefined}
          />
          <FilterError id="to-filter-error">{errors?.to}</FilterError>
        </label>

        <input type="hidden" name="pageSize" value={values.pageSize ?? 20} />
        <button type="submit" className={styles.filterButton}>Apply filters</button>
      </div>
    </form>
  );
}

function buildPageHref(filters: DashboardReportFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.incidentType) params.set("incidentType", filters.incidentType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.reference) params.set("reference", filters.reference);
  if (filters.pageSize && filters.pageSize !== 20) params.set("pageSize", String(filters.pageSize));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/reports?${query}` : "/dashboard/reports";
}

export function ReportPagination({ page }: { page: DashboardReportPage }) {
  if (page.totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Report list pagination">
      {page.page > 1 ? (
        <Link href={buildPageHref(page.filters, page.page - 1)} rel="prev">
          <ChevronLeft size={17} aria-hidden="true" /> Previous
        </Link>
      ) : <span aria-disabled="true"><ChevronLeft size={17} aria-hidden="true" /> Previous</span>}
      <p>Page <strong>{page.page.toLocaleString("en")}</strong> of {page.totalPages.toLocaleString("en")}</p>
      {page.page < page.totalPages ? (
        <Link href={buildPageHref(page.filters, page.page + 1)} rel="next">
          Next <ChevronRight size={17} aria-hidden="true" />
        </Link>
      ) : <span aria-disabled="true">Next <ChevronRight size={17} aria-hidden="true" /></span>}
    </nav>
  );
}

export function ReportListView({ page }: { page: DashboardReportPage }) {
  const start = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const end = Math.min(page.page * page.pageSize, page.total);

  return (
    <>
      <ReportFilters values={page.filters} />
      <section className={styles.sectionBlock} aria-labelledby="report-results-heading">
        <div className={styles.resultsHeading}>
          <div>
            <p className={styles.sectionKicker}>REPORT QUEUE</p>
            <h2 id="report-results-heading">Matching reports</h2>
          </div>
          <p aria-live="polite">
            {page.total === 0
              ? "No reports"
              : `Showing ${start.toLocaleString("en")}-${end.toLocaleString("en")} of ${page.total.toLocaleString("en")}`}
          </p>
        </div>
        {page.reports.length > 0 ? (
          <>
            <ReportTable reports={page.reports} caption="Filtered school safety reports" />
            <ReportPagination page={page} />
          </>
        ) : (
          <DashboardEmptyState
            icon={SearchX}
            title="No reports match these filters"
            description="Clear or adjust the filters to see more of the report queue."
          />
        )}
      </section>
    </>
  );
}
