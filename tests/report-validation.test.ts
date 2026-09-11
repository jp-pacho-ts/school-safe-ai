import assert from "node:assert/strict";
import test from "node:test";

import {
  getLatestIncidentDate,
  getReportFieldErrors,
  incidentTypes,
  reportInputSchema,
  type ReportInput,
} from "../lib/reports/validation";

const validInput: ReportInput = {
  incidentType: "BULLYING",
  description: "A student repeatedly pushed another student near the entrance.",
  location: "School entrance",
  incidentDate: "2024-02-29",
  isAnonymous: true,
  submissionKey: "26b3abc7-10c8-43cf-9bfb-c0ac9c47ddce",
};

function errorsFor(changes: Record<string, unknown>) {
  const result = reportInputSchema.safeParse({ ...validInput, ...changes });
  assert.equal(result.success, false);
  if (result.success) throw new Error("Expected invalid input.");
  return getReportFieldErrors(result.error);
}

test("accepts all incident categories and normalizes public report input", () => {
  assert.equal(incidentTypes.length, 8);

  for (const incidentType of incidentTypes) {
    const result = reportInputSchema.parse({
      ...validInput,
      incidentType: incidentType.value,
      description: `  ${validInput.description}\n`,
      location: `\t${validInput.location}  `,
      submissionKey: validInput.submissionKey.toUpperCase(),
    });
    assert.equal(result.incidentType, incidentType.value);
    assert.equal(result.description, validInput.description);
    assert.equal(result.location, validInput.location);
    assert.equal(result.incidentDate, validInput.incidentDate);
    assert.equal(result.submissionKey, validInput.submissionKey);
  }
});

test("rejects missing or invalid incident types and strict boolean tampering", () => {
  for (const incidentType of [undefined, "", "bullying", "NOT_A_TYPE", 1, null]) {
    assert.match(errorsFor({ incidentType }).incidentType!, /Choose an incident type/);
  }

  for (const isAnonymous of [undefined, "true", "false", "on", 0, 1, null]) {
    assert.match(errorsFor({ isAnonymous }).isAnonymous!, /Choose whether/);
  }
});

test("enforces trimmed description and location boundaries", () => {
  for (const description of [undefined, null, 10, "", "   ", "x".repeat(9), "x".repeat(5001)]) {
    assert.ok(errorsFor({ description }).description);
  }
  for (const length of [10, 5000]) {
    assert.equal(
      reportInputSchema.parse({ ...validInput, description: `  ${"x".repeat(length)}  ` }).description.length,
      length,
    );
  }

  for (const location of [undefined, null, 10, "", " \t\n ", "x".repeat(201)]) {
    assert.ok(errorsFor({ location }).location);
  }
  for (const length of [1, 200]) {
    assert.equal(
      reportInputSchema.parse({ ...validInput, location: `  ${"x".repeat(length)}  ` }).location.length,
      length,
    );
  }
});

test("requires a name for named reports and removes supplied names from anonymous output", () => {
  for (const reporterName of [undefined, "", " \t\n "]) {
    assert.match(errorsFor({ isAnonymous: false, reporterName }).reporterName!, /Enter your name/);
  }
  for (const reporterName of [null, 42, "x".repeat(101)]) {
    assert.ok(errorsFor({ isAnonymous: false, reporterName }).reporterName);
  }

  const named = reportInputSchema.parse({ ...validInput, isAnonymous: false, reporterName: "  Demo Student  " });
  assert.equal(named.isAnonymous, false);
  assert.equal(named.reporterName, "Demo Student");
  assert.equal(
    reportInputSchema.parse({ ...validInput, isAnonymous: false, reporterName: "x".repeat(100) }).reporterName?.length,
    100,
  );

  for (const reporterName of [undefined, "", "  Demo Student  "]) {
    const anonymous = reportInputSchema.parse({ ...validInput, reporterName });
    assert.equal(anonymous.isAnonymous, true);
    assert.equal(anonymous.reporterName, undefined);
    assert.equal(JSON.stringify(anonymous).includes("Demo Student"), false);
  }
});

