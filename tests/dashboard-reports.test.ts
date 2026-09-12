import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";

import type { Prisma, PrismaClient } from "../generated/prisma/client";

type DashboardReadStore = Pick<PrismaClient, "report">;
type DashboardWriteStore = Pick<PrismaClient, "$transaction">;
type DashboardService = typeof import("../lib/dashboard/reports");

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;
let dashboardService: DashboardService | undefined;

before(async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dashboard tests must not run in production.");
  }
  loadEnvConfig(process.cwd(), true);
  ({ prisma } = await import("../lib/prisma"));
  dashboardService = await import("../lib/dashboard/reports");
});

after(async () => {
  await prisma?.$disconnect();
});

function database() {
  assert.ok(prisma, "The integration test database must be initialized.");
  return prisma;
}

function service() {
  assert.ok(dashboardService, "The dashboard service must be initialized.");
  return dashboardService;
}

function summaryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    referenceNumber: "DEMO-SUBMITTED-001",
    incidentType: "SAFETY_CONCERN",
    location: "Fictional test location",
    status: "SUBMITTED",
    isAnonymous: true,
    incidentDate: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: new Date("2026-09-02T01:00:00.000Z"),
    updatedAt: new Date("2026-09-02T01:00:00.000Z"),
    ...overrides,
  };
}

test("dashboard overview uses aggregate counts and a private summary selection", async () => {
  let recentArgs: Record<string, unknown> | undefined;
  const db = {
    report: {
      groupBy: async (args: Record<string, unknown>) => {
        assert.deepEqual(args, {
          by: ["status"],
          _count: { _all: true },
        });
        return [
          { status: "SUBMITTED", _count: { _all: 2 } },
          { status: "UNDER_REVIEW", _count: { _all: 3 } },
          { status: "ACTION_TAKEN", _count: { _all: 4 } },
          { status: "RESOLVED", _count: { _all: 5 } },
          { status: "DISMISSED", _count: { _all: 6 } },
        ];
      },
      findMany: async (args: Record<string, unknown>) => {
        recentArgs = args;
        return [
          summaryRecord({
            description: "private description",
            reporterName: "Private Student",
            submissionKey: "private-submission-key",
          }),
        ];
      },
    },
  } as unknown as DashboardReadStore;

  const result = await service().getDashboardOverview(db);
  assert.ok(result.ok);
  assert.deepEqual(result.overview.metrics, {
    total: 20,
    submitted: 2,
    underReview: 3,
    actionTaken: 4,
    resolved: 5,
    dismissed: 6,
  });
  assert.equal(result.overview.recentReports.length, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private description|Private Student|submission-key/i,
  );
  assert.ok(recentArgs);
  assert.deepEqual(recentArgs.orderBy, [
    { createdAt: "desc" },
    { id: "desc" },
  ]);
  assert.equal(recentArgs.take, 5);
  assert.doesNotMatch(JSON.stringify(recentArgs.select), /submissionKey/i);
  assert.deepEqual(Object.keys(recentArgs.select as object).sort(), [
    "createdAt",
    "id",
    "incidentDate",
    "incidentType",
    "isAnonymous",
    "location",
    "referenceNumber",
    "status",
    "updatedAt",
  ]);
});

test("dashboard overview fills missing statuses with zero and masks failures", async () => {
  const emptyDb = {
    report: {
      groupBy: async () => [],
      findMany: async () => [],
    },
  } as unknown as DashboardReadStore;
  const empty = await service().getDashboardOverview(emptyDb);
  assert.ok(empty.ok);
  assert.deepEqual(empty.overview.metrics, {
    total: 0,
    submitted: 0,
    underReview: 0,
    actionTaken: 0,
    resolved: 0,
    dismissed: 0,
  });

  const failed = await service().getDashboardOverview({
    report: {
      groupBy: async () => {
        throw new Error("postgresql://private:password@database/reports");
      },
      findMany: async () => [],
    },
  } as unknown as DashboardReadStore);
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /postgresql|password|database/i);
});

