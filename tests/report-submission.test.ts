import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { ReportInput } from "../lib/reports/validation";

type ReportDatabase = Pick<PrismaClient, "report" | "user">;
type ReportingService = typeof import("../lib/reports/submit");

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;
let reporting: ReportingService | undefined;

function refuseProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Report submission tests must not run in production.");
  }
}

before(async () => {
  refuseProduction();
  loadEnvConfig(process.cwd(), true);
  refuseProduction();
  // npm test supplies --conditions=react-server for the server-only modules.
  ({ prisma } = await import("../lib/prisma"));
  reporting = await import("../lib/reports/submit");
});

after(async () => {
  await prisma?.$disconnect();
});

function database() {
  assert.ok(prisma, "The integration test database must be initialized.");
  return prisma;
}

function service() {
  assert.ok(reporting, "The reporting service must be initialized.");
  return reporting;
}

function reportInput(): ReportInput {
  return {
    incidentType: "SAFETY_CONCERN",
    description: "Fictional submission test: a hallway light needs attention.",
    location: "Fictional test hallway",
    incidentDate: "2026-01-15",
    isAnonymous: true,
    submissionKey: randomUUID(),
  };
}

// Every successful fixture is rolled back, including on an assertion failure.
async function withRollback(
  check: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const rollback = new Error("Submission test completed; roll back fixtures.");
  await assert.rejects(
    database().$transaction(async (tx) => {
      await check(tx);
      throw rollback;
    }),
    (error: unknown) => error === rollback,
  );
}

async function expectDatabaseRejection(
  action: (tx: Prisma.TransactionClient) => Promise<unknown>,
  check: (error: unknown) => boolean,
) {
  const unexpectedSuccess = new Error("Expected a database constraint rejection.");
  await assert.rejects(
    database().$transaction(async (tx) => {
      await action(tx);
      // Even a regressed constraint must never commit the test fixture.
      throw unexpectedSuccess;
    }),
    (error: unknown) => {
      assert.notEqual(error, unexpectedSuccess);
      return check(error);
    },
  );
}

function mockDatabase(handlers: {
  findUnique?: (args: Prisma.ReportFindUniqueArgs) => Promise<unknown>;
  create?: (args: Prisma.ReportCreateArgs) => Promise<unknown>;
  findStaff?: (args: Prisma.UserFindManyArgs) => Promise<unknown>;
}): ReportDatabase {
  const unexpectedQuery = async () => {
    throw new Error("Unexpected database query in this test.");
  };

  // Prisma delegates have generic overloads. Keep the cast at this mock boundary.
  return {
    report: {
      findUnique: handlers.findUnique ?? unexpectedQuery,
      create: handlers.create ?? unexpectedQuery,
    },
    user: {
      findMany: handlers.findStaff ?? (async () => []),
    },
  } as unknown as ReportDatabase;
}

function uniqueError(field: "referenceNumber" | "submissionKey") {
  return new Prisma.PrismaClientKnownRequestError(
    "Fictional private database details: duplicate value.",
    { code: "P2002", clientVersion: "test", meta: { target: [field] } },
  );
}

function assertUnavailable(result: Awaited<ReturnType<ReportingService["submitReport"]>>) {
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.reason, "unavailable");
  assert.ok(result.message.length > 0);
  assert.doesNotMatch(
    JSON.stringify(result),
    /fictional private|postgresql:|password|P2002|P2003|database-host/i,
  );
}

test("generates distinct references in the public reference format", () => {
  const references = Array.from({ length: 100 }, () => service().generateReportReference());
  for (const reference of references) {
    assert.match(reference, /^SSA-[A-F0-9]{28}$/);
  }
  assert.equal(new Set(references).size, references.length);
});

test("rejects invalid and privileged input before any database access", async () => {
  let queries = 0;
  const forbiddenQuery = async () => {
    queries += 1;
    throw new Error("Validation must finish before database access.");
  };
  const db = mockDatabase({ findUnique: forbiddenQuery, create: forbiddenQuery });
  const input = reportInput();
  const invalidInputs: unknown[] = [
    null,
    { ...input, description: " " },
    { ...input, submissionKey: "invalid-session" },
    { ...input, isAnonymous: "true" },
    { ...input, isAnonymous: false, reporterName: "" },
    { ...input, status: "RESOLVED" },
    { ...input, reporterId: randomUUID() },
    { ...input, referenceNumber: "SSA-ATTACKER-CONTROLLED" },
    { ...input, statusHistory: { create: { status: "RESOLVED" } } },
  ];

  for (const invalid of invalidInputs) {
    const result = await service().submitReport(invalid, db);
    assert.ok(!result.ok);
    assert.equal(result.reason, "validation");
  }
  assert.equal(queries, 0);
});

