"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentStaff } from "@/lib/auth/staff";
import { updateDashboardReportStatus } from "@/lib/dashboard/reports";
import type { StatusUpdateFormState } from "@/components/dashboard/dashboard-types";

function stringValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : undefined;
}

/**
 * Authenticated Server Action contract consumed by StatusUpdateForm through
 * useActionState. Expected failures are returned so the form can announce them.
 */
export async function updateReportStatusAction(
  _previousState: StatusUpdateFormState,
  formData: FormData,
): Promise<StatusUpdateFormState> {
  const staff = await requireCurrentStaff();
  const input = {
    reportId: stringValue(formData, "reportId"),
    currentStatus: stringValue(formData, "currentStatus"),
    status: stringValue(formData, "status"),
    note: stringValue(formData, "note"),
  };
  const { prisma } = await import("@/lib/prisma");
  const result = await updateDashboardReportStatus(input, staff.id, prisma);

  if (!result.ok) {
    return {
      outcome: "error",
      message: result.message,
      fieldErrors: result.reason === "validation"
        ? {
            status: result.fieldErrors?.status,
            note: result.fieldErrors?.note,
            form: result.fieldErrors?.reportId ?? result.fieldErrors?.currentStatus,
          }
        : { form: result.message },
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/reports/${result.change.reportId}`);

  return {
    outcome: "success",
    message: "The report status and internal history were updated.",
  };
}