test("report listing validates before access and builds bounded normalized filters", async () => {
  let queries = 0;
  const rejectingDb = {
    report: {
      count: async () => {
        queries += 1;
        return 0;
      },
      findMany: async () => {
        queries += 1;
        return [];
      },
    },
  } as unknown as DashboardReadStore;
  const invalid = await service().listDashboardReports(
    { status: "UNKNOWN", pageSize: 1_000 },
    rejectingDb,
  );
  assert.equal(invalid.ok, false);
  assert.ok(!invalid.ok);
  assert.equal(invalid.reason, "validation");
  assert.equal(queries, 0);

  let countArgs: Record<string, unknown> | undefined;
  let listArgs: Record<string, unknown> | undefined;
  const db = {
    report: {
      count: async (args: Record<string, unknown>) => {
        countArgs = args;
        return 41;
      },
      findMany: async (args: Record<string, unknown>) => {
        listArgs = args;
        return [summaryRecord()];
      },
    },
  } as unknown as DashboardReadStore;

  const listed = await service().listDashboardReports(
    {
      status: "UNDER_REVIEW",
      incidentType: "BULLYING",
      from: "2026-09-01",
      to: "2026-09-30",
      reference: " demo-under ",
      page: "3",
      pageSize: "20",
    },
    db,
  );
  assert.ok(listed.ok);
  assert.equal(listed.page.total, 41);
  assert.equal(listed.page.page, 3);
  assert.equal(listed.page.pageSize, 20);
  assert.equal(listed.page.totalPages, 3);
  assert.equal(listed.page.filters.reference, "DEMO-UNDER");
  assert.ok(countArgs);
  assert.ok(listArgs);
  const expectedWhere = {
    status: "UNDER_REVIEW",
    incidentType: "BULLYING",
    referenceNumber: { contains: "DEMO-UNDER", mode: "insensitive" },
    incidentDate: {
      gte: new Date("2026-09-01T00:00:00.000Z"),
      lte: new Date("2026-09-30T00:00:00.000Z"),
    },
  };
  assert.deepEqual(countArgs.where, expectedWhere);
  assert.deepEqual(listArgs.where, expectedWhere);
  assert.equal(listArgs.skip, 40);
  assert.equal(listArgs.take, 20);
  assert.doesNotMatch(JSON.stringify(listArgs.select), /submissionKey/i);
});

test("report listing returns stable empty pagination and masks database errors", async () => {
  const empty = await service().listDashboardReports(
    {},
    {
      report: {
        count: async () => 0,
        findMany: async () => [],
      },
    } as unknown as DashboardReadStore,
  );
  assert.ok(empty.ok);
  assert.equal(empty.page.totalPages, 1);

  const failed = await service().listDashboardReports(
    {},
    {
      report: {
        count: async () => {
          throw new Error("private database credentials");
        },
        findMany: async () => [],
      },
    } as unknown as DashboardReadStore,
  );
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /credentials/i);
});

test("report listing clamps stale out-of-range pages to the final available page", async () => {
  const listCalls: Record<string, unknown>[] = [];
  const db = {
    report: {
      count: async () => 41,
      findMany: async (args: Record<string, unknown>) => {
        listCalls.push(args);
        return listCalls.length === 1 ? [] : [summaryRecord()];
      },
    },
  } as unknown as DashboardReadStore;

  const result = await service().listDashboardReports(
    { page: 99, pageSize: 20 },
    db,
  );

  assert.ok(result.ok);
  assert.equal(result.page.page, 3);
  assert.equal(result.page.totalPages, 3);
  assert.equal(result.page.filters.page, 3);
  assert.equal(result.page.reports.length, 1);
  assert.equal(listCalls.length, 2);
  assert.equal(listCalls[1]?.skip, 40);
});

