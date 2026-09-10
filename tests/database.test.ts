import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";

import type { Prisma } from "../generated/prisma/client";

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;

function refuseProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Database integration tests must not run in production.");
  }
}

before(async () => {
  refuseProduction();
  loadEnvConfig(process.cwd(), true);
  refuseProduction();
  // The runner supplies --conditions=react-server, preserving server-only checks.
  ({ prisma } = await import("../lib/prisma"));
});

after(async () => {
  await prisma?.$disconnect();
});

function database() {
  assert.ok(prisma, "The integration test database must be initialized.");
  return prisma;
}

function reportData() {
  return {
    id: randomUUID(),
    referenceNumber: `TEST-${randomUUID().replaceAll("-", "").slice(0, 24)}`,
    incidentType: "SAFETY_CONCERN" as const,
    description: "Fictional database test: a hallway light needs attention.",
    location: "Fictional test hallway",
    incidentDate: new Date("2026-01-15T09:30:00.000Z"),
  };
}

async function createUser(tx: Prisma.TransactionClient) {
  return tx.user.create({
    data: {
      id: randomUUID(),
      email: `test-${randomUUID()}@example.invalid`,
      name: "Fictional Test Student",
    },
  });
}

async function createGraph(tx: Prisma.TransactionClient) {
  const user = await createUser(tx);
  const report = await tx.report.create({
    data: { ...reportData(), isAnonymous: false, reporterId: user.id },
  });
  const history = await tx.reportStatusHistory.create({
    data: {
      id: randomUUID(),
      reportId: report.id,
      status: "SUBMITTED",
      changedById: user.id,
    },
  });
  const notification = await tx.notification.create({
    data: {
      id: randomUUID(),
      recipientId: user.id,
      reportId: report.id,
      type: "NEW_REPORT",
      title: "Fictional test report received",
      message: "A fictional report is available for review.",
    },
  });
  return { user, report, history, notification };
}

// Never commit integration fixtures, including when an assertion fails.
async function withRollback(
  check: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const rollback = new Error("Integration test completed; roll back fixtures.");
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
  // A failed SQL statement aborts its transaction. Each invalid case gets its own.
  await assert.rejects(
    database().$transaction(async (tx) => {
      await action(tx);
      throw unexpectedSuccess;
    }),
    (error: unknown) => {
      assert.notEqual(error, unexpectedSuccess);
      return check(error);
    },
  );
}

function prismaErrorCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.equal(error.code, code);
    return true;
  };
}

function checkConstraintError(error: unknown) {
  assert.ok(error instanceof Error);
  assert.match(error.message, /check constraint|CheckConstraintViolation|23514/i);
  return true;
}

test("persists all four models, their relations, and database defaults", async () => {
  await withRollback(async (tx) => {
    const fixtures = await createGraph(tx);
    const user = await tx.user.findUniqueOrThrow({
      where: { id: fixtures.user.id },
      include: { reports: true, statusChanges: true, notifications: true },
    });
    assert.equal(user.role, "STUDENT");
    assert.ok(user.createdAt instanceof Date);
    assert.ok(user.updatedAt instanceof Date);
    assert.deepEqual(user.reports.map(({ id }) => id), [fixtures.report.id]);
    assert.deepEqual(user.statusChanges.map(({ id }) => id), [fixtures.history.id]);
    assert.deepEqual(user.notifications.map(({ id }) => id), [fixtures.notification.id]);

    const report = await tx.report.findUniqueOrThrow({
      where: { referenceNumber: fixtures.report.referenceNumber },
      include: { reporter: true, statusHistory: true, notifications: true },
    });
    assert.equal(report.reporter?.id, user.id);
    assert.equal(report.status, "SUBMITTED");
    assert.equal(report.isAnonymous, false);
    assert.equal(report.incidentDate.toISOString(), "2026-01-15T09:30:00.000Z");
    assert.ok(report.createdAt instanceof Date);
    assert.ok(report.updatedAt instanceof Date);
    assert.equal(report.statusHistory[0]?.status, "SUBMITTED");
    assert.equal(report.statusHistory[0]?.note, null);
    assert.ok(report.statusHistory[0]?.createdAt instanceof Date);
    assert.equal(report.notifications[0]?.readAt, null);
    assert.ok(report.notifications[0]?.createdAt instanceof Date);

    const anonymous = await tx.report.create({ data: reportData() });
    assert.equal(anonymous.isAnonymous, true);
    assert.equal(anonymous.reporterId, null);
    assert.equal(anonymous.status, "SUBMITTED");
    const systemHistory = await tx.reportStatusHistory.create({
      data: { reportId: anonymous.id, status: "SUBMITTED" },
    });
    assert.equal(systemHistory.changedById, null);
  });
});

