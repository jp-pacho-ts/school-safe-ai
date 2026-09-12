import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  getStatusLookupFieldError,
  statusLookupInputSchema,
  type PublicStatusReport,
} from "./status-validation";

type StatusStore = Pick<PrismaClient, "report">;

export type LookupReportStatusResult =
  | { ok: true; report: PublicStatusReport }
  | {
      ok: false;
      reason: "validation" | "not_found" | "unavailable";
      message: string;
      fieldError?: string;
    };

export async function lookupReportStatus(
  raw: unknown,
  db: StatusStore,
): Promise<LookupReportStatusResult> {
  const parsed = statusLookupInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: "Check the reference number and try again.",
      fieldError: getStatusLookupFieldError(parsed.error),
    };
  }

  try {
    const report = await db.report.findUnique({
      where: { referenceNumber: parsed.data.referenceNumber },
      select: {
        referenceNumber: true,
        status: true,
        statusHistory: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { status: true, createdAt: true },
        },
      },
    });

    if (!report) {
      return {
        ok: false,
        reason: "not_found",
        message: "We couldn't find that report. Check the reference number and try again.",
      };
    }

    return {
      ok: true,
      report: {
        referenceNumber: report.referenceNumber,
        currentStatus: report.status,
        history: report.statusHistory.map((entry) => ({
          status: entry.status,
          changedAt: entry.createdAt.toISOString(),
        })),
      },
    };
  } catch {
    // Never expose database errors, report content, identities, or internal notes.
    return {
      ok: false,
      reason: "unavailable",
      message: "Status lookup is temporarily unavailable. Please try again.",
    };
  }
}
