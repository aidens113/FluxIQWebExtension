// Coverage of query.ts: every fact kind's grammar, binding resolution, and the
// shapes that are answered `unknown` without ever reaching the page.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationFactQuery } from "../../../actions/fact-check";
import { webAutomationFactQuery } from "../query";

const BUTTON = { selector: "#continue" };

function asked(condition: unknown, context = {}): WebAutomationFactQuery {
  const reading = webAutomationFactQuery(condition, context);
  assert.ok("query" in reading, `expected a query, got ${JSON.stringify(reading)}`);
  return reading.query;
}

function refused(condition: unknown, context = {}): string {
  const reading = webAutomationFactQuery(condition, context);
  assert.ok("unknown" in reading, `expected a refusal, got ${JSON.stringify(reading)}`);
  return reading.unknown;
}

test("state facts take their own word, or equals with a boolean, and absent is exists negated", () => {
  assert.deepEqual(asked({ fact: "exists", op: "exists", target: BUTTON }), { kind: "exists", target: BUTTON, expected: true });
  assert.deepEqual(asked({ fact: "absent", op: "absent", target: BUTTON }), { kind: "exists", target: BUTTON, expected: false });
  assert.deepEqual(asked({ fact: "exists", op: "absent", target: BUTTON }), { kind: "exists", target: BUTTON, expected: false });
  assert.deepEqual(asked({ fact: "visible", op: "visible", target: BUTTON }), { kind: "visible", target: BUTTON, expected: true });
  assert.deepEqual(asked({ fact: "enabled", op: "equals", value: false, target: BUTTON }), { kind: "enabled", target: BUTTON, expected: false });
  assert.deepEqual(asked({ fact: "checked", op: "equals", target: BUTTON }), { kind: "checked", target: BUTTON, expected: true });
  assert.deepEqual(asked({ fact: "selected", op: "equals", value: true, target: BUTTON }), { kind: "selected", target: BUTTON, expected: true });
});

test("a state fact naming no element, or taking an operator it does not, is unsupported", () => {
  assert.equal(refused({ fact: "absent", op: "absent" }), "unsupported");
  assert.equal(refused({ fact: "visible", op: "contains", value: "x", target: BUTTON }), "unsupported");
  assert.equal(refused({ fact: "checked", op: "checked", target: BUTTON }), "unsupported");
  assert.equal(refused({ fact: "enabled", op: "equals", value: "yes", target: BUTTON }), "unsupported");
});

test("text, url and value compare with a literal; text alone may name no element", () => {
  assert.deepEqual(asked({ fact: "text", op: "contains", value: "In stock" }), { kind: "text", comparison: "contains", expected: "In stock" });
  assert.deepEqual(asked({ fact: "url", op: "matches", value: "/s\\?k=" }), { kind: "url", comparison: "matches", expected: "/s\\?k=" });
  assert.deepEqual(asked({ fact: "value", op: "equals", value: 3, target: BUTTON }), { kind: "value", target: BUTTON, comparison: "equals", expected: "3" });
  assert.equal(refused({ fact: "value", op: "equals", value: "x" }), "unsupported");
  assert.equal(refused({ fact: "text", op: "contains", value: "  " }), "unsupported");
  assert.equal(refused({ fact: "url", op: "matches", value: "([" }), "unsupported");
});

test("a Flow input or a bound value is resolved from what Core supplied, and unbound when it supplied none", () => {
  const context = { inputs: { query: "earbuds" }, values: { "$step.read.count": 4 } };
  assert.deepEqual(asked({ fact: "value", op: "equals", value: { input: "query" }, target: BUTTON }, context), { kind: "value", target: BUTTON, comparison: "equals", expected: "earbuds" });
  assert.deepEqual(asked({ fact: "count", op: "count", value: { value: "$step.read.count" }, target: BUTTON }, context), { kind: "count", target: BUTTON, comparison: "=", expected: 4 });
  assert.equal(refused({ fact: "value", op: "equals", value: { input: "missing" }, target: BUTTON }, context), "unbound");
  assert.equal(refused({ fact: "text", op: "contains", value: { value: "$nowhere" } }), "unbound");
});

