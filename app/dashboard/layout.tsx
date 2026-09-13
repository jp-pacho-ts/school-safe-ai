import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireCurrentStaff } from "@/lib/auth/staff";
import { getUnreadNotificationCount } from "@/lib/notifications/notifications";

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
  const { prisma } = await import("@/lib/prisma");
  const unreadResult = await getUnreadNotificationCount(staff.id, prisma);

  return (
    <DashboardShell
      staff={staff}
      unreadNotificationCount={unreadResult.ok ? unreadResult.count : 0}
    >
      {children}
    </DashboardShell>
  );
}
