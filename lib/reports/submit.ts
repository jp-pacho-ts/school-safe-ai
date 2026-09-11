import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  getReportFieldErrors,
  reportInputSchema,
  type ReportFieldErrors,
  type ValidatedReportInput,
} from "./validation";

type ReportStore = Pick<PrismaClient, "report">;

export type SubmitReportResult =
  | { ok: true; referenceNumber: string; submissionKey: string; replayed: boolean }
  | {
      ok: false;
      reason: "validation" | "conflict" | "unavailable";
      message: string;
      fieldErrors?: ReportFieldErrors;
    };

export const RECEIPT_COOKIE = "school-safe-report-receipt";

export function generateReportReference() {
  // 112 random bits, no identity/date encoding; fits the existing 32-character column.
  return `SSA-${randomBytes(14).toString("hex").toUpperCase()}`;
}

const retryMessage =
  "We couldn’t confirm your submission. Keep this page open and retry with the same details.";

function savedDetailsMatch(
  saved: {
    incidentType: string;
    description: string;
    location: string;
    incidentDate: Date;
    isAnonymous: boolean;
    reporterName: string | null;
  },
  input: ValidatedReportInput,
) {
  return (
    saved.incidentType === input.incidentType &&
    saved.description === input.description &&
    saved.location === input.location &&
    saved.incidentDate.toISOString() === `${input.incidentDate}T00:00:00.000Z` &&
    saved.isAnonymous === input.isAnonymous &&
    saved.reporterName === (input.reporterName ?? null)
  );
}

export async function submitReport(
  raw: unknown,
  db: ReportStore,
): Promise<SubmitReportResult> {
  const parsed = reportInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: "Check the report details and try again.",
      fieldErrors: getReportFieldErrors(parsed.error),
    };
  }
  const input = parsed.data;

  try {
    // Each failed nested write rolls back before retrying. The unique key also
    // handles simultaneous requests that both initially find no saved report.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await db.report.findUnique({
        where: { submissionKey: input.submissionKey },
        select: {
          referenceNumber: true,
          incidentType: true,
          description: true,
          location: true,
          incidentDate: true,
          isAnonymous: true,
          reporterName: true,
        },
      });
      if (existing) {
        if (!savedDetailsMatch(existing, input)) {
          return {
            ok: false,
            reason: "conflict",
            message: "This form was already submitted with different details. Your earlier report has not been changed.",
          };
        }
        return {
          ok: true,
          referenceNumber: existing.referenceNumber,
          submissionKey: input.submissionKey,
          replayed: true,
        };
      }

      try {
        const report = await db.report.create({
          data: {
            referenceNumber: generateReportReference(),
            submissionKey: input.submissionKey,
            incidentType: input.incidentType,
            description: input.description,
            location: input.location,
            // This is a calendar date, stored at UTC midnight without local conversion.
            incidentDate: new Date(`${input.incidentDate}T00:00:00.000Z`),
            isAnonymous: input.isAnonymous,
            reporterName: input.reporterName ?? null,
            reporterId: null,
            status: "SUBMITTED",
            // A nested write commits both rows or neither.
            statusHistory: { create: { status: "SUBMITTED", changedById: null } },
          },
          select: { referenceNumber: true },
        });
        return {
          ok: true,
          referenceNumber: report.referenceNumber,
          submissionKey: input.submissionKey,
          replayed: false,
        };
      } catch (error) {
        if (
          !(error instanceof Error && "code" in error && error.code === "P2002")
        ) {
          throw error;
        }
      }
    }
  } catch {
    // Do not return/log Prisma errors, credentials, identity, or report content.
  }
  return { ok: false, reason: "unavailable", message: retryMessage };
}

export async function getReportReceipt(key: unknown, db: ReportStore) {
  const parsed = z.uuid().safeParse(key);
  if (!parsed.success) return null;
  // Receipt possession grants only this reference, never report content/history.
  return db.report.findUnique({
    where: { submissionKey: parsed.data.toLowerCase() },
    select: { referenceNumber: true },
  });
}
