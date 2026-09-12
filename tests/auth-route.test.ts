import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";
import { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "../lib/auth/session";

const TEST_ACCESS_CODE = "auth-route-test-access-code";
const TEST_SESSION_SECRET = "auth-route-test-session-secret-12345678901234567890";
const suffix = randomBytes(8).toString("hex");
const teacherEmail = `auth-teacher-${suffix}@example.invalid`;
const studentEmail = `auth-student-${suffix}@example.invalid`;
const adminEmail = `auth-admin-${suffix}@example.invalid`;
const teacherId = `auth-test-teacher-${suffix}`;
const studentId = `auth-test-student-${suffix}`;
const adminId = `auth-test-admin-${suffix}`;

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;
let loginRoute: typeof import("../app/api/auth/login/route") | undefined;
let logoutRoute: typeof import("../app/api/auth/logout/route") | undefined;
let getStaffFromRequest: typeof import("../lib/auth/staff")["getStaffFromRequest"] | undefined;
const previousAccessCode = process.env.STAFF_ACCESS_CODE;
const previousSessionSecret = process.env.AUTH_SESSION_SECRET;

function refuseProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Staff authentication route tests must not run in production.");
  }
}

before(async () => {
  refuseProduction();
  loadEnvConfig(process.cwd(), true);
  refuseProduction();
  process.env.STAFF_ACCESS_CODE = TEST_ACCESS_CODE;
  process.env.AUTH_SESSION_SECRET = TEST_SESSION_SECRET;

  ({ prisma } = await import("../lib/prisma"));
  loginRoute = await import("../app/api/auth/login/route");
  logoutRoute = await import("../app/api/auth/logout/route");
  ({ getStaffFromRequest } = await import("../lib/auth/staff"));

  await prisma.user.createMany({
    data: [
      { id: teacherId, email: teacherEmail, name: "Fictional Auth Teacher", role: "TEACHER" },
      { id: studentId, email: studentEmail, name: "Fictional Auth Student", role: "STUDENT" },
      { id: adminId, email: adminEmail, name: "Fictional Auth Administrator", role: "ADMIN" },
    ],
  });
});

after(async () => {
  if (prisma) {
    await prisma.user.deleteMany({ where: { id: { in: [teacherId, studentId, adminId] } } });
    await prisma.$disconnect();
  }
  if (previousAccessCode === undefined) delete process.env.STAFF_ACCESS_CODE;
  else process.env.STAFF_ACCESS_CODE = previousAccessCode;
  if (previousSessionSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = previousSessionSecret;
});

function loginHandler() {
  assert.ok(loginRoute);
  return loginRoute.POST;
}

function logoutHandler() {
  assert.ok(logoutRoute);
  return logoutRoute.POST;
}

function authRequest(
  path: "/api/auth/login" | "/api/auth/logout",
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("authentication routes expose POST only", () => {
  assert.ok(loginRoute);
  assert.ok(logoutRoute);
  assert.equal("GET" in loginRoute, false);
  assert.equal("GET" in logoutRoute, false);
  assert.equal(typeof loginRoute.POST, "function");
  assert.equal(typeof logoutRoute.POST, "function");
});

test("login rejects cross-origin, non-JSON, oversized, and malformed requests", async () => {
  const crossOrigin = await loginHandler()(authRequest(
    "/api/auth/login",
    { email: teacherEmail, accessCode: TEST_ACCESS_CODE },
    { origin: "https://attacker.invalid" },
  ));
  assert.equal(crossOrigin.status, 403);

  const wrongType = await loginHandler()(authRequest(
    "/api/auth/login",
    { email: teacherEmail, accessCode: TEST_ACCESS_CODE },
    { "content-type": "text/plain" },
  ));
  assert.equal(wrongType.status, 415);

  const oversized = await loginHandler()(authRequest(
    "/api/auth/login",
    { email: teacherEmail, accessCode: TEST_ACCESS_CODE },
    { "content-length": "2049" },
  ));
  assert.equal(oversized.status, 413);

  const malformed = await loginHandler()(authRequest("/api/auth/login", "{"));
  assert.equal(malformed.status, 400);
});

test("login uses the same generic response for bad code, unknown user, and student role", async () => {
  const attempts = [
    { email: teacherEmail, accessCode: "wrong-access-code" },
    { email: `unknown-${suffix}@example.invalid`, accessCode: TEST_ACCESS_CODE },
    { email: studentEmail, accessCode: TEST_ACCESS_CODE },
  ];
  const bodies: unknown[] = [];

  for (const attempt of attempts) {
    const response = await loginHandler()(authRequest("/api/auth/login", attempt));
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.doesNotMatch(JSON.stringify(body), new RegExp(suffix, "i"));
    assert.doesNotMatch(JSON.stringify(body), /wrong-access-code|auth-route-test/i);
    bodies.push(body);
  }
  assert.deepEqual(bodies[0], bodies[1]);
  assert.deepEqual(bodies[1], bodies[2]);
});

test("valid staff login issues a signed restrictive cookie and fresh role checks revoke it", async () => {
  assert.ok(prisma);
  assert.ok(getStaffFromRequest);
  const response = await loginHandler()(authRequest("/api/auth/login", {
    email: teacherEmail.toUpperCase(),
    accessCode: TEST_ACCESS_CODE,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\//i);
  assert.match(setCookie, /Max-Age=28800/i);
  assert.doesNotMatch(setCookie, new RegExp(TEST_ACCESS_CODE, "i"));
  assert.doesNotMatch(setCookie, new RegExp(teacherEmail, "i"));

  const token = setCookie.match(new RegExp(`^${AUTH_COOKIE_NAME}=([^;]+)`))?.[1];
  assert.ok(token);
  const protectedRequest = new Request("http://localhost/api/dashboard", {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
  });
  assert.deepEqual(
    await getStaffFromRequest(protectedRequest, prisma),
    { id: teacherId, email: teacherEmail, name: "Fictional Auth Teacher", role: "TEACHER" },
  );

  await prisma.user.update({ where: { id: teacherId }, data: { role: "STUDENT" } });
  assert.equal(await getStaffFromRequest(protectedRequest, prisma), null);
  await prisma.user.update({ where: { id: teacherId }, data: { role: "TEACHER" } });
});

test("administrator records are also authorized to sign in", async () => {
  const response = await loginHandler()(authRequest("/api/auth/login", {
    email: adminEmail,
    accessCode: TEST_ACCESS_CODE,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`^${AUTH_COOKIE_NAME}=`));
});

test("logout requires same-origin JSON and expires the staff cookie", async () => {
  const crossOrigin = await logoutHandler()(authRequest(
    "/api/auth/logout",
    {},
    { origin: "https://attacker.invalid" },
  ));
  assert.equal(crossOrigin.status, 403);

  const response = await logoutHandler()(authRequest("/api/auth/logout", {}));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
  assert.match(setCookie, /Max-Age=0/i);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
});
