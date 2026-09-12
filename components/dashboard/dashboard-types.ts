export const dashboardStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_TAKEN",
  "RESOLVED",
  "DISMISSED",
] as const;

export type DashboardReportStatus = (typeof dashboardStatuses)[number];

export const dashboardIncidentTypes = [
  "BULLYING",
  "CYBERBULLYING",
  "HARASSMENT",
  "VIOLENCE",
  "THEFT",
  "VANDALISM",
  "SAFETY_CONCERN",
  "OTHER",
] as const;

export type DashboardIncidentType = (typeof dashboardIncidentTypes)[number];

export const dashboardStatusLabels: Record<DashboardReportStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ACTION_TAKEN: "Action taken",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

export const dashboardIncidentLabels: Record<DashboardIncidentType, string> = {
  BULLYING: "Bullying",
  CYBERBULLYING: "Cyberbullying",
  HARASSMENT: "Harassment",
  VIOLENCE: "Violence",
  THEFT: "Theft",
  VANDALISM: "Vandalism",
  SAFETY_CONCERN: "Safety concern",
  OTHER: "Other",
};

export interface DashboardMetrics {
  total: number;
  submitted: number;
  underReview: number;
  actionTaken: number;
  resolved: number;
  dismissed: number;
}

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

export interface DashboardHistoryActor {
  id: string;
  name: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
}

export interface DashboardHistoryEntry {
  id: string;
  status: DashboardReportStatus;
  note: string | null;
  changedAt: string;
  changedBy: DashboardHistoryActor | null;
}

export interface DashboardReportDetail extends DashboardReportSummary {
  description: string;
  reporterName: string | null;
  reporter: {
    id: string;
    name: string;
    email: string;
  } | null;
  history: DashboardHistoryEntry[];
}

export interface DashboardReportFilters {
  status?: DashboardReportStatus;
  incidentType?: DashboardIncidentType;
  from?: string;
  to?: string;
  reference?: string;
  page?: number;
  pageSize?: number;
}

export interface DashboardReportPage {
  reports: DashboardReportSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: DashboardReportFilters;
}

export type StatusUpdateField = "status" | "note" | "form";

export interface StatusUpdateFormState {
  outcome: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<StatusUpdateField, string>>;
}

export type StatusUpdateAction = (
  previousState: StatusUpdateFormState,
  formData: FormData,
) => Promise<StatusUpdateFormState>;

export function isDashboardStatus(value: string): value is DashboardReportStatus {
  return dashboardStatuses.includes(value as DashboardReportStatus);
}

export function isDashboardIncidentType(value: string): value is DashboardIncidentType {
  return dashboardIncidentTypes.includes(value as DashboardIncidentType);
}

export function formatDashboardDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function formatDashboardDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";

  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
  return `${formatted} UTC`;
}

export function getAllowedDashboardStatuses(
  currentStatus: DashboardReportStatus,
): DashboardReportStatus[] {
  const transitions: Record<DashboardReportStatus, DashboardReportStatus[]> = {
    SUBMITTED: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["ACTION_TAKEN", "DISMISSED"],
    ACTION_TAKEN: ["RESOLVED"],
    RESOLVED: [],
    DISMISSED: [],
  };

  return transitions[currentStatus];
}
