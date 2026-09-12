import type { Metadata } from "next";
import { HeartHandshake, TriangleAlert } from "lucide-react";

import styles from "@/app/report/report.module.css";
import { StatusLookup } from "@/components/reports/status-lookup";

export const metadata: Metadata = { title: "Check report status" };

export default function StatusPage() {
  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>FOLLOW THE NEXT STEP</p>
        <h1>Check a report&apos;s status.</h1>
        <p>Use the private reference from your receipt to see its current progress.</p>
      </div>
      <div className={styles.demoNote}>
        <HeartHandshake size={22} aria-hidden="true" />
        <p>
          <strong>Competition demo.</strong> Only fictional reports are shown here.
          Keep real report references private.
        </p>
      </div>
      <aside className={styles.safetyNote} aria-label="Immediate help">
        <TriangleAlert size={21} aria-hidden="true" />
        <p>
          If someone is in immediate danger, contact a nearby trusted adult or local
          emergency services. This website does not provide emergency help.
        </p>
      </aside>
      <StatusLookup />
    </>
  );
}
