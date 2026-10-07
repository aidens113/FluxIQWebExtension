import assert from "node:assert/strict";
import test from "node:test";
import { proveChatBuild } from "../chat-build.js";
test("unavailable probe never touches chat, controls, screenshots or provider", async () => {
  const touched: string[] = [];
  const forbidden = new Proxy({}, { get: (_target, key) => { touched.push(String(key)); throw new Error("Unexpected access"); } });
  const result = await proveChatBuild(forbidden as never, forbidden as never);
  assert.equal(result.result.build.failure?.code, "lab.candidate_verification_unavailable");
  assert.equal(result.result.build.providerInvocation, "not_attempted");
  assert.equal(result.checks.qualificationAvailable, false);
  assert.equal(result.result.applied, null);
  assert.deepEqual(touched, []);
});
