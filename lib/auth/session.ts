import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "school_safe_staff_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const TOKEN_VERSION = 1;
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 1024;
const MAX_USER_ID_LENGTH = 128;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type StaffSessionPayload = {
  version: 1;
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeSignatureMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createSessionToken(
  userId: string,
  secret: string,
  now = new Date(),
): string {
  if (
    !userId ||
    userId.length > MAX_USER_ID_LENGTH ||
    userId.includes("\u0000") ||
    secret.length < 32
  ) {
    throw new Error("A valid staff session could not be created.");
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = {
    v: TOKEN_VERSION,
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = new Date(),
): StaffSessionPayload | null {
  if (!token || token.length > MAX_TOKEN_LENGTH || secret.length < 32) return null;

  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    !BASE64URL_PATTERN.test(parts[0]) ||
    !BASE64URL_PATTERN.test(parts[1])
  ) {
    return null;
  }

  const [encodedPayload, suppliedSignature] = parts;
  const expectedSignature = sign(encodedPayload, secret);
  if (!safeSignatureMatch(suppliedSignature, expectedSignature)) return null;

  try {
    const raw: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const payload = raw as Record<string, unknown>;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      payload.v !== TOKEN_VERSION ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.sub.length > MAX_USER_ID_LENGTH ||
      payload.sub.includes("\u0000") ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp)
    ) {
      return null;
    }

    const issuedAt = payload.iat as number;
    const expiresAt = payload.exp as number;
    if (
      issuedAt > nowSeconds + CLOCK_SKEW_SECONDS ||
      expiresAt <= nowSeconds ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt !== SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    return {
      version: TOKEN_VERSION,
      userId: payload.sub,
      issuedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}
