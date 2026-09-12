import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DASHBOARD_DEFAULT_PAGE_SIZE,
  DASHBOARD_MAX_PAGE,
  DASHBOARD_MAX_PAGE_SIZE,
  DASHBOARD_MAX_STATUS_NOTE_LENGTH,
  allowedDashboardStatusTransitions,
  dashboardReportIdSchema,
  dashboardReportListInputSchema,
  dashboardStatusUpdateInputSchema,
  getDashboardReportListFieldErrors,
  getDashboardStatusUpdateFieldErrors,
} from "../lib/dashboard/validation";

test("normalizes dashboard report filters and supplies bounded pagination defaults", () => {
  assert.deepEqual(dashboardReportListInputSchema.parse({}), {
    page: 1,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
  });

  assert.deepEqual(
    dashboardReportListInputSchema.parse({
      status: "",
      incidentType: "",
      from: "",
      to: "",
      reference: "  demo-under-review-001  ",
      page: "2",
      pageSize: "50",
    }),
    {
      status: undefined,
      incidentType: undefined,
      from: undefined,
      to: undefined,
      reference: "DEMO-UNDER-REVIEW-001",
      page: 2,
      pageSize: 50,
    },
  );
});

test("accepts every valid status, incident type, and inclusive incident-date range", () => {
  const statuses = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "ACTION_TAKEN",
    "RESOLVED",
    "DISMISSED",
  ];
  const incidentTypes = [
    "BULLYING",
    "CYBERBULLYING",
    "HARASSMENT",
    "VIOLENCE",
    "THEFT",
    "VANDALISM",
    "SAFETY_CONCERN",
    "OTHER",
  ];

  for (const status of statuses) {
    assert.equal(
      dashboardReportListInputSchema.parse({ status }).status,
      status,
    );
  }
  for (const incidentType of incidentTypes) {
    assert.equal(
      dashboardReportListInputSchema.parse({ incidentType }).incidentType,
      incidentType,
    );
  }
  assert.deepEqual(
    dashboardReportListInputSchema.parse({
      from: "2026-09-01",
      to: "2026-09-01",
    }),
    {
      from: "2026-09-01",
      to: "2026-09-01",
      page: 1,
      pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
    },
  );
});

test("rejects malformed, unexpected, reversed, and unbounded report filters", () => {
  const invalidInputs: unknown[] = [
    null,
    { unexpected: "value" },
    { status: "ALL" },
    { incidentType: "UNKNOWN" },
    { from: "2026-02-30" },
    { to: "1899-12-31" },
    { from: "2026-09-02", to: "2026-09-01" },
    { reference: "SSA_%" },
    { reference: "A".repeat(33) },
    { page: 0 },
    { page: 1.5 },
    { page: ["2"] },
    { page: true },
    { page: null },
    { page: DASHBOARD_MAX_PAGE + 1 },
    { pageSize: DASHBOARD_MAX_PAGE_SIZE + 1 },
  ];

  for (const input of invalidInputs) {
    assert.equal(
      dashboardReportListInputSchema.safeParse(input).success,
      false,
      `Expected invalid filters: ${JSON.stringify(input)}`,
    );
  }

  const reversed = dashboardReportListInputSchema.safeParse({
    from: "2026-09-02",
    to: "2026-09-01",
  });
  assert.equal(reversed.success, false);
  assert.ok(!reversed.success);
  assert.deepEqual(getDashboardReportListFieldErrors(reversed.error), {
    to: "The end date must be on or after the start date.",
  });
});

test("status updates permit only the documented forward transitions", () => {
  const transitions = Object.entries(allowedDashboardStatusTransitions);
  for (const [currentStatus, nextStatuses] of transitions) {
    for (const status of [
      "SUBMITTED",
      "UNDER_REVIEW",
      "ACTION_TAKEN",
      "RESOLVED",
      "DISMISSED",
    ]) {
      const parsed = dashboardStatusUpdateInputSchema.safeParse({
        reportId: "demo-report",
        currentStatus,
        status,
      });
      assert.equal(
        parsed.success,
        nextStatuses.includes(status as never),
        `${currentStatus} -> ${status}`,
      );
    }
  }
});

test("status notes are trimmed, optional, bounded, and reject PostgreSQL NUL", () => {
  const base = {
    reportId: "demo-report",
    currentStatus: "SUBMITTED",
    status: "UNDER_REVIEW",
  } as const;

  assert.equal(
    dashboardStatusUpdateInputSchema.parse({ ...base, note: "  Review started.  " })
      .note,
    "Review started.",
  );
  assert.equal(
    dashboardStatusUpdateInputSchema.parse({ ...base, note: "   " }).note,
    undefined,
  );
  assert.equal(
    dashboardStatusUpdateInputSchema.parse({
      ...base,
      note: "x".repeat(DASHBOARD_MAX_STATUS_NOTE_LENGTH),
    }).note?.length,
    DASHBOARD_MAX_STATUS_NOTE_LENGTH,
  );

  for (const note of [
    `review\u0000note`,
    "x".repeat(DASHBOARD_MAX_STATUS_NOTE_LENGTH + 1),
  ]) {
    const parsed = dashboardStatusUpdateInputSchema.safeParse({ ...base, note });
    assert.equal(parsed.success, false);
    assert.ok(!parsed.success);
    assert.ok(getDashboardStatusUpdateFieldErrors(parsed.error).note);
  }
});

test("status input rejects untrusted fields and invalid report identifiers", () => {
  const injected = dashboardStatusUpdateInputSchema.safeParse({
    reportId: "demo-report",
    currentStatus: "SUBMITTED",
    status: "UNDER_REVIEW",
    changedById: "attacker-selected-actor",
  });
  assert.equal(injected.success, false);

  for (const id of ["", `invalid\u0000id`, "x".repeat(129)]) {
    assert.equal(dashboardReportIdSchema.safeParse(id).success, false);
  }
});
