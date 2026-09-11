import assert from "node:assert/strict";
import test from "node:test";
import type { FrameLocator, Locator } from "@playwright/test";
import { locateTarget, type TargetScope } from "../locate-target.js";
import { parseScenarioTarget } from "../parse-target.js";

/** Records how a target was resolved as a readable path instead of touching a browser. */
function fakeScope(label = "page"): TargetScope {
  return {
    locator: (selector) => ({ path: `${label}.locator(${selector})` }) as unknown as Locator,
    getByRole: (role, options) => ({ path: `${label}.getByRole(${role},${JSON.stringify(options)})` }) as unknown as Locator,
    frameLocator: (selector) => fakeScope(`${label}.frame(${selector})`) as unknown as FrameLocator,
  };
}

const pathOf = (target: string) => (locateTarget(fakeScope(), parseScenarioTarget(target)) as unknown as { path: string }).path;

test("test ids and raw CSS resolve through locator()", () => {
  assert.equal(pathOf("testid:plan"), 'page.locator([data-testid="plan"])');
  assert.equal(pathOf("tbody tr:first-child"), "page.locator(tbody tr:first-child)");
});

test("roles resolve through getByRole with an exact accessible name when one is given", () => {
  assert.equal(pathOf("role:button:Add"), 'page.getByRole(button,{"name":"Add","exact":true})');
  assert.equal(pathOf("role:dialog"), "page.getByRole(dialog,{})");
});

test("frame targets resolve inside the iframe with that title, across origins and nesting", () => {
  assert.equal(pathOf("frame:Cross-origin checkout/testid:cross-frame-action"), 'page.frame(iframe[title="Cross-origin checkout"]).locator([data-testid="cross-frame-action"])');
  assert.equal(pathOf("frame:Outer/frame:Inner/role:button:Pay"), 'page.frame(iframe[title="Outer"]).frame(iframe[title="Inner"]).getByRole(button,{"name":"Pay","exact":true})');
});
