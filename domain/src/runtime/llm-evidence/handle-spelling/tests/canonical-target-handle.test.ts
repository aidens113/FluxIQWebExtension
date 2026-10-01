// `canonicalWebLlmTargetHandle`: the one spelling of a target handle (t223).
//
// The domain mints `tN`; a model may still write the old `target.N`. Both name
// one element, so both come back as `tN`, and nothing that is not a handle in
// either spelling is turned into one.

import assert from "node:assert/strict";
import test from "node:test";
import { canonicalWebLlmTargetHandle } from "../..";

test("either spelling of a handle comes back as `tN`", () => {
  assert.equal(canonicalWebLlmTargetHandle("t12"), "t12");
  assert.equal(canonicalWebLlmTargetHandle("target.12"), "t12");
  assert.equal(canonicalWebLlmTargetHandle("t999999"), "t999999");
  assert.equal(canonicalWebLlmTargetHandle("target.999999"), "t999999");
});

test("nothing outside the numbers the domain issues is a handle, in either spelling", () => {
  for (const value of ["t0", "target.0", "t07", "target.07", "t1000000", "target.1000000", "12", "t", "target.", "tx", "T12", "target12", "t.12", " t12", "extraction.1", "explored.2:t3", 12, undefined, null, {}]) {
    assert.equal(canonicalWebLlmTargetHandle(value), undefined, JSON.stringify(value));
  }
});
