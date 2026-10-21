import assert from "node:assert/strict";
import test from "node:test";
import { snapshotCanaries } from "../canaries.js";

test("a document gets a body handler canary and a script canary at the end of its body", () => {
  const armed = snapshotCanaries.arm("<html><head></head><body class=\"x\"><p>a</p></body></html>");
  assert.equal(armed, "<html><head></head><body onload=\"document.documentElement.setAttribute('data-snapshot-handler','ran')\" class=\"x\"><p>a</p>"
    + "<script>document.documentElement.setAttribute('data-snapshot-canary','ran')</script></body></html>");
});

test("a document without a body still gets the script canary, at its end", () => {
  assert.equal(snapshotCanaries.arm("<p>a</p>"), "<p>a</p><script>document.documentElement.setAttribute('data-snapshot-canary','ran')</script>");
});

test("the attributes read back are the two the canaries set", () => {
  assert.deepEqual([...snapshotCanaries.attributes], ["data-snapshot-canary", "data-snapshot-handler"]);
});
