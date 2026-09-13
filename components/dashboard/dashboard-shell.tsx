import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { DashboardNav } from "./dashboard-nav";
import { LogoutButton } from "./logout-button";
import styles from "./dashboard.module.css";

export interface DashboardStaffSummary {
  name: string;
  role: "TEACHER" | "ADMIN";
}

export function DashboardShell({
  children,
  staff,
  unreadNotificationCount,
}: {
  children: ReactNode;
  staff: DashboardStaffSummary;
  unreadNotificationCount: number;
}) {
  return (
    <div className={styles.dashboardRoot}>
      <a href="#dashboard-main" className={styles.skipLink}>Skip to dashboard content</a>

      <header className={styles.mobileHeader}>
        <Link href="/dashboard" className={styles.brand} aria-label="School Safe AI staff dashboard">
          <ShieldCheck aria-hidden="true" />
          <span>School Safe <span>AI</span></span>
        </Link>
        <div className={styles.mobileActions}>
          <span className={styles.mobileWorkspace}>Staff workspace</span>
          <LogoutButton />
        </div>
      </header>

      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand} aria-label="School Safe AI staff dashboard">
          <ShieldCheck aria-hidden="true" />
          <span>School Safe <span>AI</span></span>
        </Link>
        <p className={styles.workspaceLabel}>Staff workspace</p>
        <DashboardNav unreadNotificationCount={unreadNotificationCount} />
        <div className={styles.sidebarFooter}>
          <div className={styles.staffIdentity}>
            <span className={styles.staffAvatar} aria-hidden="true">
              {staff.name.trim().charAt(0).toUpperCase() || "S"}
            </span>
            <span>
              <strong>{staff.name}</strong>
              <small>{staff.role === "ADMIN" ? "Administrator" : "Teacher"}</small>
            </span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className={styles.dashboardColumn}>
        <div className={styles.mobileNavWrap}>
          <DashboardNav unreadNotificationCount={unreadNotificationCount} />
        </div>
        <main id="dashboard-main" tabIndex={-1} className={styles.dashboardMain}>
          {children}
        </main>
        <footer className={styles.dashboardFooter}>
          <span>School Safe AI</span>
          <span>Authorized staff workspace</span>
        </footer>
      </div>
    </div>
  );
}
