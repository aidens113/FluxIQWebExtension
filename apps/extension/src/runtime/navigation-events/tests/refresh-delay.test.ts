// The delay a `<meta http-equiv="refresh">` declares (task speed S10): its
// leading seconds, `0` for an address alone, nothing for anything else.

import assert from "node:assert/strict";
import test from "node:test";
import { declaredRefreshDelayMs } from "../refresh-delay";

test("a refresh's delay is its leading seconds, and an address alone is at once", () => {
  assert.equal(declaredRefreshDelayMs("2;url=https://jobs.test/out"), 2_000);
  assert.equal(declaredRefreshDelayMs(" 0.5 , url=/next"), 500);
  assert.equal(declaredRefreshDelayMs(";url=/next"), 0);
});

test("content that names no delay declares nothing", () => {
  for (const content of [null, undefined, "soon", "url=/next"]) assert.equal(declaredRefreshDelayMs(content), undefined, String(content));
});
