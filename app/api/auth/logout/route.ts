import { NextRequest, NextResponse } from "next/server";

import {
  readLimitedJson,
  validateSameOriginJsonRequest,
} from "@/lib/auth/request";
import {
  AUTH_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 128;

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
    return json(
      { message: "Sign out using the staff dashboard on this website." },
      requestProblem.status,
    );
  }

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (
    !body.ok ||
    !body.value ||
    typeof body.value !== "object" ||
    Array.isArray(body.value) ||
    Object.keys(body.value).length !== 0
  ) {
    return json({ message: "The sign-out request could not be read. Try again." }, 400);
  }

  const response = json({ ok: true }, 200);
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
