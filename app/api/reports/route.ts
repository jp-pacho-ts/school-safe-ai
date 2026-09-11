import { NextRequest, NextResponse } from "next/server";

import { RECEIPT_COOKIE, submitReport } from "@/lib/reports/submit";
import { getReportFieldErrors, reportInputSchema } from "@/lib/reports/validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  // This endpoint intentionally accepts unauthenticated student reports only.
  // It never accepts account IDs, roles, status changes, or history supplied by callers.
  // NextURL normalizes loopback IPs to localhost. Preserve the actual HTTP host.
  let sameOrigin = false;
  try {
    const host = request.headers.get("host");
    sameOrigin = !!host && request.headers.get("origin") ===
      new URL(`${request.nextUrl.protocol}//${host}`).origin;
  } catch {
    // Malformed host/origin fails closed.
  }
  if (!sameOrigin) {
    return json({ message: "Open the report form on this website to submit." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ message: "Send the report using the reporting form." }, 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return json({ message: "The report is too large. Shorten the description and try again." }, 413);
  }

  let raw: unknown;
  try {
    if (!request.body) return json({ message: "Report details are required." }, 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return json({ message: "The report is too large. Shorten the description and try again." }, 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return json({ message: "The report could not be read. Check the details and try again." }, 400);
  }

  const validated = reportInputSchema.safeParse(raw);
  if (!validated.success) {
    return json({
      message: "Check the report details and try again.",
      fieldErrors: getReportFieldErrors(validated.error),
    }, 400);
  }

  try {
    // Import here so missing/unavailable database configuration gets a safe response.
    const { prisma } = await import("@/lib/prisma");
    const result = await submitReport(validated.data, prisma);
    if (!result.ok) {
      const status = { validation: 400, conflict: 409, unavailable: 503 }[result.reason];
      return json({ message: result.message, fieldErrors: result.fieldErrors }, status);
    }

    const response = json({ referenceNumber: result.referenceNumber }, result.replayed ? 200 : 201);
    response.cookies.set(RECEIPT_COOKIE, result.submissionKey, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/report/success",
      maxAge: 60 * 60,
    });
    return response;
  } catch {
    return json({
      message: "We couldn’t confirm your submission. Keep this page open and retry with the same details.",
    }, 503);
  }
}
