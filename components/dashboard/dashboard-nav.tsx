"use client";

import Link from "next/link";
import { ClipboardList, LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";

import styles from "./dashboard.module.css";

const dashboardLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/reports", label: "Reports", icon: ClipboardList, exact: false },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.dashboardNav} aria-label="Staff dashboard">
      {dashboardLinks.map(({ href, label, icon: Icon, exact }) => {
        const isCurrent = exact ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent ? "page" : undefined}
            className={styles.navLink}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
