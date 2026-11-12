import assert from "node:assert/strict";
import test from "node:test";
import { cleanEnvironment } from "../clean-environment.js";

test("variables that carry a credential are dropped and the rest are kept", () => {
  const cleaned = cleanEnvironment({ PATH: "p", Path: "q", HOME: "h", SOME_API_KEY: "k", Aws_Secret_Access_Key: "s", AWS_SESSION_TOKEN: "t", HF_TOKEN: "t", DB_PASSWORD: "x", MISSING: undefined });
  assert.deepEqual(Object.keys(cleaned).sort(), ["HOME", "PATH", "Path"]);
});
