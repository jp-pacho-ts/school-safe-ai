import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { connection } from "next/server";
import { HeartHandshake, TriangleAlert } from "lucide-react";

import { ReportForm } from "@/components/reports/report-form";
import styles from "./report.module.css";

export const metadata: Metadata = { title: "Report a concern" };

export default async function ReportPage() {
  // Every full page request gets a fresh key; never prerender or share a form key.
  await connection();
  const submissionKey = randomUUID();

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>YOUR VOICE MATTERS</p>
        <h1>Share what’s on your mind.</h1>
        <p>Take your time. You can review your report before sending it.</p>
      </div>
      <div className={styles.demoNote}>
        <HeartHandshake size={22} aria-hidden="true" />
        <p><strong>Competition demo — use fictional information.</strong> Reports can be saved, but teacher review and online status checking are not available yet.</p>
      </div>
      <aside className={styles.safetyNote} aria-label="Immediate help">
        <TriangleAlert size={21} aria-hidden="true" />
        <p>If someone is in immediate danger, contact a nearby trusted adult or local emergency services. This website does not provide emergency help.</p>
      </aside>
      <ReportForm submissionKey={submissionKey} />
    </>
  );
}
