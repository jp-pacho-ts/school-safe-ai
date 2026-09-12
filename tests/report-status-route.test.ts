import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

import { loadEnvConfig } from "@next/env";
import { NextRequest } from "next/server";

let prisma: typeof import("../lib/prisma")["prisma"] | undefined;
let route: typeof import("../app/api/reports/status/route") | undefined;
const referenceNumber = `SSA-${randomBytes(14).toString("hex").toUpperCase()}`;

function refuseProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Report status route tests must not run in production.");
  }
}

before(async () => {
  refuseProduction();
  loadEnvConfig(process.cwd(), true);
  refuseProduction();
  ({ prisma } = await import("../lib/prisma"));
  route = await import("../app/api/reports/status/route");
  await prisma.report.create({
    data: {
      referenceNumber,
      incidentType: "SAFETY_CONCERN",
      description: "Fictional private route test description.",
      location: "Fictional private route test location",
      incidentDate: new Date("2026-01-15T00:00:00.000Z"),
      isAnonymous: true,
      status: "UNDER_REVIEW",
      statusHistory: {
        create: [
          { status: "SUBMITTED", createdAt: new Date("2026-09-10T01:00:00.000Z") },
          {
            status: "UNDER_REVIEW",
            createdAt: new Date("2026-09-11T02:00:00.000Z"),
            note: "Fictional private route test staff note.",
          },
        ],
      },
    },
  });
});

after(async () => {
  if (prisma) {
    await prisma.report.deleteMany({ where: { referenceNumber } });
    await prisma.$disconnect();
  }
});

function handler() {
  assert.ok(route, "The status route must be initialized.");
  return route.POST;
}

function statusRequest(
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest("http://localhost/api/reports/status", {
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

test("the route exposes POST only", () => {
  assert.ok(route);
  assert.equal("GET" in route, false);
  assert.equal(typeof route.POST, "function");
});

test("rejects cross-origin, wrong-content-type, oversized, and malformed requests", async () => {
  const crossOrigin = await handler()(statusRequest(
    { referenceNumber },
    { origin: "https://attacker.invalid" },
  ));
  assert.equal(crossOrigin.status, 403);

  const wrongType = await handler()(statusRequest(
    { referenceNumber },
    { "content-type": "text/plain" },
  ));
  assert.equal(wrongType.status, 415);

  const oversized = await handler()(statusRequest(
    { referenceNumber },
    { "content-length": "2048" },
  ));
  assert.equal(oversized.status, 413);

  const malformed = await handler()(statusRequest("{"));
  assert.equal(malformed.status, 400);
});

test("returns validation and generic not-found errors without echoing references", async () => {
  const invalid = await handler()(statusRequest({
    referenceNumber: "not-a-reference",
  }));
  assert.equal(invalid.status, 400);
  assert.equal(JSON.stringify(await invalid.json()).includes("not-a-reference"), false);

  const unknownReference = `SSA-${randomBytes(14).toString("hex").toUpperCase()}`;
  const unknown = await handler()(statusRequest({ referenceNumber: unknownReference }));
  assert.equal(unknown.status, 404);
  assert.equal(JSON.stringify(await unknown.json()).includes(unknownReference), false);
});

test("returns only public status data with private response headers", async () => {
  const response = await handler()(statusRequest({
    referenceNumber: `  ${referenceNumber.toLowerCase()}  `,
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");

  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["currentStatus", "history", "referenceNumber"]);
  assert.equal(body.referenceNumber, referenceNumber);
  assert.equal(body.currentStatus, "UNDER_REVIEW");
  assert.deepEqual(
    body.history.map((entry: { status: string }) => entry.status),
    ["SUBMITTED", "UNDER_REVIEW"],
  );
  assert.doesNotMatch(
    JSON.stringify(body),
    /route test description|route test location|route test staff note|reporter|changedBy|submissionKey/i,
  );
});
