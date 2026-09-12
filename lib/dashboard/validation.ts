import { z } from "zod";

import { incidentTypes } from "@/lib/reports/validation";
import { reportStatusValues } from "@/lib/reports/status-validation";

export const DASHBOARD_DEFAULT_PAGE_SIZE = 20;
export const DASHBOARD_MAX_PAGE_SIZE = 100;
export const DASHBOARD_MAX_PAGE = 10_000;
export const DASHBOARD_MAX_STATUS_NOTE_LENGTH = 2_000;

export const dashboardReportStatusValues = reportStatusValues;
export const dashboardIncidentTypeValues = incidentTypes.map(
  ({ value }) => value,
);

export type DashboardReportStatus =
  (typeof dashboardReportStatusValues)[number];
export type DashboardIncidentType =
  (typeof incidentTypes)[number]["value"];

function emptyStringToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function isCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

const optionalIncidentDateSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .refine(isCalendarDate, "Enter a valid date in YYYY-MM-DD format.")
    .refine(
      (value) => value >= "1900-01-01",
      "Choose a date on or after January 1, 1900.",
    )
    .optional(),
);

const optionalReferenceFilterSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string({ error: "Enter a reference using text." })
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .min(1, "Enter part or all of a reference number.")
        .max(32, "Keep the reference filter to 32 characters or fewer.")
        .regex(
          /^[A-Z0-9-]+$/,
          "Use only letters, numbers, and hyphens in the reference filter.",
        ),
    )
    .optional(),
);

const optionalPositiveInteger = (defaultValue: number, maximum: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const normalized = value.trim();
      if (!normalized) return undefined;
      return /^\d+$/.test(normalized) ? Number(normalized) : value;
    },
    z
      .number({ error: "Enter a whole number." })
      .int("Enter a whole number.")
      .min(1, "Enter a number of at least 1.")
      .max(maximum, `Enter a number no greater than ${maximum}.`)
      .default(defaultValue),
  );

export const dashboardReportListInputSchema = z
  .strictObject(
    {
      status: z.preprocess(
        emptyStringToUndefined,
        z.enum(dashboardReportStatusValues, {
          error: "Choose a valid report status.",
        }).optional(),
      ),
      incidentType: z.preprocess(
        emptyStringToUndefined,
        z.enum(dashboardIncidentTypeValues, {
          error: "Choose a valid incident type.",
        }).optional(),
      ),
      from: optionalIncidentDateSchema,
      to: optionalIncidentDateSchema,
      reference: optionalReferenceFilterSchema,
      page: optionalPositiveInteger(1, DASHBOARD_MAX_PAGE),
      pageSize: optionalPositiveInteger(
        DASHBOARD_DEFAULT_PAGE_SIZE,
        DASHBOARD_MAX_PAGE_SIZE,
      ),
    },
    { error: "The report filters contain unexpected fields." },
  )
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "The end date must be on or after the start date.",
      });
    }
  });

const reportIdSchema = z
  .string({ error: "A report is required." })
  .trim()
  .min(1, "A report is required.")
  .max(128, "The report identifier is invalid.")
  .refine(
    (value) => !value.includes("\u0000"),
    "The report identifier is invalid.",
  );

export const dashboardReportIdSchema = reportIdSchema;

const statusNoteSchema = z
  .string({ error: "Enter the status note using text." })
  .trim()
  .max(
    DASHBOARD_MAX_STATUS_NOTE_LENGTH,
    `Keep the status note to ${DASHBOARD_MAX_STATUS_NOTE_LENGTH.toLocaleString("en-US")} characters or fewer.`,
  )
  .refine(
    (value) => !value.includes("\u0000"),
    "The status note contains an unsupported character. Please retype it.",
  )
  .transform((value) => value || undefined)
  .optional();

export const allowedDashboardStatusTransitions = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["ACTION_TAKEN", "DISMISSED"],
  ACTION_TAKEN: ["RESOLVED"],
  RESOLVED: [],
  DISMISSED: [],
} as const satisfies Record<
  DashboardReportStatus,
  readonly DashboardReportStatus[]
>;

export function canTransitionDashboardReportStatus(
  currentStatus: DashboardReportStatus,
  nextStatus: DashboardReportStatus,
) {
  return (allowedDashboardStatusTransitions[currentStatus] as readonly string[])
    .includes(nextStatus);
}

export const dashboardStatusUpdateInputSchema = z
  .strictObject(
    {
      reportId: reportIdSchema,
      currentStatus: z.enum(dashboardReportStatusValues, {
        error: "The current report status is invalid.",
      }),
      status: z.enum(dashboardReportStatusValues, {
        error: "Choose a valid next status.",
      }),
      note: statusNoteSchema,
    },
    { error: "The status update contains unexpected fields." },
  )
  .superRefine((value, context) => {
    if (!canTransitionDashboardReportStatus(value.currentStatus, value.status)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "That status change is not allowed.",
      });
    }
  });

export type DashboardReportListInput = z.input<
  typeof dashboardReportListInputSchema
>;
export type DashboardReportListFilters = z.output<
  typeof dashboardReportListInputSchema
>;
export type DashboardStatusUpdateInput = z.input<
  typeof dashboardStatusUpdateInputSchema
>;
export type ValidatedDashboardStatusUpdateInput = z.output<
  typeof dashboardStatusUpdateInputSchema
>;

export type DashboardReportListFieldErrors = Partial<
  Record<keyof DashboardReportListInput, string>
>;
export type DashboardStatusUpdateFieldErrors = Partial<
  Record<keyof DashboardStatusUpdateInput, string>
>;

function getFieldErrors<T extends string>(
  error: z.ZodError,
  fields: readonly T[],
) {
  const result: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && fields.includes(field as T)) {
      result[field as T] ??= issue.message;
    }
  }
  return result;
}

export function getDashboardReportListFieldErrors(error: z.ZodError) {
  return getFieldErrors(error, [
    "status",
    "incidentType",
    "from",
    "to",
    "reference",
    "page",
    "pageSize",
  ] as const);
}

export function getDashboardStatusUpdateFieldErrors(error: z.ZodError) {
  return getFieldErrors(error, [
    "reportId",
    "currentStatus",
    "status",
    "note",
  ] as const);
}
