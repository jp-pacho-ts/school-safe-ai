import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import styles from "@/app/report/report.module.css";
import homeStyles from "@/components/home/home.module.css";

export const metadata: Metadata = {
  description: "Check the progress of a fictional School Safe AI report using its private reference number.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function StatusLayout({ children }: LayoutProps<"/status">) {
  return (
    <div className={`${homeStyles.page} ${styles.shell}`}>
      <a href="#status-main" className={homeStyles.skipLink}>Skip to content</a>
      <header className={styles.header}>
        <Link href="/" className={homeStyles.brand}>
          <ShieldCheck size={30} aria-hidden="true" />
          <span>School Safe <span className={homeStyles.brandSuffix}>AI</span></span>
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to home
        </Link>
      </header>
      <main id="status-main" tabIndex={-1} className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        School Safe AI · Basic Competition Version
      </footer>
    </div>
  );
}
