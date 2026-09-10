import assert from "node:assert/strict";
import test from "node:test";

import { parseServerEnv } from "../lib/env-schema";

test("accepts PostgreSQL URLs and supplies the development default", () => {
  for (const scheme of ["postgres", "postgresql"]) {
    const url = `${scheme}://user:password@localhost:5432/school_safe_ai`;
    assert.deepEqual(parseServerEnv({ DATABASE_URL: url }), {
      DATABASE_URL: url,
      NODE_ENV: "development",
    });
  }
});

test("rejects missing, malformed, non-PostgreSQL, or incomplete database URLs", () => {
  for (const url of [undefined, "", "   ", "not-a-url", "https://host/db", "postgresql://host"]) {
    assert.throws(() => parseServerEnv({ DATABASE_URL: url }), /DATABASE_URL/);
  }
});

test("rejects invalid modes without including secrets in errors", () => {
  const secret = "credential-that-must-not-be-logged";
  assert.throws(
    () => parseServerEnv({ DATABASE_URL: `invalid://${secret}@host/db`, NODE_ENV: "unknown" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /DATABASE_URL/);
      assert.match(error.message, /NODE_ENV/);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});