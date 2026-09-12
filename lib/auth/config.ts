import "server-only";

import { randomBytes } from "node:crypto";

export const STAFF_ACCESS_CODE_ENV = "STAFF_ACCESS_CODE";
export const AUTH_SESSION_SECRET_ENV = "AUTH_SESSION_SECRET";

const DEVELOPMENT_ACCESS_CODE = "school-safe-demo";
const DEVELOPMENT_STAFF_EMAIL = "teacher.one@example.invalid";
const MIN_ACCESS_CODE_LENGTH = 12;
const MIN_SESSION_SECRET_LENGTH = 32;
const MAX_SECRET_LENGTH = 512;
const EXAMPLE_ACCESS_CODE = "replace-with-a-long-random-staff-access-code";
const EXAMPLE_SESSION_SECRET = "replace-with-at-least-32-random-characters";

type AuthEnvironment = Record<string, string | undefined>;

export type AuthConfig = {
  accessCode: string;
  sessionSecret: string;
};

export type DevelopmentDemoCredentials = {
  email: typeof DEVELOPMENT_STAFF_EMAIL;
  accessCode: typeof DEVELOPMENT_ACCESS_CODE;
};

const globalForDevelopmentAuth = globalThis as typeof globalThis & {
  schoolSafeDevelopmentSessionSecret?: string;
};

function developmentSessionSecret() {
  globalForDevelopmentAuth.schoolSafeDevelopmentSessionSecret ??=
    randomBytes(32).toString("base64url");
  return globalForDevelopmentAuth.schoolSafeDevelopmentSessionSecret;
}

function isUsableSecret(value: string | undefined, minimumLength: number) {
  return !!value &&
    value.length >= minimumLength &&
    value.length <= MAX_SECRET_LENGTH &&
    value.trim() === value &&
    !value.includes("\u0000");
}

/**
 * Read server-only authentication configuration without ever including supplied
 * credentials in an error. Production deliberately has no fallback.
 */
export function readAuthConfig(values: AuthEnvironment = process.env): AuthConfig {
  const isProduction = values.NODE_ENV === "production";
  const suppliedAccessCode = values[STAFF_ACCESS_CODE_ENV];
  const suppliedSessionSecret = values[AUTH_SESSION_SECRET_ENV];
  const invalidFields: string[] = [];

  if (
    suppliedAccessCode !== undefined &&
    (
      !isUsableSecret(suppliedAccessCode, MIN_ACCESS_CODE_LENGTH) ||
      suppliedAccessCode === EXAMPLE_ACCESS_CODE
    )
  ) {
    invalidFields.push(STAFF_ACCESS_CODE_ENV);
  }
  if (
    suppliedSessionSecret !== undefined &&
    (
      !isUsableSecret(suppliedSessionSecret, MIN_SESSION_SECRET_LENGTH) ||
      suppliedSessionSecret === EXAMPLE_SESSION_SECRET
    )
  ) {
    invalidFields.push(AUTH_SESSION_SECRET_ENV);
  }
  if (isProduction && suppliedAccessCode === undefined) {
    invalidFields.push(STAFF_ACCESS_CODE_ENV);
  }
  if (isProduction && suppliedSessionSecret === undefined) {
    invalidFields.push(AUTH_SESSION_SECRET_ENV);
  }
  if (
    suppliedAccessCode !== undefined &&
    suppliedSessionSecret !== undefined &&
    suppliedAccessCode === suppliedSessionSecret
  ) {
    invalidFields.push(STAFF_ACCESS_CODE_ENV, AUTH_SESSION_SECRET_ENV);
  }

  if (invalidFields.length) {
    throw new Error(
      `Invalid staff authentication configuration: ${[...new Set(invalidFields)].join(", ")}.`,
    );
  }

  return {
    accessCode: suppliedAccessCode ?? DEVELOPMENT_ACCESS_CODE,
    sessionSecret: suppliedSessionSecret ?? developmentSessionSecret(),
  };
}

/**
 * Return only the fixed, fictional local fallback. Never return a configured
 * credential, and never expose even the fallback from a production process.
 */
export function getDevelopmentDemoCredentials(
  values: AuthEnvironment = process.env,
): DevelopmentDemoCredentials | null {
  if (values.NODE_ENV === "production" || values[STAFF_ACCESS_CODE_ENV] !== undefined) {
    return null;
  }
  return {
    email: DEVELOPMENT_STAFF_EMAIL,
    accessCode: DEVELOPMENT_ACCESS_CODE,
  };
}
