import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../rate-limit.mjs";

test("limits per address and frees the window after it passes", () => {
  let t = 1000;
  const l = createRateLimiter({ perIp: 2, total: 100, windowMs: 60_000, now: () => t });
  assert.equal(l.check("a").ok, true);
  assert.equal(l.check("a").ok, true);
  const r = l.check("a");
  assert.equal(r.ok, false);
  assert.ok(r.retryAfterSec >= 1 && r.retryAfterSec <= 60);
  assert.equal(l.check("b").ok, true, "another address is unaffected");
  t += 60_001;
  assert.equal(l.check("a").ok, true);
});

test("limits the total across addresses", () => {
  const l = createRateLimiter({ perIp: 10, total: 3, windowMs: 60_000, now: () => 5 });
  assert.equal(l.check("a").ok, true);
  assert.equal(l.check("b").ok, true);
  assert.equal(l.check("c").ok, true);
  assert.equal(l.check("d").ok, false);
});
