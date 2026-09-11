import { z } from "zod";

export const incidentTypes = [
  { value: "BULLYING", label: "Bullying" },
  { value: "CYBERBULLYING", label: "Cyberbullying" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "VIOLENCE", label: "Violence" },
  { value: "THEFT", label: "Theft" },
  { value: "VANDALISM", label: "Vandalism" },
  { value: "SAFETY_CONCERN", label: "Safety concern" },
  { value: "OTHER", label: "Something else" },
] as const;

/** A calendar date, with one day of tolerance for students ahead of UTC. */
export function getLatestIncidentDate(now = new Date()): string {
  const latest = new Date(now);
  latest.setUTCDate(latest.getUTCDate() + 1);
  return latest.toISOString().slice(0, 10);
}

const incidentDateSchema = z
  .string({ error: "Enter the date of the incident." })
  .superRefine((value, context) => {
    if (value === "") {
      context.addIssue({ code: "custom", message: "Enter the date of the incident." });
      return;
    }

    // Keep a date-only value across the browser/server boundary. Checking the
    // UTC round trip rejects dates that JavaScript would silently roll forward.
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      context.addIssue({ code: "custom", message: "Enter a valid date in YYYY-MM-DD format." });
      return;
    }

    if (value < "1900-01-01") {
      context.addIssue({ code: "custom", message: "Choose a date on or after January 1, 1900." });
    } else if (value > getLatestIncidentDate()) {
      context.addIssue({ code: "custom", message: "The incident date cannot be in the future." });
    }
  });

// PostgreSQL text cannot contain NUL. Reject it before attempting a database write.
function hasNoNullCharacters(value: string) {
  return !value.includes("\u0000");
}

export const reportInputSchema = z
  .strictObject(
    {
      incidentType: z.enum(
        incidentTypes.map((type) => type.value),
        { error: "Choose an incident type." },
      ),
      description: z
        .string({ error: "Describe what happened." })
        .trim()
        .min(10, "Describe what happened in at least 10 characters.")
        .max(5000, "Keep the description to 5,000 characters or fewer.")
        .refine(hasNoNullCharacters, "The description contains an unsupported character. Please retype it."),
      location: z
        .string({ error: "Enter where the incident happened." })
        .trim()
        .min(1, "Enter where the incident happened.")
        .max(200, "Keep the location to 200 characters or fewer.")
        .refine(hasNoNullCharacters, "The location contains an unsupported character. Please retype it."),
      incidentDate: incidentDateSchema,
      isAnonymous: z.boolean({ error: "Choose whether to report anonymously." }),
      reporterName: z
        .string({ error: "Enter your name using text." })
        .trim()
        .max(100, "Keep your name to 100 characters or fewer.")
        .refine(hasNoNullCharacters, "Your name contains an unsupported character. Please retype it.")
        .optional(),
      submissionKey: z
        .uuid({ error: "Your submission session is invalid. Reload the page and try again." })
        .transform((value) => value.toLowerCase()),
    },
    { error: "The report contains unexpected fields. Reload the page and try again." },
  )
  .superRefine((value, context) => {
    if (!value.isAnonymous && !value.reporterName) {
      context.addIssue({
        code: "custom",
        path: ["reporterName"],
        message: "Enter your name or choose anonymous reporting.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    reporterName: value.isAnonymous ? undefined : value.reporterName,
  }));

export type ReportInput = z.input<typeof reportInputSchema>;
export type ValidatedReportInput = z.output<typeof reportInputSchema>;
export type ReportFieldErrors = Partial<Record<keyof ReportInput, string>>;

const reportFields: readonly (keyof ReportInput)[] = [
  "incidentType",
  "description",
  "location",
  "incidentDate",
  "isAnonymous",
  "reporterName",
  "submissionKey",
];

/** Return one readable message per input without echoing submitted values. */
export function getReportFieldErrors(error: z.ZodError): ReportFieldErrors {
  const fields: ReportFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && reportFields.includes(field as keyof ReportInput)) {
      const name = field as keyof ReportInput;
      fields[name] ??= issue.message;
    }
  }

  return fields;
}
