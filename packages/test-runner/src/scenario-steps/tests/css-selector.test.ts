import assert from "node:assert/strict";
import test from "node:test";
import { cssSelectorForTarget } from "../css-selector.js";
import { parseScenarioTarget } from "../parse-target.js";

test("test ids and raw CSS project to one top-document selector", () => {
  assert.equal(cssSelectorForTarget(parseScenarioTarget("testid:name")), '[data-testid="name"]');
  assert.equal(cssSelectorForTarget(parseScenarioTarget("#notes")), "#notes");
});

test("role and frame targets have no single CSS selector", () => {
  assert.equal(cssSelectorForTarget(parseScenarioTarget("role:textbox:Password")), undefined);
  assert.equal(cssSelectorForTarget(parseScenarioTarget("frame:Checkout/testid:pay")), undefined);
});