test("report detail selects internal history and actor but never submission keys", async () => {
  let detailArgs: Record<string, unknown> | undefined;
  const db = {
    report: {
      findUnique: async (args: Record<string, unknown>) => {
        detailArgs = args;
        return {
          ...summaryRecord({ isAnonymous: false, status: "UNDER_REVIEW" }),
          description: "Fictional report detail.",
          reporterName: "Fictional Reporter",
          reporter: {
            id: "student-1",
            name: "Fictional Student",
            email: "student@example.invalid",
          },
          submissionKey: "must-never-leave-the-service",
          statusHistory: [
            {
              id: "history-1",
              status: "UNDER_REVIEW",
              note: "Fictional internal note.",
              createdAt: new Date("2026-09-02T02:00:00.000Z"),
              changedBy: {
                id: "teacher-1",
                name: "Fictional Teacher",
                role: "TEACHER",
                email: "private-teacher@example.invalid",
              },
            },
          ],
        };
      },
    },
  } as unknown as DashboardReadStore;

  const result = await service().getDashboardReportDetail("report-1", db);
  assert.ok(result.ok);
  assert.equal(result.report.description, "Fictional report detail.");
  assert.equal(result.report.reporter?.name, "Fictional Student");
  assert.deepEqual(result.report.history[0]?.changedBy, {
    id: "teacher-1",
    name: "Fictional Teacher",
    role: "TEACHER",
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /must-never|private-teacher@example/i,
  );
  assert.ok(detailArgs);
  assert.deepEqual(detailArgs.where, { id: "report-1" });
  assert.doesNotMatch(JSON.stringify(detailArgs.select), /submissionKey/i);
  assert.deepEqual(
    (detailArgs.select as {
      statusHistory: { orderBy: unknown };
    }).statusHistory.orderBy,
    [{ createdAt: "asc" }, { id: "asc" }],
  );
});

test("report detail preserves anonymity even if a mock returns identity values", async () => {
  const result = await service().getDashboardReportDetail(
    "report-1",
    {
      report: {
        findUnique: async () => ({
          ...summaryRecord(),
          description: "Fictional anonymous detail.",
          reporterName: "Identity that must be ignored",
          reporter: {
            id: "student-private",
            name: "Private Student",
            email: "private@example.invalid",
          },
          statusHistory: [],
        }),
      },
    } as unknown as DashboardReadStore,
  );
  assert.ok(result.ok);
  assert.equal(result.report.reporterName, null);
  assert.equal(result.report.reporter, null);
  assert.doesNotMatch(JSON.stringify(result), /Identity|Private Student|private@/i);
});

test("report detail validates before access and uses generic not-found and failure results", async () => {
  let queries = 0;
  const db = {
    report: {
      findUnique: async () => {
        queries += 1;
        return null;
      },
    },
  } as unknown as DashboardReadStore;
  const invalid = await service().getDashboardReportDetail("", db);
  assert.equal(invalid.ok, false);
  assert.equal(queries, 0);

  const missing = await service().getDashboardReportDetail("missing-report", db);
  assert.equal(missing.ok, false);
  assert.ok(!missing.ok);
  assert.equal(missing.reason, "not_found");

  const failed = await service().getDashboardReportDetail(
    "report-1",
    {
      report: {
        findUnique: async () => {
          throw new Error("private report and database details");
        },
      },
    } as unknown as DashboardReadStore,
  );
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /private report|database details/i);
});

