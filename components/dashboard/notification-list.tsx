import Link from "next/link";
import { BellOff, ClipboardPlus, RefreshCw } from "lucide-react";

import { DashboardEmptyState } from "./dashboard-states";
import {
  formatDashboardDateTime,
  type DashboardNotification,
  type NotificationAction,
} from "./dashboard-types";
import {
  MarkAllNotificationsReadForm,
  NotificationReadStateForm,
} from "./notification-read-form";
import styles from "./dashboard.module.css";

const notificationTypeDetails = {
  NEW_REPORT: { label: "New report", icon: ClipboardPlus },
  STATUS_UPDATED: { label: "Status updated", icon: RefreshCw },
} as const;

export function NotificationList({
  notifications,
  unreadCount,
  setReadStateAction,
  markAllReadAction,
}: {
  notifications: DashboardNotification[];
  unreadCount: number;
  setReadStateAction: NotificationAction;
  markAllReadAction: NotificationAction;
}) {
  return (
    <section aria-labelledby="notification-list-heading">
      <div className={styles.notificationListHeading}>
        <div>
          <p className={styles.sectionKicker}>INBOX</p>
          <h2 id="notification-list-heading">Recent notifications</h2>
          <p className={styles.notificationSummary} aria-live="polite">
            {unreadCount === 0
              ? "You have no unread notifications."
              : `${unreadCount.toLocaleString("en")} unread ${unreadCount === 1 ? "notification" : "notifications"}.`}
          </p>
        </div>
        {unreadCount > 0 ? (
          <MarkAllNotificationsReadForm action={markAllReadAction} />
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <DashboardEmptyState
          icon={BellOff}
          title="No notifications yet"
          description="New report alerts will appear here when a concern is submitted."
        />
      ) : (
        <ul className={styles.notificationList}>
          {notifications.map((notification) => {
            const details = notificationTypeDetails[notification.type];
            const Icon = details.icon;
            const isRead = notification.readAt !== null;

            return (
              <li
                key={notification.id}
                className={styles.notificationItem}
                data-read={isRead ? "true" : "false"}
              >
                <span className={styles.notificationIcon} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div className={styles.notificationContent}>
                  <div className={styles.notificationTopline}>
                    <span className={styles.notificationType}>{details.label}</span>
                    <span
                      className={styles.notificationState}
                      data-state={isRead ? "read" : "unread"}
                    >
                      {isRead ? "Read" : "Unread"}
                    </span>
                  </div>
                  <h3>{notification.title}</h3>
                  <p>{notification.message}</p>
                  <div className={styles.notificationMeta}>
                    <Link
                      href={`/dashboard/reports/${encodeURIComponent(notification.report.id)}`}
                      className={styles.notificationReportLink}
                    >
                      Open report {notification.report.referenceNumber}
                    </Link>
                    <time dateTime={notification.createdAt}>
                      {formatDashboardDateTime(notification.createdAt)}
                    </time>
                  </div>
                </div>
                <NotificationReadStateForm
                  notificationId={notification.id}
                  reportReference={notification.report.referenceNumber}
                  isRead={isRead}
                  action={setReadStateAction}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
