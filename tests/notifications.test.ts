import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";

import type { Prisma, PrismaClient } from "../generated/prisma/client";

type NotificationStore = Pick<PrismaClient, "notification">;
type NotificationService = typeof import("../lib/notifications/notifications");

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;
let notifications: NotificationService | undefined;

function refuseProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Notification tests must not run in production.");
  }
}

before(async () => {
  refuseProduction();
  loadEnvConfig(process.cwd(), true);
  refuseProduction();
  ({ prisma } = await import("../lib/prisma"));
  notifications = await import("../lib/notifications/notifications");
});

after(async () => {
  await prisma?.$disconnect();
});

function database() {
  assert.ok(prisma, "The integration test database must be initialized.");
  return prisma;
}

function service() {
  assert.ok(notifications, "The notification service must be initialized.");
  return notifications;
}

function mockStore(handlers: {
  findMany?: (args: Prisma.NotificationFindManyArgs) => Promise<unknown>;
  count?: (args: Prisma.NotificationCountArgs) => Promise<number>;
  updateMany?: (args: Prisma.NotificationUpdateManyArgs) => Promise<{ count: number }>;
}): NotificationStore {
  const unexpected = async () => {
    throw new Error("Unexpected notification query.");
  };
  return {
    notification: {
      findMany: handlers.findMany ?? unexpected,
      count: handlers.count ?? unexpected,
      updateMany: handlers.updateMany ?? unexpected,
    },
  } as unknown as NotificationStore;
}

test("staff notification list scopes both queries and returns only its safe DTO", async () => {
  const staffId = "teacher-1";
  const createdAt = new Date("2026-09-13T01:00:00.000Z");
  const db = mockStore({
    findMany: async (args) => {
      assert.deepEqual(args.where, { recipientId: staffId });
      assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
      assert.equal(args.take, service().STAFF_NOTIFICATION_LIMIT);
      assert.deepEqual(args.select, {
        id: true,
        type: true,
        title: true,
        message: true,
        createdAt: true,
        readAt: true,
        report: { select: { id: true, referenceNumber: true } },
      });
      assert.equal(args.include, undefined);
      return [{
        id: "notification-1",
        recipientId: "must-not-be-returned",
        type: "NEW_REPORT",
        title: "New safety report",
        message: "A new report is ready for authorized staff review.",
        createdAt,
        readAt: null,
        report: { id: "report-1", referenceNumber: "SSA-TEST-REFERENCE" },
      }];
    },
    count: async (args) => {
      assert.deepEqual(args.where, { recipientId: staffId, readAt: null });
      return 1;
    },
  });

  const result = await service().listStaffNotifications(staffId, db);
  assert.deepEqual(result, {
    ok: true,
    notifications: [{
      id: "notification-1",
      type: "NEW_REPORT",
      title: "New safety report",
      message: "A new report is ready for authorized staff review.",
      createdAt: createdAt.toISOString(),
      readAt: null,
      report: { id: "report-1", referenceNumber: "SSA-TEST-REFERENCE" },
    }],
    unreadCount: 1,
  });
  assert.doesNotMatch(JSON.stringify(result), /must-not-be-returned/);
});

test("notification reads and writes validate trusted IDs and mask failures", async () => {
  let queries = 0;
  const forbidden = async () => {
    queries += 1;
    throw new Error("Database must not be queried for invalid input.");
  };
  const forbiddenStore = mockStore({
    findMany: forbidden,
    count: forbidden,
    updateMany: forbidden,
  });

  assert.equal((await service().listStaffNotifications("", forbiddenStore)).ok, false);
  assert.equal((await service().getUnreadNotificationCount("\u0000", forbiddenStore)).ok, false);
  assert.equal((await service().setStaffNotificationReadState(
    { notificationId: "", readState: "read" },
    "teacher-1",
    forbiddenStore,
  )).ok, false);
  assert.equal((await service().markAllStaffNotificationsRead("", forbiddenStore)).ok, false);
  assert.equal(queries, 0);

  const privateFailure = new Error("postgresql://private:password@database/notifications");
  const failingStore = mockStore({
    findMany: async () => { throw privateFailure; },
    count: async () => { throw privateFailure; },
    updateMany: async () => { throw privateFailure; },
  });
  const results = [
    await service().listStaffNotifications("teacher-1", failingStore),
    await service().getUnreadNotificationCount("teacher-1", failingStore),
    await service().setStaffNotificationReadState(
      { notificationId: "notification-1", readState: "read" },
      "teacher-1",
      failingStore,
    ),
    await service().markAllStaffNotificationsRead("teacher-1", failingStore),
  ];
  for (const result of results) {
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /postgresql|password|database/i);
  }
});