test("stores an anonymous report and its initial history without a name or account", async () => {
  await withRollback(async (tx) => {
    const input = {
      ...reportInput(),
      description: "  Fictional submission test: a hallway light needs attention.  ",
      location: "  Fictional test hallway  ",
      reporterName: "This supplied name must be discarded",
    };
    const staffRecipients = [
      {
        id: randomUUID(),
        email: `submission-teacher-${randomUUID()}@example.invalid`,
        name: "Fictional Submission Teacher",
        role: "TEACHER" as const,
      },
      {
        id: randomUUID(),
        email: `submission-admin-${randomUUID()}@example.invalid`,
        name: "Fictional Submission Administrator",
        role: "ADMIN" as const,
      },
    ];
    await tx.user.createMany({ data: staffRecipients });
    const userCount = await tx.user.count();
    const db = mockDatabase({
      findUnique: (args) => tx.report.findUnique(args),
      create: (args) => tx.report.create(args),
      findStaff: async (args) => {
        assert.deepEqual(args, {
          where: { role: { in: ["TEACHER", "ADMIN"] } },
          select: { id: true },
        });
        return staffRecipients.map(({ id }) => ({ id }));
      },
    });
    const result = await service().submitReport(input, db);
    assert.ok(result.ok);
    assert.equal(result.replayed, false);
    assert.equal(result.submissionKey, input.submissionKey);
    assert.match(result.referenceNumber, /^SSA-[A-F0-9]{28}$/);

    const report = await tx.report.findUniqueOrThrow({
      where: { submissionKey: input.submissionKey },
    });
    assert.equal(report.referenceNumber, result.referenceNumber);
    assert.equal(report.incidentType, input.incidentType);
    assert.equal(report.description, input.description.trim());
    assert.equal(report.location, input.location.trim());
    assert.equal(report.incidentDate.toISOString(), "2026-01-15T00:00:00.000Z");
    assert.equal(report.isAnonymous, true);
    assert.equal(report.reporterName, null);
    assert.equal(report.reporterId, null);
    assert.equal(report.status, "SUBMITTED");

    const history = await tx.reportStatusHistory.findMany({ where: { reportId: report.id } });
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "SUBMITTED");
    assert.equal(history[0].note, null);
    assert.equal(history[0].changedById, null);
    assert.ok(history[0].createdAt instanceof Date);
    assert.equal(await tx.user.count(), userCount);
    const notifications = await tx.notification.findMany({
      where: { reportId: report.id },
      orderBy: { recipientId: "asc" },
    });
    assert.deepEqual(
      notifications.map(({ recipientId }) => recipientId),
      staffRecipients.map(({ id }) => id).sort(),
    );
    for (const notification of notifications) {
      assert.equal(notification.type, "NEW_REPORT");
      assert.equal(notification.title, "New safety report");
      assert.equal(
        notification.message,
        "A new report is ready for authorized staff review.",
      );
      assert.equal(notification.readAt, null);
      assert.doesNotMatch(
        `${notification.title} ${notification.message}`,
        /hallway light|fictional test hallway/i,
      );
    }
  });
});

test("stores a self-provided name on a named report without creating or linking an account", async () => {
  await withRollback(async (tx) => {
    const input = {
      ...reportInput(),
      isAnonymous: false,
      reporterName: "  Fictional Test Student  ",
    };
    const userCount = await tx.user.count();
    const result = await service().submitReport(input, tx);
    assert.ok(result.ok);
    const report = await tx.report.findUniqueOrThrow({
      where: { referenceNumber: result.referenceNumber },
    });
    assert.equal(report.isAnonymous, false);
    assert.equal(report.reporterName, "Fictional Test Student");
    assert.equal(report.reporterId, null);
    assert.equal(await tx.user.count(), userCount);
    const history = await tx.reportStatusHistory.findMany({ where: { reportId: report.id } });
    assert.equal(history.length, 1);
    assert.equal(history[0].changedById, null);
    assert.equal(history[0].status, "SUBMITTED");
  });
});

