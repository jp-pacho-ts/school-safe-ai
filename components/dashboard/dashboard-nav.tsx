"use client";

import Link from "next/link";
import { Bell, ClipboardList, LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";

import styles from "./dashboard.module.css";

const dashboardLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/reports", label: "Reports", icon: ClipboardList, exact: false },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell, exact: false },
] as const;

export function DashboardNav({
  unreadNotificationCount = 0,
}: {
  unreadNotificationCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.dashboardNav} aria-label="Staff dashboard">
      {dashboardLinks.map(({ href, label, icon: Icon, exact }) => {
        const isCurrent = exact ? pathname === href : pathname.startsWith(href);
        const showUnreadCount = href === "/dashboard/notifications" && unreadNotificationCount > 0;
        const accessibleLabel = showUnreadCount
          ? `${label} (${unreadNotificationCount.toLocaleString("en")} unread)`
          : undefined;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={accessibleLabel}
            className={styles.navLink}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            {showUnreadCount ? (
              <span className={styles.notificationBadge} aria-hidden="true">
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
