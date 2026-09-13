import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  isValidTrustedRecipientId,
  notificationReadStateInputSchema,
} from "./validation";

export const STAFF_NOTIFICATION_LIMIT = 50;

export const NEW_REPORT_NOTIFICATION = {
  type: "NEW_REPORT",
  title: "New safety report",
  message: "A new report is ready for authorized staff review.",
} as const;

export const STATUS_UPDATED_NOTIFICATION = {
  type: "STATUS_UPDATED",
  title: "Report status updated",
  message: "The status of a report you submitted has been updated.",
} as const;

export interface StaffNotification {
  id: string;
  type: "NEW_REPORT" | "STATUS_UPDATED";
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  report: {
    id: string;
    referenceNumber: string;
  };
}

export type StaffNotificationListResult =
  | {
      ok: true;
      notifications: StaffNotification[];
      unreadCount: number;
    }
  | { ok: false; message: string };

export type UnreadNotificationCountResult =
  | { ok: true; count: number }
  | { ok: false; message: string };

export type NotificationReadStateResult =
  | { ok: true; readState: "read" | "unread" }
  | { ok: false; message: string };

export type MarkAllNotificationsReadResult =
  | { ok: true; updatedCount: number }
  | { ok: false; message: string };

export type NotificationReadStore = Pick<PrismaClient, "notification">;

const staffNotificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  createdAt: true,
  readAt: true,
  report: {
    select: {
      id: true,
      referenceNumber: true,
    },
  },
} as const satisfies Prisma.NotificationSelect;

type StaffNotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof staffNotificationSelect;
}>;

function toStaffNotification(
  notification: StaffNotificationRecord,
): StaffNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    report: notification.report,
  };
}

const unavailableMessage =
  "Notifications are temporarily unavailable. Please try again.";

export async function listStaffNotifications(
  trustedStaffId: string,
  db: NotificationReadStore,
): Promise<StaffNotificationListResult> {
  if (!isValidTrustedRecipientId(trustedStaffId)) {
    return { ok: false, message: unavailableMessage };
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { recipientId: trustedStaffId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: STAFF_NOTIFICATION_LIMIT,
        select: staffNotificationSelect,
      }),
      db.notification.count({
        where: { recipientId: trustedStaffId, readAt: null },
      }),
    ]);

    return {
      ok: true,
      notifications: notifications.map(toStaffNotification),
      unreadCount,
    };
  } catch {
    return { ok: false, message: unavailableMessage };
  }
}

export async function getUnreadNotificationCount(
  trustedStaffId: string,
  db: NotificationReadStore,
): Promise<UnreadNotificationCountResult> {
  if (!isValidTrustedRecipientId(trustedStaffId)) {
    return { ok: false, message: unavailableMessage };
  }

  try {
    const count = await db.notification.count({
      where: { recipientId: trustedStaffId, readAt: null },
    });
    return { ok: true, count };
  } catch {
    return { ok: false, message: unavailableMessage };
  }
}

export async function setStaffNotificationReadState(
  raw: unknown,
  trustedStaffId: string,
  db: NotificationReadStore,
): Promise<NotificationReadStateResult> {
  const parsed = notificationReadStateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "The notification update is invalid." };
  }
  if (!isValidTrustedRecipientId(trustedStaffId)) {
    return { ok: false, message: "The notification could not be updated." };
  }

  try {
    const updated = await db.notification.updateMany({
      where: {
        id: parsed.data.notificationId,
        recipientId: trustedStaffId,
      },
      data: {
        readAt: parsed.data.readState === "read" ? new Date() : null,
      },
    });
    if (updated.count !== 1) {
      return { ok: false, message: "The notification could not be found." };
    }
    return { ok: true, readState: parsed.data.readState };
  } catch {
    return { ok: false, message: "The notification could not be updated." };
  }
}

export async function markAllStaffNotificationsRead(
  trustedStaffId: string,
  db: NotificationReadStore,
): Promise<MarkAllNotificationsReadResult> {
  if (!isValidTrustedRecipientId(trustedStaffId)) {
    return { ok: false, message: "Notifications could not be updated." };
  }

  try {
    const updated = await db.notification.updateMany({
      where: { recipientId: trustedStaffId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updatedCount: updated.count };
  } catch {
    return { ok: false, message: "Notifications could not be updated." };
  }
}
