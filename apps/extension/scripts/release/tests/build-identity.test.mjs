import assert from "node:assert/strict";
import test from "node:test";
import { buildIdentity } from "../build-identity.mjs";
test("identity names exact inputs and independently names reached Core/domain contracts", () => {
  const input = { target: "chrome", version: "0.1", inputs: { "src/a": "a", "../!FluxIQ/packages/a": "b", "domain/src/a": "c" } };
  const first = buildIdentity(input);
  assert.deepEqual(first, buildIdentity({ ...input, inputs: Object.fromEntries(Object.entries(input.inputs).reverse()) }));
  const changed = buildIdentity({ ...input, inputs: { ...input.inputs, "../!FluxIQ/packages/a": "changed" } });
  assert.notEqual(first.inputsDigest, changed.inputsDigest);
  assert.notEqual(first.coreInputsDigest, changed.coreInputsDigest);
  assert.equal(first.domainInputsDigest, changed.domainInputsDigest);
});