function writeStore(transaction: Prisma.TransactionClient): DashboardWriteStore {
  const store = {
    $transaction: async (
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(transaction),
  };
  return store as unknown as DashboardWriteStore;
}

test("status update uses a trusted actor and guarded update before creating history", async () => {
  const calls: string[] = [];
  const actorId = "trusted-teacher-id";
  const tx = {
    report: {
      findUnique: async (args: Record<string, unknown>) => {
        calls.push("find");
        assert.deepEqual(args, {
          where: { id: "report-1" },
          select: { id: true, status: true },
        });
        return { id: "report-1", status: "SUBMITTED" };
      },
      updateMany: async (args: Record<string, unknown>) => {
        calls.push("guarded-update");
        assert.deepEqual(args, {
          where: { id: "report-1", status: "SUBMITTED" },
          data: { status: "UNDER_REVIEW" },
        });
        return { count: 1 };
      },
    },
    reportStatusHistory: {
      create: async (args: Record<string, unknown>) => {
        calls.push("history");
        assert.deepEqual(args.data, {
          reportId: "report-1",
          status: "UNDER_REVIEW",
          note: "Review started.",
          changedById: actorId,
        });
        assert.doesNotMatch(JSON.stringify(args.select), /email|submissionKey/i);
        return {
          id: "history-2",
          status: "UNDER_REVIEW",
          note: "Review started.",
          createdAt: new Date("2026-09-12T01:00:00.000Z"),
          changedBy: {
            id: actorId,
            name: "Fictional Teacher",
            role: "TEACHER",
          },
        };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await service().updateDashboardReportStatus(
    {
      reportId: "report-1",
      currentStatus: "SUBMITTED",
      status: "UNDER_REVIEW",
      note: "  Review started.  ",
    },
    actorId,
    writeStore(tx),
  );
  assert.ok(result.ok);
  assert.deepEqual(calls, ["find", "guarded-update", "history"]);
  assert.deepEqual(result.change, {
    reportId: "report-1",
    status: "UNDER_REVIEW",
    historyEntry: {
      id: "history-2",
      status: "UNDER_REVIEW",
      note: "Review started.",
      changedAt: "2026-09-12T01:00:00.000Z",
      changedBy: {
        id: actorId,
        name: "Fictional Teacher",
        role: "TEACHER",
      },
    },
  });
});

test("status update rejects invalid input and actor before starting a transaction", async () => {
  let transactions = 0;
  const db = {
    $transaction: async () => {
      transactions += 1;
      throw new Error("Must not start a transaction.");
    },
  } as unknown as DashboardWriteStore;

  const invalid = await service().updateDashboardReportStatus(
    {
      reportId: "report-1",
      currentStatus: "SUBMITTED",
      status: "RESOLVED",
    },
    "teacher-1",
    db,
  );
  assert.equal(invalid.ok, false);
  assert.ok(!invalid.ok);
  assert.equal(invalid.reason, "validation");
  assert.equal(transactions, 0);

  const invalidActor = await service().updateDashboardReportStatus(
    {
      reportId: "report-1",
      currentStatus: "SUBMITTED",
      status: "UNDER_REVIEW",
    },
    "",
    db,
  );
  assert.equal(invalidActor.ok, false);
  assert.ok(!invalidActor.ok);
  assert.equal(invalidActor.reason, "unavailable");
  assert.equal(transactions, 0);
});

test("status update reports stale reads and guarded-write races without history", async () => {
  let updates = 0;
  let historyWrites = 0;
  const staleTx = {
    report: {
      findUnique: async () => ({ id: "report-1", status: "UNDER_REVIEW" }),
      updateMany: async () => {
        updates += 1;
        return { count: 1 };
      },
    },
    reportStatusHistory: {
      create: async () => {
        historyWrites += 1;
        throw new Error("History should not be written.");
      },
    },
  } as unknown as Prisma.TransactionClient;

  const stale = await service().updateDashboardReportStatus(
    {
      reportId: "report-1",
      currentStatus: "SUBMITTED",
      status: "UNDER_REVIEW",
    },
    "teacher-1",
    writeStore(staleTx),
  );
  assert.equal(stale.ok, false);
  assert.ok(!stale.ok);
  assert.equal(stale.reason, "conflict");
  assert.equal(updates, 0);
  assert.equal(historyWrites, 0);

  const raceTx = {
    report: {
      findUnique: async () => ({ id: "report-1", status: "SUBMITTED" }),
      updateMany: async () => ({ count: 0 }),
    },
    reportStatusHistory: {
      create: async () => {
        historyWrites += 1;
        throw new Error("History should not be written.");
      },
    },
  } as unknown as Prisma.TransactionClient;
  const race = await service().updateDashboardReportStatus(
    {
      reportId: "report-1",
      currentStatus: "SUBMITTED",
      status: "UNDER_REVIEW",
    },
    "teacher-1",
    writeStore(raceTx),
  );
  assert.equal(race.ok, false);
  assert.ok(!race.ok);
  assert.equal(race.reason, "conflict");
  assert.equal(historyWrites, 0);
});

test("status update returns generic missing and transaction failure results", async () => {
  const missingTx = {
    report: { findUnique: async () => null },
  } as unknown as Prisma.TransactionClient;
  const input = {
    reportId: "report-1",
    currentStatus: "SUBMITTED",
    status: "UNDER_REVIEW",
  } as const;
  const missing = await service().updateDashboardReportStatus(
    input,
    "teacher-1",
    writeStore(missingTx),
  );
  assert.equal(missing.ok, false);
  assert.ok(!missing.ok);
  assert.equal(missing.reason, "not_found");

  const failed = await service().updateDashboardReportStatus(
    input,
    "teacher-1",
    {
      $transaction: async () => {
        throw new Error("postgresql://private:password@database/reports");
      },
    } as unknown as DashboardWriteStore,
  );
  assert.equal(failed.ok, false);
  assert.ok(!failed.ok);
  assert.equal(failed.reason, "unavailable");
  assert.doesNotMatch(JSON.stringify(failed), /postgresql|password|database/i);
});

async function createDashboardFixture() {
  const db = database();
  const actorId = randomUUID();
  const reportId = randomUUID();
  await db.user.create({
    data: {
      id: actorId,
      email: `dashboard-${randomUUID()}@example.invalid`,
      name: "Fictional Dashboard Teacher",
      role: "TEACHER",
    },
  });
  await db.report.create({
    data: {
      id: reportId,
      referenceNumber: `TEST-${randomUUID().replaceAll("-", "").slice(0, 24)}`,
      incidentType: "SAFETY_CONCERN",
      description: "Fictional dashboard integration test report.",
      location: "Fictional dashboard integration location",
      incidentDate: new Date("2026-09-01T00:00:00.000Z"),
      isAnonymous: true,
      status: "SUBMITTED",
      statusHistory: { create: { status: "SUBMITTED" } },
    },
  });
  return { actorId, reportId };
}

async function removeDashboardFixture(fixture: {
  actorId: string;
  reportId: string;
}) {
  const db = database();
  await db.report.deleteMany({ where: { id: fixture.reportId } });
  await db.user.deleteMany({ where: { id: fixture.actorId } });
}

test("persisted status update is atomic and rejects a repeated stale update", async () => {
  const fixture = await createDashboardFixture();
  try {
    const input = {
      reportId: fixture.reportId,
      currentStatus: "SUBMITTED",
      status: "UNDER_REVIEW",
      note: "Fictional persisted review note.",
    } as const;
    const updated = await service().updateDashboardReportStatus(
      input,
      fixture.actorId,
      database(),
    );
    assert.ok(updated.ok);

    const saved = await database().report.findUniqueOrThrow({
      where: { id: fixture.reportId },
      select: {
        status: true,
        statusHistory: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { status: true, note: true, changedById: true },
        },
      },
    });
    assert.equal(saved.status, "UNDER_REVIEW");
    assert.equal(saved.statusHistory.length, 2);
    assert.deepEqual(saved.statusHistory[1], {
      status: "UNDER_REVIEW",
      note: "Fictional persisted review note.",
      changedById: fixture.actorId,
    });

    const stale = await service().updateDashboardReportStatus(
      input,
      fixture.actorId,
      database(),
    );
    assert.equal(stale.ok, false);
    assert.ok(!stale.ok);
    assert.equal(stale.reason, "conflict");
    assert.equal(
      await database().reportStatusHistory.count({
        where: { reportId: fixture.reportId },
      }),
      2,
    );
  } finally {
    await removeDashboardFixture(fixture);
  }
});

test("history failure rolls the guarded report update back", async () => {
  const fixture = await createDashboardFixture();
  try {
    const failed = await service().updateDashboardReportStatus(
      {
        reportId: fixture.reportId,
        currentStatus: "SUBMITTED",
        status: "UNDER_REVIEW",
      },
      randomUUID(),
      database(),
    );
    assert.equal(failed.ok, false);
    assert.ok(!failed.ok);
    assert.equal(failed.reason, "unavailable");

    const saved = await database().report.findUniqueOrThrow({
      where: { id: fixture.reportId },
      select: { status: true, _count: { select: { statusHistory: true } } },
    });
    assert.equal(saved.status, "SUBMITTED");
    assert.equal(saved._count.statusHistory, 1);
  } finally {
    await removeDashboardFixture(fixture);
  }
});

test("simultaneous reviewers produce one status event and one conflict", async () => {
  const fixture = await createDashboardFixture();
  try {
    const input = {
      reportId: fixture.reportId,
      currentStatus: "SUBMITTED",
      status: "UNDER_REVIEW",
    } as const;
    const results = await Promise.all([
      service().updateDashboardReportStatus(input, fixture.actorId, database()),
      service().updateDashboardReportStatus(input, fixture.actorId, database()),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(
      results.filter((result) => !result.ok && result.reason === "conflict")
        .length,
      1,
    );
    assert.equal(
      await database().reportStatusHistory.count({
        where: { reportId: fixture.reportId },
      }),
      2,
    );
  } finally {
    await removeDashboardFixture(fixture);
  }
});
