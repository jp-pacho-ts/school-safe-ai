import { z } from "zod";

export const reportStatusValues = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_TAKEN",
  "RESOLVED",
  "DISMISSED",
] as const;

export type PublicReportStatus = (typeof reportStatusValues)[number];

export const statusDetails = {
  SUBMITTED: {
    label: "Submitted",
    description: "The report has been received and is waiting for review.",
  },
  UNDER_REVIEW: {
    label: "Under review",
    description: "A staff member is reviewing the report and deciding the next step.",
  },
  ACTION_TAKEN: {
    label: "Action taken",
    description: "Staff have recorded that action was taken in response to the report.",
  },
  RESOLVED: {
    label: "Resolved",
    description: "The report has completed the review process.",
  },
  DISMISSED: {
    label: "Dismissed",
    description: "The review was closed without further action.",
  },
} satisfies Record<PublicReportStatus, { label: string; description: string }>;

export const standardStatusFlow = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_TAKEN",
  "RESOLVED",
] as const satisfies readonly PublicReportStatus[];

export const dismissedStatusFlow = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DISMISSED",
] as const satisfies readonly PublicReportStatus[];

const generatedReferencePattern = /^SSA-[A-F0-9]{28}$/;
const demoReferencePattern =
  /^DEMO-(?:SUBMITTED|UNDER-REVIEW|ACTION-TAKEN|RESOLVED|DISMISSED)-001$/;

export function isPublicReference(value: string) {
  return generatedReferencePattern.test(value) || demoReferencePattern.test(value);
}

const referenceNumberSchema = z
  .string({ error: "Enter your reference number." })
  .trim()
  .transform((value) => value.toUpperCase())
  .superRefine((value, context) => {
    if (!value) {
      context.addIssue({ code: "custom", message: "Enter your reference number." });
    } else if (value.length > 32 || !isPublicReference(value)) {
      context.addIssue({
        code: "custom",
        message: "Enter the complete reference exactly as shown on your receipt.",
      });
    }
  });

export const statusLookupInputSchema = z.strictObject(
  { referenceNumber: referenceNumberSchema },
  { error: "The lookup contains unexpected fields. Reload the page and try again." },
);

const statusSchema = z.enum(reportStatusValues);

export const publicStatusReportSchema = z.strictObject({
  referenceNumber: z.string().refine(isPublicReference),
  currentStatus: statusSchema,
  history: z.array(z.strictObject({
    status: statusSchema,
    changedAt: z.iso.datetime(),
  })),
});

export type StatusLookupInput = z.input<typeof statusLookupInputSchema>;
export type ValidatedStatusLookupInput = z.output<typeof statusLookupInputSchema>;
export type PublicStatusReport = z.output<typeof publicStatusReportSchema>;

/** Return a readable field error without echoing the supplied reference. */
export function getStatusLookupFieldError(error: z.ZodError) {
  return error.issues.find((issue) => issue.path[0] === "referenceNumber")?.message;
}
