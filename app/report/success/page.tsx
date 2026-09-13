import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Check, FileQuestion } from "lucide-react";

import { CopyReference } from "@/components/reports/copy-reference";
import { Button } from "@/components/ui/button";
import { getReportReceipt, RECEIPT_COOKIE } from "@/lib/reports/submit";
import styles from "../report.module.css";

export const metadata: Metadata = { title: "Report receipt" };

export default async function ReportSuccessPage() {
  const key = (await cookies()).get(RECEIPT_COOKIE)?.value;
  let receipt: { referenceNumber: string } | null = null;
  let unavailable = false;
  if (key) {
    try {
      const { prisma } = await import("@/lib/prisma");
      receipt = await getReportReceipt(key, prisma);
    } catch {
      unavailable = true;
    }
  }

  if (!receipt) {
    return (
      <section className={styles.receipt} aria-labelledby="receipt-heading">
        <FileQuestion className={styles.receiptIcon} aria-hidden="true" />
        <h1 id="receipt-heading">{unavailable ? "Your receipt is temporarily unavailable." : "No recent receipt to display."}</h1>
        <p>
          {unavailable
            ? "We can’t load your receipt right now. This does not mean your report was lost. Refresh this page to try again."
            : "A receipt appears here after a successful submission in this browser. It expires after one hour. Keep any reference you already saved."}
        </p>
        <div className={styles.actions}>
          {unavailable
            ? <Button asChild className={styles.action}><a href="/report/success">Try again</a></Button>
            : <Button asChild className={styles.action}><a href="/report">Start a report</a></Button>}
          <Link href="/" className={styles.backLink}>Back to home</Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.receipt} aria-labelledby="receipt-heading">
      <Check className={styles.receiptIcon} aria-hidden="true" />
      <p className={styles.eyebrow}>REPORT RECEIVED</p>
      <h1 id="receipt-heading">Your report has been saved.</h1>
      <p>Keep your reference number somewhere private. It identifies your report.</p>
      <div className={styles.referenceBox}>
        <h2>Your reference number</h2>
        <code className={styles.reference}>{receipt.referenceNumber}</code>
        <CopyReference referenceNumber={receipt.referenceNumber} />
      </div>
      <p>
        You can check this report&apos;s saved status using the reference above. Authorized staff can review it in the protected dashboard.
        If you need support, speak with a teacher, school counselor, or another trusted adult.
      </p>
      <p className={styles.receiptNote}>
        This receipt is available in this browser for one hour. Refreshing it won’t
        submit another report. This website does not provide emergency help.
      </p>
      <div className={styles.actions}>
        <Button asChild className={styles.action}><Link href="/status">Check report status</Link></Button>
        <Link href="/" className={styles.backLink}>Back to home</Link>
        <a href="/report" className={styles.backLink}>Start another report</a>
      </div>
    </section>
  );
}