test("enforces unique user emails and report references", async (t) => {
  await t.test("duplicate email", async () => {
    await expectDatabaseRejection(async (tx) => {
      const user = await createUser(tx);
      return tx.user.create({ data: { email: user.email, name: "Duplicate test user" } });
    }, prismaErrorCode("P2002"));
  });

  await t.test("duplicate report reference", async () => {
    await expectDatabaseRejection(async (tx) => {
      const report = await tx.report.create({ data: reportData() });
      return tx.report.create({
        data: { ...reportData(), referenceNumber: report.referenceNumber },
      });
    }, prismaErrorCode("P2002"));
  });
});

test("rejects missing foreign key targets", async (t) => {
  await t.test("report reporter", async () => {
    await expectDatabaseRejection(
      (tx) => tx.report.create({
        data: { ...reportData(), isAnonymous: false, reporterId: randomUUID() },
      }),
      prismaErrorCode("P2003"),
    );
  });

  await t.test("history report", async () => {
    await expectDatabaseRejection(
      (tx) => tx.reportStatusHistory.create({
        data: { reportId: randomUUID(), status: "SUBMITTED" },
      }),
      prismaErrorCode("P2003"),
    );
  });

  await t.test("history actor", async () => {
    await expectDatabaseRejection(async (tx) => {
      const report = await tx.report.create({ data: reportData() });
      return tx.reportStatusHistory.create({
        data: { reportId: report.id, status: "UNDER_REVIEW", changedById: randomUUID() },
      });
    }, prismaErrorCode("P2003"));
  });

  for (const relation of ["reportId", "recipientId"] as const) {
    await t.test(`notification ${relation}`, async () => {
      await expectDatabaseRejection(async (tx) => {
        const { user, report } = await createGraph(tx);
        return tx.notification.create({
          data: {
            recipientId: user.id,
            reportId: report.id,
            [relation]: randomUUID(),
            type: "STATUS_UPDATED",
            title: "Fictional status update",
            message: "A fictional report status changed.",
          },
        });
      }, prismaErrorCode("P2003"));
    });
  }
});

test("enforces anonymous identity separation and required report text", async (t) => {
  await t.test("anonymous report cannot retain a reporter", async () => {
    await expectDatabaseRejection(async (tx) => {
      const user = await createUser(tx);
      return tx.report.create({
        data: { ...reportData(), isAnonymous: true, reporterId: user.id },
      });
    }, checkConstraintError);
  });

  for (const field of ["referenceNumber", "description", "location"] as const) {
    await t.test(`blank ${field}`, async () => {
      await expectDatabaseRejection(
        (tx) => tx.report.create({ data: { ...reportData(), [field]: " \t\n\r " } }),
        checkConstraintError,
      );
    });
  }
});

test("deleting a user preserves reports and history but removes their notifications", async () => {
  await withRollback(async (tx) => {
    const { user, report, history, notification } = await createGraph(tx);
    await tx.user.delete({ where: { id: user.id } });

    const retainedReport = await tx.report.findUniqueOrThrow({ where: { id: report.id } });
    assert.equal(retainedReport.reporterId, null);
    assert.equal(retainedReport.isAnonymous, false);
    const retainedHistory = await tx.reportStatusHistory.findUniqueOrThrow({
      where: { id: history.id },
    });
    assert.equal(retainedHistory.changedById, null);
    assert.equal(retainedHistory.reportId, report.id);
    assert.equal(await tx.notification.findUnique({ where: { id: notification.id } }), null);
  });
});

test("deleting a report cascades to its history and notifications", async () => {
  await withRollback(async (tx) => {
    const { user, report, history, notification } = await createGraph(tx);
    await tx.report.delete({ where: { id: report.id } });

    assert.equal(await tx.reportStatusHistory.findUnique({ where: { id: history.id } }), null);
    assert.equal(await tx.notification.findUnique({ where: { id: notification.id } }), null);
    assert.ok(await tx.user.findUnique({ where: { id: user.id } }));
  });
});

test("an aborted transaction leaves no partial users, reports, history, or notifications", async () => {
  let fixtures: Awaited<ReturnType<typeof createGraph>> | undefined;
  await withRollback(async (tx) => {
    fixtures = await createGraph(tx);
    assert.ok(await tx.report.findUnique({ where: { id: fixtures.report.id } }));
  });

  assert.ok(fixtures);
  const db = database();
  assert.equal(await db.user.findUnique({ where: { id: fixtures.user.id } }), null);
  assert.equal(await db.report.findUnique({ where: { id: fixtures.report.id } }), null);
  assert.equal(await db.reportStatusHistory.findUnique({ where: { id: fixtures.history.id } }), null);
  assert.equal(await db.notification.findUnique({ where: { id: fixtures.notification.id } }), null);
});
