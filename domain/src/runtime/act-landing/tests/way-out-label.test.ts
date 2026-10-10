// A pressed control's name says it is only a way out (t430): a close, a "Not
// now", a close glyph -- never a choice that lasts, and never a label that also
// names something a person owns or a verb that acts on the world.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationIsWayOutLabel } from "../way-out-label";

test("names that only close what they sit on are ways out", () => {
  for (const name of ["Not now", "not now", "Close", "Close chat", "  Close   dialog ", "×", "✕", "X", "Dismiss", "Minimize", "Minimise", "No thanks", "No, thank you", "Maybe later", "Remind me later", "Got it"]) {
    assert.equal(webAutomationIsWayOutLabel(name), true, name);
  }
});

test("a lasting choice, a commit, or a way-out phrase carrying a consequential word is not", () => {
  for (const name of ["Confirm", "Decline", "Reject", "OK", "Hide post", "Not interested", "Skip", "Allow all cookies", "Close account", "Closeout sale", "Dismiss and delete", "No thanks, cancel my subscription", "Get coupons", "", undefined]) {
    assert.equal(webAutomationIsWayOutLabel(name), false, String(name));
  }
});
