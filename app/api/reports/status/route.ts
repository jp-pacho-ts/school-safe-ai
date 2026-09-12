import { NextRequest, NextResponse } from "next/server";

import { lookupReportStatus } from "@/lib/reports/status";
import {
  getStatusLookupFieldError,
  statusLookupInputSchema,
} from "@/lib/reports/status-validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024;

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
  // A reference grants access only to public status data. Keep it out of URLs,
  // reject cross-origin callers, and never accept status changes from this route.
  let sameOrigin = false;
  try {
    const host = request.headers.get("host");
    sameOrigin = !!host && request.headers.get("origin") ===
      new URL(`${request.nextUrl.protocol}//${host}`).origin;
  } catch {
    // Malformed host/origin fails closed.
  }
  if (!sameOrigin) {
    return json({ message: "Open the status page on this website to check a report." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ message: "Check the report using the status form." }, 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return json({ message: "The status request is too large." }, 413);
  }

  let raw: unknown;
  try {
    if (!request.body) return json({ message: "A reference number is required." }, 400);
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
          return json({ message: "The status request is too large." }, 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return json({ message: "The status request could not be read. Try again." }, 400);
  }

  const validated = statusLookupInputSchema.safeParse(raw);
  if (!validated.success) {
    const fieldError = getStatusLookupFieldError(validated.error);
    return json({
      message: "Check the reference number and try again.",
      fieldErrors: fieldError ? { referenceNumber: fieldError } : undefined,
    }, 400);
  }

  try {
    // Import after validation so malformed requests never initialize the database.
    const { prisma } = await import("@/lib/prisma");
    const result = await lookupReportStatus(validated.data, prisma);
    if (!result.ok) {
      const status = { validation: 400, not_found: 404, unavailable: 503 }[result.reason];
      return json({
        message: result.message,
        fieldErrors: result.fieldError
          ? { referenceNumber: result.fieldError }
          : undefined,
      }, status);
    }
    return json(result.report, 200);
  } catch {
    return json({
      message: "Status lookup is temporarily unavailable. Please try again.",
    }, 503);
  }
}
