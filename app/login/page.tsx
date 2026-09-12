import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getDevelopmentDemoCredentials } from "@/lib/auth/config";
import { getCurrentStaff } from "@/lib/auth/staff";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const staff = await getCurrentStaff();
  if (staff) redirect("/dashboard");
  const demoCredentials = getDevelopmentDemoCredentials();

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-heading">
        <Link className={styles.homeLink} href="/">School Safe AI</Link>
        <span className={styles.icon}><ShieldCheck aria-hidden="true" /></span>
        <p className={styles.eyebrow}>AUTHORIZED STAFF ONLY</p>
        <h1 id="login-heading">Staff sign in</h1>
        <p className={styles.intro}>
          Use your staff email and the private demo access code to review fictional reports.
        </p>
        <LoginForm demoCredentials={demoCredentials} />
        <p className={styles.privacy}>
          Access is limited to teacher and administrator records. Student report details
          remain private.
        </p>
      </section>
    </main>
  );
}
