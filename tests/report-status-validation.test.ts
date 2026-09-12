import assert from "node:assert/strict";
import test from "node:test";

import {
  getStatusLookupFieldError,
  publicStatusReportSchema,
  reportStatusValues,
  statusDetails,
  statusLookupInputSchema,
} from "../lib/reports/status-validation";

test("normalizes generated and fictional demo references", () => {
  const references = [
    "SSA-0123456789ABCDEF0123456789AB",
    "DEMO-SUBMITTED-001",
    "DEMO-UNDER-REVIEW-001",
    "DEMO-ACTION-TAKEN-001",
    "DEMO-RESOLVED-001",
    "DEMO-DISMISSED-001",
  ];

  for (const referenceNumber of references) {
    assert.equal(
      statusLookupInputSchema.parse({ referenceNumber: `  ${referenceNumber.toLowerCase()}  ` }).referenceNumber,
      referenceNumber,
    );
  }
});

test("rejects missing, malformed, incomplete, and unexpected lookup input", () => {
  const invalidInputs: unknown[] = [
    null,
    {},
    { referenceNumber: null },
    { referenceNumber: "" },
    { referenceNumber: "SSA-TOO-SHORT" },
    { referenceNumber: "SSA-0123456789ABCDEF0123456789AX" },
    { referenceNumber: "DEMO-UNKNOWN-001" },
    { referenceNumber: "DEMO-RESOLVED-001", status: "RESOLVED" },
  ];

  for (const input of invalidInputs) {
    assert.equal(statusLookupInputSchema.safeParse(input).success, false);
  }
});

test("lookup field errors are readable and never echo submitted values", () => {
  const privateValue = "SSA-PRIVATE-VALUE";
  const result = statusLookupInputSchema.safeParse({ referenceNumber: privateValue });
  assert.equal(result.success, false);
  if (result.success) throw new Error("Expected lookup validation to fail.");
  const message = getStatusLookupFieldError(result.error);
  assert.ok(message);
  assert.doesNotMatch(message, /PRIVATE-VALUE/);
});

test("defines presentation copy for every report status", () => {
  assert.deepEqual(Object.keys(statusDetails), [...reportStatusValues]);
  for (const status of reportStatusValues) {
    assert.ok(statusDetails[status].label.length > 0);
    assert.ok(statusDetails[status].description.length > 0);
  }
});

test("accepts the exact public response and rejects sensitive additions", () => {
  const report = {
    referenceNumber: "DEMO-UNDER-REVIEW-001",
    currentStatus: "UNDER_REVIEW",
    history: [
      { status: "SUBMITTED", changedAt: "2026-09-10T01:00:00.000Z" },
      { status: "UNDER_REVIEW", changedAt: "2026-09-11T02:00:00.000Z" },
    ],
  };
  assert.equal(publicStatusReportSchema.safeParse(report).success, true);

  for (const privateAddition of [
    { ...report, description: "private incident details" },
    { ...report, reporterName: "Private Student" },
    { ...report, submissionKey: "private-key" },
    {
      ...report,
      history: [{
        ...report.history[0],
        note: "private staff note",
      }],
    },
  ]) {
    assert.equal(publicStatusReportSchema.safeParse(privateAddition).success, false);
  }
});