test("replaying normalized details returns the same reference without another report or history", async () => {
  await withRollback(async (tx) => {
    const input = {
      ...reportInput(),
      isAnonymous: false,
      reporterName: "  Fictional Test Student  ",
      location: "  Fictional test hallway  ",
    };
    const first = await service().submitReport(input, tx);
    assert.ok(first.ok);
    const notificationCountAfterFirst = await tx.notification.count({
      where: { report: { submissionKey: input.submissionKey } },
    });
    const replay = await service().submitReport({
      ...input,
      submissionKey: input.submissionKey.toUpperCase(),
      reporterName: input.reporterName.trim(),
      location: input.location.trim(),
    }, tx);
    assert.ok(replay.ok);
    assert.equal(replay.replayed, true);
    assert.equal(replay.referenceNumber, first.referenceNumber);
    assert.equal(replay.submissionKey, input.submissionKey);
    assert.equal(await tx.report.count({ where: { submissionKey: input.submissionKey } }), 1);
    const report = await tx.report.findUniqueOrThrow({
      where: { submissionKey: input.submissionKey },
    });
    assert.equal(await tx.reportStatusHistory.count({ where: { reportId: report.id } }), 1);
    assert.equal(
      await tx.notification.count({ where: { reportId: report.id } }),
      notificationCountAfterFirst,
    );
  });
});

test("a reused submission key with changed details preserves the first report", async () => {
  await withRollback(async (tx) => {
    const input = reportInput();
    const first = await service().submitReport(input, tx);
    assert.ok(first.ok);
    const changes: Partial<ReportInput>[] = [
      { incidentType: "BULLYING" },
      { description: "Fictional submission test: details of a different incident." },
      { location: "Different fictional hallway" },
      { incidentDate: "2026-01-14" },
      { isAnonymous: false, reporterName: "Fictional Test Student" },
    ];
    for (const change of changes) {
      const result = await service().submitReport({ ...input, ...change }, tx);
      assert.ok(!result.ok);
      assert.equal(result.reason, "conflict");
    }
    const report = await tx.report.findUniqueOrThrow({
      where: { submissionKey: input.submissionKey },
    });
    assert.equal(report.referenceNumber, first.referenceNumber);
    assert.equal(report.description, input.description);
    assert.equal(report.location, input.location);
    assert.equal(report.incidentType, input.incidentType);
    assert.equal(report.isAnonymous, true);
    assert.equal(report.reporterName, null);
    assert.equal(await tx.reportStatusHistory.count({ where: { reportId: report.id } }), 1);
  });
});

test("retries reference collisions and persists only the successful attempt", async () => {
  await withRollback(async (tx) => {
    let attempts = 0;
    const references: unknown[] = [];
    const db = mockDatabase({
      findUnique: (args) => tx.report.findUnique(args),
      create: async (args) => {
        attempts += 1;
        references.push(args.data.referenceNumber);
        // Simulated failures avoid aborting the real rollback transaction.
        if (attempts < 3) throw uniqueError("referenceNumber");
        return tx.report.create(args);
      },
    });
    const input = reportInput();
    const result = await service().submitReport(input, db);
    assert.ok(result.ok);
    assert.equal(attempts, 3);
    assert.equal(new Set(references).size, 3);
    const report = await tx.report.findUniqueOrThrow({
      where: { submissionKey: input.submissionKey },
    });
    assert.equal(report.referenceNumber, result.referenceNumber);
    assert.equal(await tx.reportStatusHistory.count({ where: { reportId: report.id } }), 1);
  });
});

test("resolves a submission-key race to the existing receipt", async () => {
  await withRollback(async (tx) => {
    let attempts = 0;
    const db = mockDatabase({
      findUnique: (args) => tx.report.findUnique(args),
      create: async (args) => {
        attempts += 1;
        // Simulate the competing request winning between lookup and create.
        // A real unique violation would abort this test's surrounding transaction.
        await tx.report.create(args);
        throw uniqueError("submissionKey");
      },
    });
    const input = reportInput();
    const result = await service().submitReport(input, db);
    assert.ok(result.ok);
    assert.equal(result.replayed, true);
    assert.equal(attempts, 1);
    assert.equal(await tx.report.count({ where: { submissionKey: input.submissionKey } }), 1);
    const report = await tx.report.findUniqueOrThrow({
      where: { submissionKey: input.submissionKey },
    });
    assert.equal(result.referenceNumber, report.referenceNumber);
    assert.equal(await tx.reportStatusHistory.count({ where: { reportId: report.id } }), 1);
  });
});

test("bounds collision retries and hides internal database details", async () => {
  let attempts = 0;
  const db = mockDatabase({
    findUnique: async () => null,
    create: async () => {
      attempts += 1;
      throw uniqueError("referenceNumber");
    },
  });
  assertUnavailable(await service().submitReport(reportInput(), db));
  assert.equal(attempts, 3);
});

