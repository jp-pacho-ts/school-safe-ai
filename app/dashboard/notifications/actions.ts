"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentStaff } from "@/lib/auth/staff";
import {
  markAllStaffNotificationsRead,
  setStaffNotificationReadState,
} from "@/lib/notifications/notifications";

export type NotificationActionState = {
  outcome: "idle" | "success" | "error";
  message: string;
};

function stringValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : undefined;
}

export async function setNotificationReadStateAction(
  _previousState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const staff = await requireCurrentStaff();
  const { prisma } = await import("@/lib/prisma");
  const result = await setStaffNotificationReadState(
    {
      notificationId: stringValue(formData, "notificationId"),
      readState: stringValue(formData, "readState"),
    },
    staff.id,
    prisma,
  );

  if (!result.ok) {
    return { outcome: "error", message: result.message };
  }

  revalidatePath("/dashboard", "layout");
  return {
    outcome: "success",
    message: result.readState === "read"
      ? "Notification marked as read."
      : "Notification marked as unread.",
  };
}

export async function markAllNotificationsReadAction(
  _previousState: NotificationActionState,
  _formData: FormData,
): Promise<NotificationActionState> {
  void _previousState;
  void _formData;
  const staff = await requireCurrentStaff();
  const { prisma } = await import("@/lib/prisma");
  const result = await markAllStaffNotificationsRead(staff.id, prisma);

  if (!result.ok) {
    return { outcome: "error", message: result.message };
  }

  revalidatePath("/dashboard", "layout");
  return {
    outcome: "success",
    message: result.updatedCount === 0
      ? "All notifications are already read."
      : "All notifications marked as read.",
  };
}