test("requires a valid UUID submission key", () => {
  for (const submissionKey of [undefined, null, 1, "", "not-a-uuid", "x".repeat(36), ` ${validInput.submissionKey}`]) {
    assert.match(errorsFor({ submissionKey }).submissionKey!, /submission session is invalid/);
  }
});

test("rejects missing, malformed, impossible, and too-early calendar dates", () => {
  for (const incidentDate of [undefined, null, new Date(), ""]) {
    assert.match(errorsFor({ incidentDate }).incidentDate!, /Enter the date/);
  }
  for (const incidentDate of [
    "2024-2-29", "2024-02-9", "29/02/2024", "2024-02-29T00:00:00Z",
    " 2024-02-29", "2023-02-29", "1900-02-29", "2024-04-31",
    "2024-00-01", "2024-13-01", "2024-01-00", "2024-01-32",
  ]) {
    assert.match(errorsFor({ incidentDate }).incidentDate!, /valid date/);
  }
  assert.match(errorsFor({ incidentDate: "1899-12-31" }).incidentDate!, /1900/);

  for (const incidentDate of ["1900-01-01", "2000-02-29", "2024-02-29"]) {
    assert.equal(reportInputSchema.parse({ ...validInput, incidentDate }).incidentDate, incidentDate);
  }
});

test("allows one calendar day ahead of UTC and rejects later dates", () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const latest = getLatestIncidentDate(now);
  const tooLate = new Date(`${latest}T00:00:00.000Z`);
  tooLate.setUTCDate(tooLate.getUTCDate() + 1);

  for (const incidentDate of [today, latest]) {
    assert.equal(reportInputSchema.parse({ ...validInput, incidentDate }).incidentDate, incidentDate);
  }
  assert.match(errorsFor({ incidentDate: tooLate.toISOString().slice(0, 10) }).incidentDate!, /future/);
  assert.equal(getLatestIncidentDate(new Date("2024-12-31T23:59:59Z")), "2025-01-01");
  assert.equal(getLatestIncidentDate(new Date("2024-02-28T01:00:00Z")), "2024-02-29");
});

test("rejects injected database fields instead of trusting client status or identity", () => {
  for (const injected of [
    { status: "RESOLVED" },
    { reporterId: "another-user" },
    { referenceNumber: "CHOSEN-BY-CLIENT" },
    { createdAt: "2024-01-01T00:00:00Z" },
    { unexpected: "private content" },
  ]) {
    const result = reportInputSchema.safeParse({ ...validInput, ...injected });
    assert.equal(result.success, false);
    if (result.success) throw new Error("Expected injected input to fail.");
    assert.match(result.error.issues[0].message, /unexpected fields/);
    assert.equal(result.error.issues[0].message.includes("private content"), false);
    assert.deepEqual(getReportFieldErrors(result.error), {});
  }
});

test("returns readable per-field errors without including submitted values", () => {
  const errors = errorsFor({
    description: "secret",
    location: " ",
    isAnonymous: false,
    reporterName: " ",
  });
  assert.deepEqual(Object.keys(errors).sort(), ["description", "location", "reporterName"]);
  assert.equal(JSON.stringify(errors).includes("secret"), false);
});

test("rejects NUL characters with field errors before PostgreSQL rejects the report", () => {
  const errors = errorsFor({
    description: "This description contains \u0000 private content.",
    location: "School\u0000entrance",
    isAnonymous: false,
    reporterName: "Demo\u0000Student",
  });
  assert.deepEqual(errors, {
    description: "The description contains an unsupported character. Please retype it.",
    location: "The location contains an unsupported character. Please retype it.",
    reporterName: "Your name contains an unsupported character. Please retype it.",
  });
  assert.equal(JSON.stringify(errors).includes("private content"), false);

  // Even a tampered anonymous payload must receive validation feedback, rather
  // than allowing a malformed supplied name to reach database error handling.
  assert.equal(
    errorsFor({ isAnonymous: true, reporterName: "Demo\u0000Student" }).reporterName,
    "Your name contains an unsupported character. Please retype it.",
  );
  assert.equal(
    reportInputSchema.parse({ ...validInput, reporterName: "Demo Student" }).reporterName,
    undefined,
  );
});
