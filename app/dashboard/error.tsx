"use client";

import { RefreshCw } from "lucide-react";

import styles from "@/components/dashboard/dashboard.module.css";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.errorState} role="alert">
      <span className={styles.errorIcon}><RefreshCw size={22} aria-hidden="true" /></span>
      <div>
        <h1>Something interrupted the dashboard</h1>
        <p>Your report data was not changed. Try loading this section again.</p>
        <button type="button" className={styles.primaryLink} onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
