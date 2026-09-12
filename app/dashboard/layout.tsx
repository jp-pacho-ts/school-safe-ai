import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireCurrentStaff } from "@/lib/auth/staff";

export const metadata: Metadata = {
  title: {
    default: "Staff dashboard",
    template: "%s | School Safe AI",
  },
  description: "Authorized staff workspace for reviewing fictional school safety reports.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const staff = await requireCurrentStaff();

  return <DashboardShell staff={staff}>{children}</DashboardShell>;
}
