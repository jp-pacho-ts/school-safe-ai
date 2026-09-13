import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { STATUS_UPDATED_NOTIFICATION } from "@/lib/notifications/notifications";
import {
  dashboardReportIdSchema,
  dashboardReportListInputSchema,
  dashboardStatusUpdateInputSchema,
  getDashboardReportListFieldErrors,
  getDashboardStatusUpdateFieldErrors,
  type DashboardIncidentType,
  type DashboardReportListFieldErrors,
  type DashboardReportListFilters,
  type DashboardReportStatus,
  type DashboardStatusUpdateFieldErrors,
} from "./validation";

export const DASHBOARD_RECENT_REPORT_LIMIT = 5;

export type DashboardReadStore = Pick<PrismaClient, "report">;
export type DashboardWriteStore = Pick<PrismaClient, "$transaction">;

export interface DashboardReportSummary {
  id: string;
  referenceNumber: string;
  incidentType: DashboardIncidentType;
  location: string;
  status: DashboardReportStatus;
  isAnonymous: boolean;
  incidentDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  total: number;
  submitted: number;
  underReview: number;
  actionTaken: number;
  resolved: number;
  dismissed: number;
}

export interface DashboardOverview {
  metrics: DashboardMetrics;
  recentReports: DashboardReportSummary[];
}

export interface DashboardReportHistoryEntry {
  id: string;
  status: DashboardReportStatus;
  note: string | null;
  changedAt: string;
  changedBy: {
    id: string;
    name: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
  } | null;
}

export interface DashboardReportDetail extends DashboardReportSummary {
  description: string;
  reporterName: string | null;
  reporter: {
    id: string;
    name: string;
    email: string;
  } | null;
  history: DashboardReportHistoryEntry[];
}

export interface DashboardReportPage {
  reports: DashboardReportSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: DashboardReportListFilters;
}

export type DashboardOverviewResult =
  | { ok: true; overview: DashboardOverview }
  | { ok: false; reason: "unavailable"; message: string };

export type DashboardReportListResult =
  | { ok: true; page: DashboardReportPage }
  | {
      ok: false;
      reason: "validation" | "unavailable";
      message: string;
      fieldErrors?: DashboardReportListFieldErrors;
    };

export type DashboardReportDetailResult =
  | { ok: true; report: DashboardReportDetail }
  | {
      ok: false;
      reason: "validation" | "not_found" | "unavailable";
      message: string;
    };

export type DashboardStatusUpdateResult =
  | {
      ok: true;
      change: {
        reportId: string;
        status: DashboardReportStatus;
        historyEntry: DashboardReportHistoryEntry;
      };
    }
  | {
      ok: false;
      reason: "validation" | "not_found" | "conflict" | "unavailable";
      message: string;
      fieldErrors?: DashboardStatusUpdateFieldErrors;
    };

const dashboardReportSummarySelect = {
  id: true,
  referenceNumber: true,
  incidentType: true,
  location: true,
  status: true,
  isAnonymous: true,
  incidentDate: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ReportSelect;

const dashboardReportDetailSelect = {
  ...dashboardReportSummarySelect,
  description: true,
  reporterName: true,
  reporter: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      changedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  },
} as const satisfies Prisma.ReportSelect;

const dashboardHistoryEntrySelect = {
  id: true,
  status: true,
  note: true,
  createdAt: true,
  changedBy: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} as const satisfies Prisma.ReportStatusHistorySelect;

type DashboardReportSummaryRecord = Prisma.ReportGetPayload<{
  select: typeof dashboardReportSummarySelect;
}>;
type DashboardReportDetailRecord = Prisma.ReportGetPayload<{
  select: typeof dashboardReportDetailSelect;
}>;
type DashboardHistoryEntryRecord = Prisma.ReportStatusHistoryGetPayload<{
  select: typeof dashboardHistoryEntrySelect;
}>;

