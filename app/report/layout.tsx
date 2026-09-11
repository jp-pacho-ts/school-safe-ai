import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import homeStyles from "@/components/home/home.module.css";
import styles from "./report.module.css";

export const metadata: Metadata = {
  description: "Share a school safety concern using the School Safe AI competition demo.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ReportLayout({ children }: LayoutProps<"/report">) {
  return (
    <div className={`${homeStyles.page} ${styles.shell}`}>
      <a href="#report-main" className={homeStyles.skipLink}>Skip to content</a>
      <header className={styles.header}>
        <Link href="/" className={homeStyles.brand}>
          <ShieldCheck size={30} aria-hidden="true" />
          <span>School Safe <span className={homeStyles.brandSuffix}>AI</span></span>
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to home
        </Link>
      </header>
      <main id="report-main" tabIndex={-1} className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        School Safe AI · Basic Competition Version
      </footer>
    </div>
  );
}
