import { NextRequest, NextResponse } from "next/server";

import { readAuthConfig } from "@/lib/auth/config";
import {
  readLimitedJson,
  validateSameOriginJsonRequest,
} from "@/lib/auth/request";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { authenticateStaff } from "@/lib/auth/staff";
import {
  getStaffLoginFieldErrors,
  staffLoginSchema,
} from "@/lib/auth/validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 2048;
const INVALID_CREDENTIALS_MESSAGE =
  "We couldn\u2019t sign you in. Check your staff details and try again.";

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function POST(request: NextRequest) {
  const requestProblem = validateSameOriginJsonRequest(request, MAX_BODY_BYTES);
  if (requestProblem) {
    const messages = {
      cross_origin: "Open the staff sign-in page on this website to continue.",
      wrong_content_type: "Sign in using the staff sign-in form.",
      too_large: "The sign-in request is too large.",
      malformed: "The sign-in request could not be read. Try again.",
    };
    return json({ message: messages[requestProblem.reason] }, requestProblem.status);
  }

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return json(
      {
        message: body.problem.reason === "too_large"
          ? "The sign-in request is too large."
          : "The sign-in request could not be read. Try again.",
      },
      body.problem.status,
    );
  }

  const validated = staffLoginSchema.safeParse(body.value);
  if (!validated.success) {
    return json({
      message: "Check your staff details and try again.",
      fieldErrors: getStaffLoginFieldErrors(validated.error),
    }, 400);
  }

  try {
    const config = readAuthConfig();
    const staff = await authenticateStaff(validated.data, undefined, config);
    if (!staff) return json({ message: INVALID_CREDENTIALS_MESSAGE }, 401);

    const response = json({ ok: true }, 200);
    response.cookies.set(
      AUTH_COOKIE_NAME,
      createSessionToken(staff.id, config.sessionSecret),
      sessionCookieOptions(),
    );
    return response;
  } catch {
    return json({
      message: "Staff sign-in is temporarily unavailable. Please try again.",
    }, 503);
  }
}