test("masks database lookup and write failures", async () => {
  const privateFailure = new Error(
    "Fictional private postgresql://user:password@database-host/reporting",
  );
  const failingLookup = mockDatabase({
    findUnique: async () => { throw privateFailure; },
  });
  assertUnavailable(await service().submitReport(reportInput(), failingLookup));

  const failingWrite = mockDatabase({
    findUnique: async () => null,
    create: async () => { throw privateFailure; },
  });
  assertUnavailable(await service().submitReport(reportInput(), failingWrite));

  const failingRecipientLookup = mockDatabase({
    findUnique: async () => null,
    findStaff: async () => { throw privateFailure; },
  });
  assertUnavailable(await service().submitReport(reportInput(), failingRecipientLookup));
});

test("a failed initial history insert leaves no partially saved report", async () => {
  const input = reportInput();
  const reportId = randomUUID();
  const db = mockDatabase({
    findUnique: (args) => database().report.findUnique(args),
    create: (args) => database().report.create({
      ...args,
      data: {
        ...args.data,
        id: reportId,
        statusHistory: {
          create: { status: "SUBMITTED", changedById: randomUUID() },
        },
      },
    }),
  });
  try {
    // Let the nested write manage its own transaction so an outer test rollback
    // cannot conceal a partial commit. The deliberately invalid actor must fail.
    assertUnavailable(await service().submitReport(input, db));
    assert.equal(await database().report.findUnique({ where: { id: reportId } }), null);
    assert.equal(await database().reportStatusHistory.count({ where: { reportId } }), 0);
  } finally {
    // Clean only this test's random fixture if atomicity ever regresses.
    await database().report.deleteMany({
      where: { id: reportId, submissionKey: input.submissionKey },
    });
  }
});

test("a failed nested notification insert leaves no report or history", async () => {
  const input = reportInput();
  const reportId = randomUUID();
  const missingRecipientId = randomUUID();
  const db = mockDatabase({
    findUnique: (args) => database().report.findUnique(args),
    findStaff: async () => [{ id: missingRecipientId }],
    create: (args) => database().report.create({
      ...args,
      data: { ...args.data, id: reportId },
    }),
  });
  try {
    assertUnavailable(await service().submitReport(input, db));
    assert.equal(await database().report.findUnique({ where: { id: reportId } }), null);
    assert.equal(await database().reportStatusHistory.count({ where: { reportId } }), 0);
    assert.equal(await database().notification.count({ where: { reportId } }), 0);
  } finally {
    await database().report.deleteMany({
      where: { id: reportId, submissionKey: input.submissionKey },
    });
  }
});

test("the database rejects a name on an anonymous report", async () => {
  const input = reportInput();
  await expectDatabaseRejection(
    (tx) => tx.report.create({
      data: {
        ...input,
        incidentDate: new Date("2026-01-15T00:00:00.000Z"),
        referenceNumber: service().generateReportReference(),
        reporterName: "Fictional name must not be saved",
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /check constraint|CheckConstraintViolation|23514/i);
      return true;
    },
  );
});

test("the database enforces unique submission keys", async () => {
  const input = reportInput();
  await expectDatabaseRejection(
    async (tx) => {
      const first = await service().submitReport(input, tx);
      assert.ok(first.ok);
      return tx.report.create({
        data: {
          ...input,
          incidentDate: new Date("2026-01-15T00:00:00.000Z"),
          referenceNumber: service().generateReportReference(),
        },
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "P2002");
      return true;
    },
  );
  assert.equal(
    await database().report.findUnique({ where: { submissionKey: input.submissionKey } }),
    null,
  );
});
test("receipt access validates its key before querying and selects only the reference", async () => {
  let queries = 0;
  const key = randomUUID();
  const referenceNumber = service().generateReportReference();
  const db = mockDatabase({
    findUnique: async (args) => {
      queries += 1;
      assert.deepEqual(args.where, { submissionKey: key });
      assert.deepEqual(args.select, { referenceNumber: true });
      assert.equal(args.include, undefined);
      return { referenceNumber };
    },
  });
  for (const invalid of [undefined, null, "", "not-a-uuid", { submissionKey: key }]) {
    assert.equal(await service().getReportReceipt(invalid, db), null);
  }
  assert.equal(queries, 0);
  assert.deepEqual(await service().getReportReceipt(key, db), { referenceNumber });
  assert.equal(queries, 1);
});

test("receipt lookup verifies persisted reports and returns null for unknown keys", async () => {
  await withRollback(async (tx) => {
    const input = reportInput();
    const result = await service().submitReport(input, tx);
    assert.ok(result.ok);
    assert.deepEqual(await service().getReportReceipt(input.submissionKey, tx), {
      referenceNumber: result.referenceNumber,
    });
    assert.equal(await service().getReportReceipt(randomUUID(), tx), null);
  });
});
