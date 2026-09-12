import { z } from "zod";

const emailSchema = z
  .string({ error: "Enter your staff email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid staff email address." }).max(254));

const accessCodeSchema = z
  .string({ error: "Enter your staff access code." })
  .min(1, "Enter your staff access code.")
  .max(512, "The staff access code is too long.");

export const staffLoginSchema = z.strictObject(
  {
    email: emailSchema,
    accessCode: accessCodeSchema,
  },
  { error: "The sign-in request contains unexpected fields." },
);

export type StaffLoginInput = z.input<typeof staffLoginSchema>;
export type ValidatedStaffLoginInput = z.output<typeof staffLoginSchema>;
export type StaffLoginFieldErrors = Partial<Record<keyof StaffLoginInput, string>>;

export function getStaffLoginFieldErrors(error: z.ZodError): StaffLoginFieldErrors {
  const fields: StaffLoginFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "email" || field === "accessCode") {
      fields[field] ??= issue.message;
    }
  }
  return fields;
}
