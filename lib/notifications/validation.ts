import { z } from "zod";

const databaseIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((value) => !value.includes("\u0000"));

export const notificationReadStateInputSchema = z
  .object({
    notificationId: databaseIdSchema,
    readState: z.enum(["read", "unread"]),
  })
  .strict();

export type NotificationReadStateInput = z.infer<
  typeof notificationReadStateInputSchema
>;

export function isValidTrustedRecipientId(value: unknown): value is string {
  return databaseIdSchema.safeParse(value).success;
}
