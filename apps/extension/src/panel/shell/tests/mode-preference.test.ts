// The remembered route: Simple unless Advanced was stored, and an Advanced tab
// only when it is one of the four the audit names.

import assert from "node:assert/strict";
import test from "node:test";
import { ADVANCED_TAB_KEY, MODE_KEY, routeFromStored } from "../mode-preference";

test("nothing stored, or anything but advanced, is Simple", () => {
  assert.deepEqual(routeFromStored({}), { mode: "simple" });
  assert.deepEqual(routeFromStored({ [MODE_KEY]: "simple", [ADVANCED_TAB_KEY]: "connection" }), { mode: "simple" });
  assert.deepEqual(routeFromStored({ [MODE_KEY]: "ADVANCED" }), { mode: "simple" });
});

test("advanced keeps a known tab and falls back to Activity otherwise", () => {
  assert.deepEqual(routeFromStored({ [MODE_KEY]: "advanced", [ADVANCED_TAB_KEY]: "connection" }), { mode: "advanced", tab: "connection" });
  assert.deepEqual(routeFromStored({ [MODE_KEY]: "advanced", [ADVANCED_TAB_KEY]: "settings" }), { mode: "advanced", tab: "activity" });
  assert.deepEqual(routeFromStored({ [MODE_KEY]: "advanced" }), { mode: "advanced", tab: "activity" });
});
