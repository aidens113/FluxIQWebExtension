// Coverage of overlay-target.ts: the overlay goes to the tab the automation
// drives, and never to an extension page, a browser page or FluxIQ's own web
// panel -- the Lab has all three open beside the scenario tab.

import assert from "node:assert/strict";
import test from "node:test";

import { OverlayTarget, type OverlayTabCandidate, type OverlayTargetDeps } from "../overlay-target";

const SCENARIO = "http://127.0.0.1:51000/scenarios/company-website/";
const PANEL = "http://127.0.0.1:58202/projects/p";
const EXTENSION = "chrome-extension://abcdefghijklmnop/sidepanel/index.html";

type Tabs = Record<number, string>;

function target(tabs: Tabs, fields: { driven?: () => number | undefined; active?: () => number | undefined; activeTabs?: OverlayTabCandidate[] } = {}) {
  const deps: OverlayTargetDeps = {
    drivenTabId: fields.driven ?? (() => undefined),
    activeTabId: fields.active ?? (() => undefined),
    activeTabs: async () => fields.activeTabs ?? [],
    tabUrl: async (tabId) => {
      if (!(tabId in tabs)) throw new Error(`No tab with id: ${tabId}.`);
      return tabs[tabId];
    },
    ownOrigins: () => ["http://127.0.0.1:58202", "ws://127.0.0.1:58203/client"]
  };
  return new OverlayTarget(deps);
}

test("the tab the last runtime command ran in wins over whichever tab is active", async () => {
  const resolver = target({ 1: EXTENSION, 2: SCENARIO, 3: PANEL }, { driven: () => 2, active: () => 3 });
  assert.equal(await resolver.resolve(), 2);
});

test("the driven tab is remembered after the runtime status moves on to a command with no tab", async () => {
  let driven: number | undefined = 2;
  const resolver = target({ 1: EXTENSION, 2: SCENARIO }, { driven: () => driven, active: () => 1 });
  assert.equal(await resolver.resolve(), 2);
  driven = undefined;
  assert.equal(await resolver.resolve(), 2);
});

test("with nothing driven yet, an active extension page or FluxIQ web panel is passed over for the scenario page", async () => {
  assert.equal(await target({ 1: EXTENSION, 2: SCENARIO }, { active: () => 1, activeTabs: [{ id: 1, url: EXTENSION }, { id: 2, url: SCENARIO }] }).resolve(), 2);
  assert.equal(await target({ 3: PANEL, 2: SCENARIO }, { active: () => 3, activeTabs: [{ id: 3, url: PANEL }, { id: 2, url: SCENARIO }] }).resolve(), 2);
  assert.equal(await target({ 2: SCENARIO }, { active: () => 2 }).resolve(), 2, "the active scenario page itself");
});

test("a gateway address on FluxIQ's host counts as FluxIQ's origin", async () => {
  const gatewayPage = "http://127.0.0.1:58203/status";
  assert.equal(await target({ 4: gatewayPage }, { active: () => 4, activeTabs: [{ id: 4, url: gatewayPage }] }).resolve(), undefined);
});

test("browser pages, blank tabs and closed tabs are never targets; a closed driven tab is forgotten", async () => {
  const tabs: Tabs = { 5: "chrome://newtab/", 6: "about:blank", 2: SCENARIO };
  let driven: number | undefined = 9;
  const resolver = target(tabs, { driven: () => driven, active: () => 5, activeTabs: [{ id: 6, url: "about:blank" }, { id: 2, url: SCENARIO }] });
  assert.equal(await resolver.resolve(), 2);
  driven = undefined;
  tabs[9] = SCENARIO;
  assert.equal(await resolver.resolve(), 2, "tab 9 was forgotten when it could not be read");
});

// Moment 8 and screenshot 00013 of the run-murwd8le-79e735a8 UI review: the
// test ran in the scenario tab while a result it opened was in front.
test("every target: the driven tab, and the focused window's front tab when it is another drawable page", async () => {
  const ITEM = "http://127.0.0.1:51000/scenarios/company-website/item/1";
  const resolver = target({ 2: SCENARIO, 4: ITEM, 1: EXTENSION }, { driven: () => 2, active: () => 2, activeTabs: [{ id: 4, url: ITEM }, { id: 1, url: EXTENSION }] });
  assert.deepEqual(await resolver.resolveAll(), [2, 4]);
  assert.deepEqual(await target({ 2: SCENARIO, 1: EXTENSION }, { driven: () => 2, activeTabs: [{ id: 1, url: EXTENSION }] }).resolveAll(), [2], "an extension page in front gets no overlay");
  assert.deepEqual(await target({ 2: SCENARIO }, { driven: () => 2, activeTabs: [{ id: 2, url: SCENARIO }] }).resolveAll(), [2], "the driven tab in front is one target");
  assert.deepEqual(await target({ 3: PANEL }, { activeTabs: [{ id: 3, url: PANEL }] }).resolveAll(), [], "FluxIQ's own panel never");
});

test("no drawable tab anywhere: no target", async () => {
  assert.equal(await target({ 1: EXTENSION }, { active: () => 1, activeTabs: [{ id: 1, url: EXTENSION }] }).resolve(), undefined);
});
