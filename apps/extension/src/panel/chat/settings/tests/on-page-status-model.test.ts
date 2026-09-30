// The on-page status setting: it shows the stored preference, and is off
// until the background's relay answers, while a change is saving, and when
// this build has no relay; a change that failed says so.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityFeedSnapshot } from "../../feed";
import { relayState } from "../../tests/activity-fixture";
import { onPageStatusModel } from "../on-page-status-model";

function snapshot(fields: Partial<ActivityFeedSnapshot> = {}): ActivityFeedSnapshot {
  return { reach: "ready", state: relayState([]), overlaySaving: false, ...fields };
}

test("the setting shows the preference, and is off until the relay answers or while a change is saving", () => {
  const model = onPageStatusModel(snapshot({ state: relayState([], { overlay: "collapsed" }) }));
  assert.deepEqual(model.options.map((option) => [option.value, option.label, option.selected]), [
    ["expanded", "Full", false],
    ["collapsed", "Small", true],
    ["hidden", "Off", false]
  ]);
  assert.equal(model.disabled, false);
  for (const reach of ["loading", "failed", "unsupported"] as const) assert.equal(onPageStatusModel(snapshot({ reach })).disabled, true, reach);
  assert.equal(onPageStatusModel(snapshot({ overlaySaving: true })).disabled, true);
  assert.equal(onPageStatusModel(snapshot({ overlayError: "Couldn't." })).error, "Couldn't.");
});
