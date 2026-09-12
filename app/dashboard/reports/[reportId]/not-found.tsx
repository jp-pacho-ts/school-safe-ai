import Link from "next/link";
import { FileQuestion } from "lucide-react";

import styles from "@/components/dashboard/dashboard.module.css";

export default function ReportNotFound() {
  return (
    <div className={styles.errorState}>
      <span className={styles.errorIcon}>
        <FileQuestion size={22} aria-hidden="true" />
      </span>
      <div>
        <h1>Report not found</h1>
        <p>The report may no longer exist, or the link may be invalid.</p>
        <Link href="/dashboard/reports" className={styles.primaryLink}>
          Back to report queue
        </Link>
      </div>
    </div>
  );
}
