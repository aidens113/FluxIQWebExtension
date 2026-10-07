import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationRequestPolicies as policies } from "..";

test("omitted policy is closed and frozen", () => {
  assert.deepEqual(policies.normalize(undefined), { enabled: false, allowedOrigins: [], credentials: "omit", redirects: "reject", timeoutMs: 10000, maxResponseBytes: 262144 });
  assert.ok(Object.isFrozen(policies.normalize({})));
  assert.ok(Object.isFrozen(policies.normalize({}).allowedOrigins));
});
test("canonical origins are copied sorted frozen and required when enabled", () => {
  const input = { enabled: true, allowedOrigins: ["https://z.invalid", "https://a.invalid"] };
  const policy = policies.normalize(input);
  input.allowedOrigins.push("https://later.invalid"); input.enabled = false;
  assert.deepEqual(policy.allowedOrigins, ["https://a.invalid", "https://z.invalid"]);
  assert.equal(policy.enabled, true);
  assert.ok(Object.isFrozen(policy.allowedOrigins));
  assert.throws(() => policies.normalize({ enabled: true }));
});
test("only canonical exact HTTPS origins are admitted", () => {
  for (const origin of ["http://a.invalid", "https://a.invalid/", "https://a.invalid/path", "https://a.invalid?x=1", "https://a.invalid#x", "https://user:pass@a.invalid", "https://*.invalid", "https://A.invalid", "https://a.invalid:443", "null", " https://a.invalid"]) {
    assert.throws(() => policies.normalize({ allowedOrigins: [origin] }), origin);
  }
  assert.throws(() => policies.normalize({ allowedOrigins: ["https://a.invalid", "https://a.invalid"] }));
  assert.throws(() => policies.normalize({ allowedOrigins: Array.from({ length: 33 }, (_, i) => `https://a${i}.invalid`) }));
});
test("integer timeout and byte boundaries are enforced", () => {
  for (const [key, min, max] of [["timeoutMs", 1000, 30000], ["maxResponseBytes", 1024, 1048576]] as const) {
    for (const value of [min, max]) assert.equal(policies.normalize({ [key]: value })[key], value);
    for (const value of [min - 1, max + 1, min + 0.5, Infinity, NaN, "1000", null, undefined]) assert.throws(() => policies.normalize({ [key]: value }));
  }
});
test("unsupported credentials redirects values and object envelopes refuse", () => {
  for (const input of [null, [], new Date(), { unknown: false }, { enabled: null }, { enabled: 1 }, { credentials: "include" }, { credentials: null }, { redirects: "follow" }, { allowedOrigins: null }, { enabled: undefined }, { [Symbol("x")]: true }]) assert.throws(() => policies.normalize(input));
  let invoked = 0;
  assert.throws(() => policies.normalize(Object.defineProperty({}, "enabled", { get() { invoked++; return true; } })));
  const array = ["https://a.invalid"];
  Object.defineProperty(array, "0", { get() { invoked++; return "https://a.invalid"; } });
  assert.throws(() => policies.normalize({ allowedOrigins: array }));
  assert.throws(() => policies.normalize({ allowedOrigins: new Array(1) }));
  assert.throws(() => policies.normalize({ allowedOrigins: Object.assign([], { extra: true }) }));
  assert.throws(() => policies.normalize({ allowedOrigins: Object.assign([], { [Symbol("x")]: true }) }));
  assert.equal(invoked, 0);
});
