import assert from "node:assert/strict";
import test from "node:test";

import {
  getDevelopmentDemoCredentials,
  readAuthConfig,
} from "../lib/auth/config";
import {
  readLimitedJson,
  validateSameOriginJsonRequest,
} from "../lib/auth/request";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  verifySessionToken,
} from "../lib/auth/session";
import {
  getStaffLoginFieldErrors,
  staffLoginSchema,
} from "../lib/auth/validation";

const SESSION_SECRET = "session-secret-used-only-by-auth-tests-1234567890";
const ACCESS_CODE = "test-only-access-code";
const NOW = new Date("2026-09-12T04:00:00.000Z");

test("production auth requires strong, independent environment credentials", () => {
  assert.throws(
    () => readAuthConfig({ NODE_ENV: "production" }),
    /STAFF_ACCESS_CODE.*AUTH_SESSION_SECRET/,
  );

  const sensitiveValue = "sensitive-value-that-must-not-appear";
  assert.throws(
    () => readAuthConfig({
      NODE_ENV: "production",
      STAFF_ACCESS_CODE: sensitiveValue,
      AUTH_SESSION_SECRET: "short",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /AUTH_SESSION_SECRET/);
      assert.equal(error.message.includes(sensitiveValue), false);
      return true;
    },
  );

  assert.throws(
    () => readAuthConfig({
      NODE_ENV: "production",
      STAFF_ACCESS_CODE: SESSION_SECRET,
      AUTH_SESSION_SECRET: SESSION_SECRET,
    }),
    /STAFF_ACCESS_CODE.*AUTH_SESSION_SECRET/,
  );

  assert.throws(
    () => readAuthConfig({
      NODE_ENV: "production",
      STAFF_ACCESS_CODE: "replace-with-a-long-random-staff-access-code",
      AUTH_SESSION_SECRET: "replace-with-at-least-32-random-characters",
    }),
    /STAFF_ACCESS_CODE.*AUTH_SESSION_SECRET/,
  );

  assert.deepEqual(
    readAuthConfig({
      NODE_ENV: "production",
      STAFF_ACCESS_CODE: ACCESS_CODE,
      AUTH_SESSION_SECRET: SESSION_SECRET,
    }),
    { accessCode: ACCESS_CODE, sessionSecret: SESSION_SECRET },
  );
});

test("fixed demo credentials are available only for the unconfigured non-production fallback", () => {
  assert.deepEqual(getDevelopmentDemoCredentials({ NODE_ENV: "development" }), {
    email: "teacher.one@example.invalid",
    accessCode: "school-safe-demo",
  });
  assert.equal(
    getDevelopmentDemoCredentials({
      NODE_ENV: "development",
      STAFF_ACCESS_CODE: ACCESS_CODE,
    }),
    null,
  );
  assert.equal(getDevelopmentDemoCredentials({ NODE_ENV: "production" }), null);

  const fallback = readAuthConfig({ NODE_ENV: "test" });
  assert.ok(fallback.accessCode.length >= 12);
  assert.ok(fallback.sessionSecret.length >= 32);
});

test("session tokens verify only with the signing secret and inside their lifetime", () => {
  const token = createSessionToken("staff-user-1", SESSION_SECRET, NOW);
  assert.deepEqual(verifySessionToken(token, SESSION_SECRET, NOW), {
    version: 1,
    userId: "staff-user-1",
    issuedAt: Math.floor(NOW.getTime() / 1000),
    expiresAt: Math.floor(NOW.getTime() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
  assert.equal(
    verifySessionToken(token, "different-session-secret-that-is-long-enough-123", NOW),
    null,
  );

  const [payload, signature] = token.split(".");
  const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
  assert.equal(verifySessionToken(`${tamperedPayload}.${signature}`, SESSION_SECRET, NOW), null);
  assert.equal(
    verifySessionToken(
      token,
      SESSION_SECRET,
      new Date(NOW.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
    ),
    null,
  );
  assert.equal(verifySessionToken("malformed", SESSION_SECRET, NOW), null);
});

test("staff session cookies use restrictive defaults", () => {
  assert.equal(AUTH_COOKIE_NAME, "school_safe_staff_session");
  assert.deepEqual(sessionCookieOptions("production"), {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
  assert.equal(sessionCookieOptions("development").secure, false);
});

test("login validation normalizes email and never echoes credential values", () => {
  assert.deepEqual(
    staffLoginSchema.parse({
      email: "  TEACHER.ONE@EXAMPLE.INVALID ",
      accessCode: ACCESS_CODE,
    }),
    { email: "teacher.one@example.invalid", accessCode: ACCESS_CODE },
  );

  const privateValue = "private-code-that-must-not-be-echoed";
  const result = staffLoginSchema.safeParse({
    email: "not-an-email",
    accessCode: privateValue,
    role: "ADMIN",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const serialized = JSON.stringify(getStaffLoginFieldErrors(result.error));
  assert.equal(serialized.includes(privateValue), false);
});

test("same-origin JSON validation rejects cross-origin and malformed request metadata", () => {
  const valid = new Request("https://school.example/api/auth/login", {
    method: "POST",
    headers: {
      host: "school.example",
      origin: "https://school.example",
      "content-type": "application/json; charset=utf-8",
      "content-length": "2",
    },
    body: "{}",
  });
  assert.equal(validateSameOriginJsonRequest(valid, 128), null);

  for (const [headers, status] of [
    [{ host: "school.example", origin: "https://attacker.invalid", "content-type": "application/json" }, 403],
    [{ host: "school.example", origin: "https://school.example", "content-type": "text/plain" }, 415],
    [{ host: "school.example", origin: "https://school.example", "content-type": "application/json", "content-length": "129" }, 413],
    [{ host: "school.example", origin: "https://school.example", "content-type": "application/json", "content-length": "invalid" }, 400],
  ] as const) {
    const request = new Request("https://school.example/api/auth/login", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(validateSameOriginJsonRequest(request, 128)?.status, status);
  }
});

test("bounded JSON reading rejects malformed and streamed oversized bodies", async () => {
  const good = await readLimitedJson(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ ok: true }),
  }), 64);
  assert.deepEqual(good, { ok: true, value: { ok: true } });

  const malformed = await readLimitedJson(new Request("http://localhost", {
    method: "POST",
    body: "{",
  }), 64);
  assert.equal(malformed.ok, false);

  const oversized = await readLimitedJson(new Request("http://localhost", {
    method: "POST",
    body: "x".repeat(65),
  }), 64);
  assert.deepEqual(oversized, {
    ok: false,
    problem: { status: 413, reason: "too_large" },
  });
});
