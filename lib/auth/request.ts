import "server-only";

export type JsonRequestProblem = {
  status: 400 | 403 | 413 | 415;
  reason: "malformed" | "cross_origin" | "too_large" | "wrong_content_type";
};

export function validateSameOriginJsonRequest(
  request: Request,
  maxBodyBytes: number,
): JsonRequestProblem | null {
  let sameOrigin = false;
  try {
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host");
    const origin = request.headers.get("origin");
    sameOrigin = !!host && !!origin && origin === new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch {
    // Malformed request URL, host, or origin fails closed.
  }
  if (!sameOrigin) return { status: 403, reason: "cross_origin" };

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return { status: 415, reason: "wrong_content_type" };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      return { status: 400, reason: "malformed" };
    }
    if (length > maxBodyBytes) return { status: 413, reason: "too_large" };
  }

  return null;
}

export async function readLimitedJson(
  request: Request,
  maxBodyBytes: number,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; problem: JsonRequestProblem }
> {
  if (!request.body) {
    return { ok: false, problem: { status: 400, reason: "malformed" } };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return { ok: false, problem: { status: 413, reason: "too_large" } };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, problem: { status: 400, reason: "malformed" } };
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, problem: { status: 400, reason: "malformed" } };
  }
}
