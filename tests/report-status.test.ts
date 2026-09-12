import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { reportStatusValues } from "../lib/reports/status-validation";

type StatusStore = Pick<PrismaClient, "report">;
type StatusService = typeof import("../lib/reports/status");

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;
let statusService: StatusService | undefined;

before(async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Report status tests must not run in production.");
  }
  loadEnvConfig(process.cwd(), true);
  ({ prisma } = await import("../lib/prisma"));
  statusService = await import("../lib/reports/status");
});

after(async () => {
  await prisma?.$disconnect();
});

function database() {
  assert.ok(prisma, "The integration test database must be initialized.");
  return prisma;
}

function service() {
  assert.ok(statusService, "The status service must be initialized.");
  return statusService;
}

function mockDatabase(
  findUnique: (args: Prisma.ReportFindUniqueArgs) => Promise<unknown>,
): StatusStore {
  return { report: { findUnique } } as unknown as StatusStore;
}

function generatedReference() {
  return `SSA-${randomBytes(14).toString("hex").toUpperCase()}`;
}

async function withRollback(check: (tx: Prisma.TransactionClient) => Promise<void>) {
  const rollback = new Error("Status lookup test completed; roll back fixtures.");
  await assert.rejects(
    database().$transaction(async (tx) => {
      await check(tx);
      throw rollback;
    }),
    (error: unknown) => error === rollback,
  );
}

test("validates references before any database access", async () => {
  let queries = 0;
  const db = mockDatabase(async () => {
    queries += 1;
    throw new Error("Invalid input must not query the database.");
  });

  for (const input of [null, {}, { referenceNumber: "invalid" }, {
    referenceNumber: "DEMO-RESOLVED-001",
    status: "RESOLVED",
  }]) {
    const result = await service().lookupReportStatus(input, db);
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.equal(result.reason, "validation");
  }
  assert.equal(queries, 0);
});

test("uses a strict public select and strips any private values returned by a mock", async () => {
  const referenceNumber = "DEMO-RESOLVED-001";
  const db = mockDatabase(async (args) => {
    assert.deepEqual(args.where, { referenceNumber });
    assert.deepEqual(args.select, {
      referenceNumber: true,
      status: true,
      statusHistory: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { status: true, createdAt: true },
      },
    });
    assert.equal(args.include, undefined);
    return {
      referenceNumber,
      status: "RESOLVED",
      description: "Fictional private incident description",
      reporterName: "Fictional Private Student",
      submissionKey: "private-submission-key",
      statusHistory: [
        {
          status: "SUBMITTED",
          createdAt: new Date("2026-09-10T01:00:00.000Z"),
          note: "Fictional private staff note",
          changedById: "private-teacher-id",
        },
        {
          status: "RESOLVED",
          createdAt: new Date("2026-09-11T02:00:00.000Z"),
        },
      ],
    };
  });

  const result = await service().lookupReportStatus({ referenceNumber }, db);
  assert.ok(result.ok);
  assert.deepEqual(result.report, {
    referenceNumber,
    currentStatus: "RESOLVED",
    history: [
      { status: "SUBMITTED", changedAt: "2026-09-10T01:00:00.000Z" },
      { status: "RESOLVED", changedAt: "2026-09-11T02:00:00.000Z" },
    ],
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /incident description|Private Student|submission-key|staff note|teacher-id/i,
  );
});

test("supports every current status including the dismissed branch", async () => {
  for (const currentStatus of reportStatusValues) {
    const db = mockDatabase(async () => ({
      referenceNumber: "DEMO-SUBMITTED-001",
      status: currentStatus,
      statusHistory: [{ status: currentStatus, createdAt: new Date("2026-09-11T00:00:00.000Z") }],
    }));
    const result = await service().lookupReportStatus({
      referenceNumber: "DEMO-SUBMITTED-001",
    }, db);
    assert.ok(result.ok);
    assert.equal(result.report.currentStatus, currentStatus);
  }
});

test("returns a generic not-found result for an unknown valid reference", async () => {
  const referenceNumber = generatedReference();
  const result = await service().lookupReportStatus(
    { referenceNumber },
    mockDatabase(async () => null),
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.reason, "not_found");
  assert.equal(JSON.stringify(result).includes(referenceNumber), false);
});

test("masks database failures", async () => {
  const result = await service().lookupReportStatus(
    { referenceNumber: generatedReference() },
    mockDatabase(async () => {
      throw new Error("private postgresql://user:password@database-host/reports");
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.reason, "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /postgresql|password|database-host/i);
});

test("reads persisted status history chronologically without changing the report", async () => {
  await withRollback(async (tx) => {
    const referenceNumber = generatedReference();
    const report = await tx.report.create({
      data: {
        referenceNumber,
        incidentType: "SAFETY_CONCERN",
        description: "Fictional private status integration test details.",
        location: "Fictional private status test location",
        incidentDate: new Date("2026-01-15T00:00:00.000Z"),
        isAnonymous: true,
        status: "UNDER_REVIEW",
        statusHistory: {
          create: [
            { status: "UNDER_REVIEW", createdAt: new Date("2026-09-11T02:00:00.000Z"), note: "Private review note" },
            { status: "SUBMITTED", createdAt: new Date("2026-09-10T01:00:00.000Z") },
          ],
        },
      },
    });
    const updatedAt = report.updatedAt;

    const result = await service().lookupReportStatus(
      { referenceNumber: `  ${referenceNumber.toLowerCase()}  ` },
      tx,
    );
    assert.ok(result.ok);
    assert.equal(result.report.currentStatus, "UNDER_REVIEW");
    assert.deepEqual(
      result.report.history.map((entry) => entry.status),
      ["SUBMITTED", "UNDER_REVIEW"],
    );
    assert.equal(JSON.stringify(result).includes("Private review note"), false);

    const unchanged = await tx.report.findUniqueOrThrow({ where: { referenceNumber } });
    assert.equal(unchanged.status, "UNDER_REVIEW");
    assert.equal(unchanged.updatedAt.toISOString(), updatedAt.toISOString());
  });
});
