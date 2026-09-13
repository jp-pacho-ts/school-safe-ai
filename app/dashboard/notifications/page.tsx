import type { Metadata } from "next";

import {
  markAllNotificationsReadAction,
  setNotificationReadStateAction,
} from "./actions";
import { NotificationList } from "@/components/dashboard/notification-list";
import { DashboardDataError } from "@/components/dashboard/dashboard-states";
import { requireCurrentStaff } from "@/lib/auth/staff";
import { listStaffNotifications } from "@/lib/notifications/notifications";
import styles from "@/components/dashboard/dashboard.module.css";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const staff = await requireCurrentStaff();
  const { prisma } = await import("@/lib/prisma");
  const result = await listStaffNotifications(staff.id, prisma);

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>NOTIFICATIONS</p>
          <h1>Staff inbox</h1>
          <p>Review report alerts and keep track of what you have already seen.</p>
        </div>
        <a
          href="/dashboard/notifications"
          className={styles.primaryLink}
          aria-label="Refresh notification inbox and unread count"
        >
          Refresh inbox
        </a>
      </div>
      {!result.ok ? (
        <DashboardDataError
          title="Notifications could not be loaded"
          description={result.message}
          headingLevel="h2"
          retryHref="/dashboard/notifications"
        />
      ) : (
        <NotificationList
          notifications={result.notifications}
          unreadCount={result.unreadCount}
          setReadStateAction={setNotificationReadStateAction}
          markAllReadAction={markAllNotificationsReadAction}
        />
      )}
    </>
  );
}