test("count takes equals with a number, or count with a comparison, and needs a selector", () => {
  assert.deepEqual(asked({ fact: "count", op: "count", value: ">= 3", target: BUTTON }), { kind: "count", target: BUTTON, comparison: ">=", expected: 3 });
  assert.deepEqual(asked({ fact: "count", op: "equals", value: 0, target: BUTTON }), { kind: "count", target: BUTTON, comparison: "=", expected: 0 });
  assert.deepEqual(asked({ fact: "count", op: "count", value: "==2", target: BUTTON }), { kind: "count", target: BUTTON, comparison: "=", expected: 2 });
  assert.equal(refused({ fact: "count", op: "count", value: "about 3", target: BUTTON }), "unsupported");
  assert.equal(refused({ fact: "count", op: "equals", value: 2, target: { element: { tagName: "li" } } }), "unsupported");
});

test("dialog facts name an optional kind in the path and an optional name in the value", () => {
  assert.deepEqual(asked({ fact: "dialog", op: "exists" }), { kind: "dialog", expected: true });
  assert.deepEqual(asked({ fact: "dialog.promotion", op: "absent" }), { kind: "dialog", expected: false, dialogKind: "promotion" });
  assert.deepEqual(asked({ fact: "dialog", op: "contains", value: "Spin to win" }), { kind: "dialog", expected: true, nameContains: "Spin to win" });
  assert.deepEqual(asked({ fact: "dialog.rate_limit", op: "exists", value: "slow down" }), { kind: "dialog", expected: true, dialogKind: "rate_limit", nameContains: "slow down" });
  assert.equal(refused({ fact: "dialog.newsletter", op: "exists" }), "unsupported");
});

test("dialog facts read the form Core's candidate script saves: visible, with the name in a dialog target", () => {
  assert.deepEqual(asked({ fact: "dialog", op: "visible", target: { kind: "dialog", role: "alertdialog", name: "Too fast" } }), { kind: "dialog", expected: true, nameContains: "Too fast" });
  assert.deepEqual(asked({ fact: "dialog", op: "absent", target: { kind: "dialog", role: "dialog", name: "Join us" } }), { kind: "dialog", expected: false, nameContains: "Join us" });
  assert.deepEqual(asked({ fact: "dialog", op: "visible", value: "Spin", target: { kind: "dialog", name: "ignored" } }), { kind: "dialog", expected: true, nameContains: "Spin" });
  assert.deepEqual(asked({ fact: "dialog", op: "visible", target: { kind: "dialog", role: "dialog" } }), { kind: "dialog", expected: true });
  assert.equal(refused({ fact: "dialog", op: "contains" }), "unsupported");
  assert.equal(refused({ fact: "dialog", op: "equals", value: true }), "unsupported");
});

test("a durable target is normalised, its recorded shadow hosts and frame carried", () => {
  const query = asked({
    fact: "visible",
    op: "visible",
    target: { fingerprint: { tagName: "button", testId: "add", context: { shadowHosts: ["store-chooser"] } }, frameId: 2 }
  });
  assert.equal(query.kind, "visible");
  assert.equal(query.frameId, 2);
  assert.ok(query.kind === "visible");
  assert.deepEqual(query.target.shadowHosts, ["store-chooser"]);
  assert.equal(query.target.element?.testId, "add");
  assert.equal(query.target.selector, undefined);
});

test("anything that is not a condition is unsupported, never a guess", () => {
  for (const entry of [null, "exists", { fact: "exists" }, { fact: "exists", op: "near", target: BUTTON }, { fact: "loggedIn", op: "equals", value: true }, { fact: "exists", op: "exists", target: "x" }]) {
    assert.equal(refused(entry), "unsupported");
  }
});
