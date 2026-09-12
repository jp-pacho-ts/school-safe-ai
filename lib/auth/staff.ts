import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { PrismaClient } from "@/generated/prisma/client";
import { readAuthConfig, type AuthConfig } from "@/lib/auth/config";
import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";
import type { ValidatedStaffLoginInput } from "@/lib/auth/validation";

export type AuthenticatedStaff = {
  id: string;
  email: string;
  name: string;
  role: "TEACHER" | "ADMIN";
};

export type StaffAuthDatabase = Pick<PrismaClient, "user">;

function safeCredentialMatch(supplied: string, expected: string) {
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function toAuthenticatedStaff(
  user: { id: string; email: string; name: string; role: string } | null,
): AuthenticatedStaff | null {
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function loadDatabase(): Promise<StaffAuthDatabase> {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

/** Verify the shared code and resolve a role-authorized database user. */
export async function authenticateStaff(
  credentials: ValidatedStaffLoginInput,
  database?: StaffAuthDatabase,
  config: AuthConfig = readAuthConfig(),
): Promise<AuthenticatedStaff | null> {
  const codeIsValid = safeCredentialMatch(credentials.accessCode, config.accessCode);
  const db = database ?? await loadDatabase();
  const user = await db.user.findUnique({
    where: { email: credentials.email },
    select: { id: true, email: true, name: true, role: true },
  });

  // Resolve the account even for an invalid code so failures remain generic and
  // do not become a cheap staff-address oracle.
  return codeIsValid ? toAuthenticatedStaff(user) : null;
}

/** Verify a signed token, then re-read the user and current role from PostgreSQL. */
export async function resolveAuthenticatedStaff(
  token: string | undefined,
  database?: StaffAuthDatabase,
  config: AuthConfig = readAuthConfig(),
): Promise<AuthenticatedStaff | null> {
  const session = verifySessionToken(token, config.sessionSecret);
  if (!session) return null;

  const db = database ?? await loadDatabase();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return toAuthenticatedStaff(user);
}

function readCookieHeader(header: string | null, name: string) {
  if (!header) return undefined;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
    const value = segment.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Authenticate a Route Handler request without relying on ambient request state. */
export async function getStaffFromRequest(
  request: Request,
  database?: StaffAuthDatabase,
): Promise<AuthenticatedStaff | null> {
  const token = readCookieHeader(request.headers.get("cookie"), AUTH_COOKIE_NAME);
  if (!token) return null;
  return resolveAuthenticatedStaff(token, database);
}

/** Authenticate the active Server Component request. Returns null when signed out. */
export async function getCurrentStaff(): Promise<AuthenticatedStaff | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveAuthenticatedStaff(token);
}

/** Authenticate a protected staff page and redirect signed-out callers to login. */
export async function requireCurrentStaff(): Promise<AuthenticatedStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    const { redirect } = await import("next/navigation");
    return redirect("/login");
  }
  return staff;
}
