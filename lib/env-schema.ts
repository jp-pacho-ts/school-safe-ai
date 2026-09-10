import { z } from "zod";

const databaseUrl = z.string().trim().min(1).refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.length > 0 &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}, "DATABASE_URL must be a PostgreSQL URL with a host and database name.");

const serverEnvSchema = z.object({
  DATABASE_URL: databaseUrl,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export function parseServerEnv(values: Record<string, string | undefined>) {
  const result = serverEnvSchema.safeParse(values);

  if (!result.success) {
    // Never include supplied values or credentials in errors.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid server environment: ${fields.join(", ")}. Check .env.example.`);
  }

  return result.data;
}