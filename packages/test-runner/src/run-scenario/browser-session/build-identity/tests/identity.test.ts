import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertIdentityMatch, screenIdentity } from "../index.js";
const stamp = { schema: 1, target: "e2e-chromium", version: "0.1.0", protocol: "fluxiq.build-identity.v1", inputsDigest: "a".repeat(64), coreInputsDigest: "b".repeat(64), domainInputsDigest: "c".repeat(64) };
test("matched immutable background/content stamps admit dispatch", () => assert.doesNotThrow(() => assertIdentityMatch(stamp, stamp, stamp)));
for (const field of ["target", "protocol", "inputsDigest", "coreInputsDigest", "domainInputsDigest", "version"]) {
  for (const side of ["background", "content", "disk"]) test(`${side} ${field} mismatch refuses before provider dispatch`, () => {
    const mismatch = { ...stamp, [field]: field.endsWith("Digest") ? "d".repeat(64) : "different" };
    let providerCalls = 0;
    assert.throws(() => { assertIdentityMatch(side === "disk" ? mismatch : stamp, side === "background" ? mismatch : stamp, side === "content" ? mismatch : stamp); providerCalls++; }, /provider dispatch refused/);
    assert.equal(providerCalls, 0);
  });
}
test("missing/legacy/malformed stamps refuse; report screens additional fields", () => {
  for (const absent of [null, undefined, {}, { ...stamp, inputsDigest: "private" }]) assert.throws(() => assertIdentityMatch(stamp, absent, stamp));
  assert.deepEqual(screenIdentity({ ...stamp, token: "private", page: "private" }), stamp);
});

test("scenario runner verifies loaded content before any chat or recording dispatch", async () => {
  const source = await readFile(fileURLToPath(new URL("../../../../../src/run-scenario.ts", import.meta.url)), "utf8");
  const check = source.indexOf("await verifyRunningBuildIdentity(");
  assert.ok(check > source.indexOf("await openScenarioStart(page, topology.scenarioOrigin, scenario)"));
  assert.ok(check < source.indexOf("const chat = buildEntry"));
  assert.ok(check < source.indexOf('type: "fluxiq.startRecording"'));
});
