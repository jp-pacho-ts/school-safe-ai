import {
  IncidentType,
  NotificationType,
  ReportStatus,
  UserRole,
  type Prisma,
} from "../generated/prisma/client";

// These are fictional identities. In development, the staff records can enter
// the protected competition-demo dashboard with its separate shared access code.
export const demoUsers = [
  {
    id: "demo-user-teacher-1",
    email: "teacher.one@example.invalid",
    name: "Demo Teacher One",
    role: UserRole.TEACHER,
  },
  {
    id: "demo-user-teacher-2",
    email: "teacher.two@example.invalid",
    name: "Demo Teacher Two",
    role: UserRole.TEACHER,
  },
  {
    id: "demo-user-student-1",
    email: "student.one@example.invalid",
    name: "Demo Student One",
    role: UserRole.STUDENT,
  },
  {
    id: "demo-user-admin-1",
    email: "admin.one@example.invalid",
    name: "Demo Administrator",
    role: UserRole.ADMIN,
  },
].map((user) => ({
  ...user,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
})) satisfies Prisma.UserUncheckedCreateInput[];

const reportScenarios = [
  {
    id: "demo-report-submitted",
    referenceNumber: "DEMO-SUBMITTED-001",
    incidentType: IncidentType.SAFETY_CONCERN,
    description:
      "Fictional demo: a loose floor mat near the library entrance could cause someone to trip.",
    location: "Fictional demo library entrance",
    isAnonymous: true,
    reporterId: null,
    createdAt: new Date("2026-09-05T08:00:00.000Z"),
    statuses: [ReportStatus.SUBMITTED],
  },
  {
    id: "demo-report-under-review",
    referenceNumber: "DEMO-UNDER-REVIEW-001",
    incidentType: IncidentType.BULLYING,
    description:
      "Fictional demo: repeated unkind comments were heard during a lunch break, and support was requested.",
    location: "Fictional demo dining hall",
    isAnonymous: false,
    reporterId: "demo-user-student-1",
    createdAt: new Date("2026-09-04T08:00:00.000Z"),
    statuses: [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW],
  },
  {
    id: "demo-report-action-taken",
    referenceNumber: "DEMO-ACTION-TAKEN-001",
    incidentType: IncidentType.VANDALISM,
    description:
      "Fictional demo: damage to a corridor noticeboard left a sharp edge that needed to be secured.",
    location: "Fictional demo east corridor",
    isAnonymous: true,
    reporterId: null,
    createdAt: new Date("2026-09-03T08:00:00.000Z"),
    statuses: [
      ReportStatus.SUBMITTED,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.ACTION_TAKEN,
    ],
  },
  {
    id: "demo-report-resolved",
    referenceNumber: "DEMO-RESOLVED-001",
    incidentType: IncidentType.SAFETY_CONCERN,
    description:
      "Fictional demo: boxes were obstructing a classroom doorway and needed to be moved.",
    location: "Fictional demo classroom doorway",
    isAnonymous: false,
    reporterId: "demo-user-student-1",
    createdAt: new Date("2026-09-02T08:00:00.000Z"),
    statuses: [
      ReportStatus.SUBMITTED,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.ACTION_TAKEN,
      ReportStatus.RESOLVED,
    ],
  },
  {
    id: "demo-report-dismissed",
    referenceNumber: "DEMO-DISMISSED-001",
    incidentType: IncidentType.OTHER,
    description:
      "Fictional demo: a maintenance practice was reported as an unexpected disturbance and required clarification.",
    location: "Fictional demo courtyard",
    isAnonymous: true,
    reporterId: null,
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
    statuses: [
      ReportStatus.SUBMITTED,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.DISMISSED,
    ],
  },
];

const hour = 60 * 60 * 1_000;

export const demoReports = reportScenarios.map(({ statuses, ...report }) => ({
  ...report,
  incidentDate: new Date(report.createdAt.getTime() - hour),
  status: statuses[statuses.length - 1],
  updatedAt: new Date(report.createdAt.getTime() + (statuses.length - 1) * hour),
})) satisfies Prisma.ReportUncheckedCreateInput[];

const historyNotes: Record<ReportStatus, string> = {
  SUBMITTED: "Fictional demo: report received.",
  UNDER_REVIEW: "Fictional demo: a teacher began reviewing the concern.",
  ACTION_TAKEN: "Fictional demo: staff addressed the concern and arranged a follow-up check.",
  RESOLVED: "Fictional demo: a follow-up check confirmed the concern was addressed.",
  DISMISSED: "Fictional demo: review confirmed a scheduled maintenance practice; no further action was needed.",
};

export const demoStatusHistory = reportScenarios.flatMap((report, reportIndex) =>
  report.statuses.map((status, statusIndex) => ({
    id: `${report.id}-history-${statusIndex + 1}`,
    reportId: report.id,
    status,
    note: historyNotes[status],
    changedById:
      statusIndex === 0
        ? report.reporterId
        : `demo-user-teacher-${(reportIndex % 2) + 1}`,
    createdAt: new Date(report.createdAt.getTime() + statusIndex * hour),
  })),
) satisfies Prisma.ReportStatusHistoryUncheckedCreateInput[];

export const demoNotifications = [
  ...demoReports.map((report, index) => ({
    id: `${report.id}-notification-new`,
    recipientId: `demo-user-teacher-${(index % 2) + 1}`,
    reportId: report.id,
    type: NotificationType.NEW_REPORT,
    title: "Fictional demo: new report",
    message:
      "Fictional demo: a new report is available for authorized staff review.",
    readAt:
      report.status === ReportStatus.SUBMITTED
        ? null
        : new Date(report.createdAt.getTime() + hour),
    createdAt: report.createdAt,
  })),
  ...demoReports
    .filter((report) => !report.isAnonymous && report.reporterId !== null)
    .map((report) => ({
      id: `${report.id}-notification-status`,
      recipientId: report.reporterId!,
      reportId: report.id,
      type: NotificationType.STATUS_UPDATED,
      title: "Fictional demo: status updated",
      message: "Fictional demo: a report status update is available to view.",
      readAt:
        report.status === ReportStatus.RESOLVED
          ? new Date(report.updatedAt.getTime() + hour)
          : null,
      createdAt: report.updatedAt,
    })),
] satisfies Prisma.NotificationUncheckedCreateInput[];

// Call within one transaction so a failure leaves no partial fixture set.
// Stable IDs and empty updates make repeated runs preserve existing edits.
export async function seedDemoData(tx: Prisma.TransactionClient): Promise<void> {
  for (const user of demoUsers) {
    await tx.user.upsert({ where: { id: user.id }, create: user, update: {} });
  }

  for (const report of demoReports) {
    await tx.report.upsert({ where: { id: report.id }, create: report, update: {} });
  }

  for (const history of demoStatusHistory) {
    await tx.reportStatusHistory.upsert({
      where: { id: history.id },
      create: history,
      update: {},
    });
  }

  for (const notification of demoNotifications) {
    await tx.notification.upsert({
      where: { id: notification.id },
      create: notification,
      update: {},
    });
  }
}