function toDashboardReportSummary(
  report: DashboardReportSummaryRecord,
): DashboardReportSummary {
  return {
    id: report.id,
    referenceNumber: report.referenceNumber,
    incidentType: report.incidentType,
    location: report.location,
    status: report.status,
    isAnonymous: report.isAnonymous,
    incidentDate: report.incidentDate.toISOString(),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

function toDashboardHistoryEntry(
  entry: DashboardHistoryEntryRecord,
): DashboardReportHistoryEntry {
  return {
    id: entry.id,
    status: entry.status,
    note: entry.note,
    changedAt: entry.createdAt.toISOString(),
    changedBy: entry.changedBy
      ? {
          id: entry.changedBy.id,
          name: entry.changedBy.name,
          role: entry.changedBy.role,
        }
      : null,
  };
}

function toDashboardReportDetail(
  report: DashboardReportDetailRecord,
): DashboardReportDetail {
  // Preserve anonymous reporting even if a future import contains inconsistent
  // identity values. Authorized staff receive identity only for named reports.
  const reporterName = report.isAnonymous ? null : report.reporterName;
  const reporter = report.isAnonymous ? null : report.reporter;

  return {
    ...toDashboardReportSummary(report),
    description: report.description,
    reporterName,
    reporter: reporter
      ? { id: reporter.id, name: reporter.name, email: reporter.email }
      : null,
    history: report.statusHistory.map(toDashboardHistoryEntry),
  };
}

function emptyMetrics(): DashboardMetrics {
  return {
    total: 0,
    submitted: 0,
    underReview: 0,
    actionTaken: 0,
    resolved: 0,
    dismissed: 0,
  };
}

export async function getDashboardOverview(
  db: DashboardReadStore,
): Promise<DashboardOverviewResult> {
  try {
    const [statusCounts, recentReports] = await Promise.all([
      db.report.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      db.report.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: DASHBOARD_RECENT_REPORT_LIMIT,
        select: dashboardReportSummarySelect,
      }),
    ]);

    const metrics = emptyMetrics();
    for (const row of statusCounts) {
      metrics.total += row._count._all;
      switch (row.status) {
        case "SUBMITTED":
          metrics.submitted = row._count._all;
          break;
        case "UNDER_REVIEW":
          metrics.underReview = row._count._all;
          break;
        case "ACTION_TAKEN":
          metrics.actionTaken = row._count._all;
          break;
        case "RESOLVED":
          metrics.resolved = row._count._all;
          break;
        case "DISMISSED":
          metrics.dismissed = row._count._all;
          break;
      }
    }

    return {
      ok: true,
      overview: {
        metrics,
        recentReports: recentReports.map(toDashboardReportSummary),
      },
    };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Dashboard data is temporarily unavailable. Please try again.",
    };
  }
}

function createReportWhere(
  filters: DashboardReportListFilters,
): Prisma.ReportWhereInput {
  const where: Prisma.ReportWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.incidentType) where.incidentType = filters.incidentType;
  if (filters.reference) {
    where.referenceNumber = {
      contains: filters.reference,
      mode: "insensitive",
    };
  }
  if (filters.from || filters.to) {
    where.incidentDate = {
      ...(filters.from
        ? { gte: new Date(`${filters.from}T00:00:00.000Z`) }
        : {}),
      ...(filters.to
        ? { lte: new Date(`${filters.to}T00:00:00.000Z`) }
        : {}),
    };
  }

  return where;
}

export async function listDashboardReports(
  raw: unknown,
  db: DashboardReadStore,
): Promise<DashboardReportListResult> {
  const parsed = dashboardReportListInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: "Check the report filters and try again.",
      fieldErrors: getDashboardReportListFieldErrors(parsed.error),
    };
  }

  const filters = parsed.data;
  const where = createReportWhere(filters);
  const skip = (filters.page - 1) * filters.pageSize;

  try {
    const [total, reports] = await Promise.all([
      db.report.count({ where }),
      db.report.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: filters.pageSize,
        select: dashboardReportSummarySelect,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
    let effectivePage = filters.page;
    let effectiveReports = reports;

    // A bookmarked page can become stale after filters change or reports are
    // removed. Clamp it to a real page so staff are not trapped in a false
    // "no matches" state with no pagination controls.
    if (filters.page > totalPages) {
      effectivePage = totalPages;
      effectiveReports = total > 0
        ? await db.report.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (effectivePage - 1) * filters.pageSize,
            take: filters.pageSize,
            select: dashboardReportSummarySelect,
          })
        : [];
    }

    return {
      ok: true,
      page: {
        reports: effectiveReports.map(toDashboardReportSummary),
        total,
        page: effectivePage,
        pageSize: filters.pageSize,
        totalPages,
        filters: { ...filters, page: effectivePage },
      },
    };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Reports are temporarily unavailable. Please try again.",
    };
  }
}

