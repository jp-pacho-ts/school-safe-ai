import type { LucideIcon } from "lucide-react";
import { FileQuestion, RefreshCw } from "lucide-react";

import styles from "./dashboard.module.css";

export function DashboardEmptyState({
  title,
  description,
  icon: Icon = FileQuestion,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Icon size={24} aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function DashboardDataError({
  title = "The dashboard could not be loaded",
  description = "The report service is temporarily unavailable. Try again in a moment.",
  headingLevel = "h1",
  retryHref = "/dashboard",
}: {
  title?: string;
  description?: string;
  headingLevel?: "h1" | "h2";
  retryHref?: string;
}) {
  const Heading = headingLevel;

  return (
    <div className={styles.errorState} role="alert">
      <span className={styles.errorIcon}><RefreshCw size={22} aria-hidden="true" /></span>
      <div>
        <Heading>{title}</Heading>
        <p>{description}</p>
        <a href={retryHref} className={styles.primaryLink}>Try again</a>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <div className={styles.skeletonPage} aria-busy="true" aria-label="Loading dashboard content">
      <span className={`${styles.skeleton} ${styles.skeletonEyebrow}`} />
      <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <span className={`${styles.skeleton} ${styles.skeletonCopy}`} />
      {detail ? (
        <div className={styles.skeletonDetailGrid}>
          <span className={`${styles.skeleton} ${styles.skeletonPanel}`} />
          <span className={`${styles.skeleton} ${styles.skeletonPanel}`} />
        </div>
      ) : (
        <div className={styles.skeletonCards}>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className={`${styles.skeleton} ${styles.skeletonCard}`} />
          ))}
        </div>
      )}
      <span className={`${styles.skeleton} ${styles.skeletonTable}`} />
      <span className={styles.srOnly}>Loading...</span>
    </div>
  );
}
