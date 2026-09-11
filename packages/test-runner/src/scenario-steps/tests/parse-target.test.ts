import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { parseScenarioTarget } from "../parse-target.js";

test("reads test ids, roles with and without an accessible name, and raw CSS", () => {
  assert.deepEqual(parseScenarioTarget("testid:plan"), { kind: "testid", id: "plan" });
  assert.deepEqual(parseScenarioTarget("role:button:Save changes"), { kind: "role", role: "button", name: "Save changes" });
  assert.deepEqual(parseScenarioTarget("role:link:Open: details"), { kind: "role", role: "link", name: "Open: details" });
  assert.deepEqual(parseScenarioTarget("role:dialog"), { kind: "role", role: "dialog" });
  assert.deepEqual(parseScenarioTarget('[data-testid="inventory-row"]:first-child'), { kind: "css", selector: '[data-testid="inventory-row"]:first-child' });
});

test("reads the older role:<role>[name=<name>] spelling the same way", () => {
  assert.deepEqual(parseScenarioTarget("role:button[name=Submit synthetic values]"), { kind: "role", role: "button", name: "Submit synthetic values" });
});

test("reads frame targets, including nested frames and roles inside them", () => {
  assert.deepEqual(parseScenarioTarget("frame:Cross-origin checkout/testid:cross-frame-action"), {
    kind: "frame", title: "Cross-origin checkout", inner: { kind: "testid", id: "cross-frame-action" },
  });
  assert.deepEqual(parseScenarioTarget("frame:Outer/frame:Inner/role:button:Pay"), {
    kind: "frame", title: "Outer", inner: { kind: "frame", title: "Inner", inner: { kind: "role", role: "button", name: "Pay" } },
  });
});

test("rejects malformed targets as fixture errors", () => {
  for (const text of [undefined, "", "  ", "testid:", "role:", "role:Button", "role:button:", "frame:No separator", "frame:/testid:x", "frame:Title/"]) {
    assert.throws(() => parseScenarioTarget(text), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid", String(text));
  }
});