export async function getDashboardReportDetail(
  rawReportId: unknown,
  db: DashboardReadStore,
): Promise<DashboardReportDetailResult> {
  const parsed = dashboardReportIdSchema.safeParse(rawReportId);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: "The requested report is invalid.",
    };
  }

  try {
    const report = await db.report.findUnique({
      where: { id: parsed.data },
      select: dashboardReportDetailSelect,
    });
    if (!report) {
      return {
        ok: false,
        reason: "not_found",
        message: "Report not found.",
      };
    }
    return { ok: true, report: toDashboardReportDetail(report) };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "This report is temporarily unavailable. Please try again.",
    };
  }
}

type TransactionStatusUpdateResult =
  | { outcome: "updated"; historyEntry: DashboardHistoryEntryRecord }
  | { outcome: "not_found" }
  | { outcome: "conflict" };

function validTrustedActorId(actorId: unknown): actorId is string {
  return (
    typeof actorId === "string" &&
    actorId.length > 0 &&
    actorId.length <= 128 &&
    !actorId.includes("\u0000")
  );
}

export async function updateDashboardReportStatus(
  raw: unknown,
  trustedActorId: string,
  db: DashboardWriteStore,
): Promise<DashboardStatusUpdateResult> {
  const parsed = dashboardStatusUpdateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: "Check the status update and try again.",
      fieldErrors: getDashboardStatusUpdateFieldErrors(parsed.error),
    };
  }
  if (!validTrustedActorId(trustedActorId)) {
    return {
      ok: false,
      reason: "unavailable",
      message: "The status could not be updated. Please try again.",
    };
  }

  const input = parsed.data;
  try {
    const result = await db.$transaction(
      async (tx): Promise<TransactionStatusUpdateResult> => {
        const existing = await tx.report.findUnique({
          where: { id: input.reportId },
          select: {
            id: true,
            status: true,
            isAnonymous: true,
            reporterId: true,
          },
        });
        if (!existing) return { outcome: "not_found" };
        if (existing.status !== input.currentStatus) {
          return { outcome: "conflict" };
        }

        // The status predicate is the optimistic concurrency guard. If another
        // reviewer changes the report after the read, this update affects zero
        // rows and no history entry is committed.
        const updated = await tx.report.updateMany({
          where: { id: input.reportId, status: input.currentStatus },
          data: { status: input.status },
        });
        if (updated.count !== 1) return { outcome: "conflict" };

        const historyEntry = await tx.reportStatusHistory.create({
          data: {
            reportId: input.reportId,
            status: input.status,
            note: input.note ?? null,
            changedById: trustedActorId,
          },
          select: dashboardHistoryEntrySelect,
        });
        if (!existing.isAnonymous && existing.reporterId) {
          await tx.notification.create({
            data: {
              recipientId: existing.reporterId,
              reportId: input.reportId,
              ...STATUS_UPDATED_NOTIFICATION,
            },
            select: { id: true },
          });
        }
        return { outcome: "updated", historyEntry };
      },
    );

    if (result.outcome === "not_found") {
      return {
        ok: false,
        reason: "not_found",
        message: "Report not found.",
      };
    }
    if (result.outcome === "conflict") {
      return {
        ok: false,
        reason: "conflict",
        message: "This report changed since you opened it. Refresh and try again.",
      };
    }

    return {
      ok: true,
      change: {
        reportId: input.reportId,
        status: input.status,
        historyEntry: toDashboardHistoryEntry(result.historyEntry),
      },
    };
  } catch {
    // Do not expose database, actor, report, or note details.
    return {
      ok: false,
      reason: "unavailable",
      message: "The status could not be updated. Please try again.",
    };
  }
}