test("read-state mutations always constrain writes to the trusted recipient", async () => {
  const staffId = "teacher-1";
  const calls: Prisma.NotificationUpdateManyArgs[] = [];
  const db = mockStore({
    updateMany: async (args) => {
      calls.push(args);
      return { count: 1 };
    },
  });

  const read = await service().setStaffNotificationReadState(
    { notificationId: "notification-1", readState: "read" },
    staffId,
    db,
  );
  assert.deepEqual(read, { ok: true, readState: "read" });
  assert.deepEqual(calls[0]?.where, {
    id: "notification-1",
    recipientId: staffId,
  });
  assert.ok(calls[0]?.data.readAt instanceof Date);

  const unread = await service().setStaffNotificationReadState(
    { notificationId: "notification-1", readState: "unread" },
    staffId,
    db,
  );
  assert.deepEqual(unread, { ok: true, readState: "unread" });
  assert.deepEqual(calls[1]?.data, { readAt: null });

  const all = await service().markAllStaffNotificationsRead(staffId, db);
  assert.deepEqual(all, { ok: true, updatedCount: 1 });
  assert.deepEqual(calls[2]?.where, { recipientId: staffId, readAt: null });
  assert.ok(calls[2]?.data.readAt instanceof Date);
});

test("persisted notification ownership, read state, unread count, and mark-all are enforced", async () => {
  const rollback = new Error("Notification test completed; roll back fixtures.");
  await assert.rejects(
    database().$transaction(async (tx) => {
      const ownerId = randomUUID();
      const otherId = randomUUID();
      const reportId = randomUUID();
      await tx.user.createMany({
        data: [
          {
            id: ownerId,
            email: `notification-owner-${randomUUID()}@example.invalid`,
            name: "Fictional Notification Owner",
            role: "TEACHER",
          },
          {
            id: otherId,
            email: `notification-other-${randomUUID()}@example.invalid`,
            name: "Fictional Other Teacher",
            role: "TEACHER",
          },
        ],
      });
      await tx.report.create({
        data: {
          id: reportId,
          referenceNumber: `TEST-${randomUUID().replaceAll("-", "").slice(0, 24)}`,
          incidentType: "SAFETY_CONCERN",
          description: "Fictional notification integration report.",
          location: "Fictional notification test location",
          incidentDate: new Date("2026-09-13T00:00:00.000Z"),
        },
      });
      const [first, second, other] = await Promise.all([
        tx.notification.create({
          data: {
            recipientId: ownerId,
            reportId,
            type: "NEW_REPORT",
            title: "First notification",
            message: "Fictional first notification.",
          },
        }),
        tx.notification.create({
          data: {
            recipientId: ownerId,
            reportId,
            type: "NEW_REPORT",
            title: "Second notification",
            message: "Fictional second notification.",
          },
        }),
        tx.notification.create({
          data: {
            recipientId: otherId,
            reportId,
            type: "NEW_REPORT",
            title: "Other notification",
            message: "Fictional other notification.",
          },
        }),
      ]);

      const listed = await service().listStaffNotifications(ownerId, tx);
      assert.ok(listed.ok);
      assert.equal(listed.notifications.length, 2);
      assert.equal(listed.unreadCount, 2);
      assert.ok(listed.notifications.every((item) => item.id !== other.id));

      const denied = await service().setStaffNotificationReadState(
        { notificationId: other.id, readState: "read" },
        ownerId,
        tx,
      );
      assert.equal(denied.ok, false);
      assert.equal(
        (await tx.notification.findUniqueOrThrow({ where: { id: other.id } })).readAt,
        null,
      );

      assert.deepEqual(
        await service().setStaffNotificationReadState(
          { notificationId: first.id, readState: "read" },
          ownerId,
          tx,
        ),
        { ok: true, readState: "read" },
      );
      assert.ok((await tx.notification.findUniqueOrThrow({ where: { id: first.id } })).readAt);
      assert.deepEqual(
        await service().getUnreadNotificationCount(ownerId, tx),
        { ok: true, count: 1 },
      );

      const marked = await service().markAllStaffNotificationsRead(ownerId, tx);
      assert.deepEqual(marked, { ok: true, updatedCount: 1 });
      assert.ok((await tx.notification.findUniqueOrThrow({ where: { id: second.id } })).readAt);
      assert.equal(
        (await tx.notification.findUniqueOrThrow({ where: { id: other.id } })).readAt,
        null,
      );

      assert.deepEqual(
        await service().setStaffNotificationReadState(
          { notificationId: first.id, readState: "unread" },
          ownerId,
          tx,
        ),
        { ok: true, readState: "unread" },
      );
      assert.equal(
        (await tx.notification.findUniqueOrThrow({ where: { id: first.id } })).readAt,
        null,
      );

      throw rollback;
    }),
    (error: unknown) => error === rollback,
  );
});
