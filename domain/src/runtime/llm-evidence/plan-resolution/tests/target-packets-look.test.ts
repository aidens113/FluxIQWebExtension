// The look a node run takes before it acts, held against the packet store
// (`../target-packets.ts`) on its own.
//
// Live run `run-muohbi3e-e5847e5a`: the packet the model was shown ended at the
// "Voltbay" brand filter, the look before the next press was cut short at forty
// controls before reaching it, and remembering that look as the page's packet
// made the filter's handle unknown.
//
// Since t200 a look is never cut to a count of controls, so the only look cut
// short is one the browser's capture itself says it cut (`captureTruncated`).
// The rule is the same: such a look adds handles and forgets none.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmTargetPackets } from "..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const PAGE = "https://farbazaar.test/search";

/** The live packet's length, which is where that run's look was cut. */
const LIVE_PACKET_LENGTH = 40;

/**
 * Captures numbered as the authoring tools number them: one number per control
 * for the whole Flow. `cut` is a capture the browser says it cut short.
 */
function captures() {
  const handles = createWebLlmStableTargetHandles();
  return (elements: JsonObject[], cut = false) => handles.restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: PAGE, interactiveElements: elements, truncated: cut }));
}

function buttons(count: number, prefix: string): JsonObject[] {
  return Array.from({ length: count }, (_, index) => ({ tagName: "button", selector: `#${prefix}-${index + 1}`, visibleText: `${prefix} ${index + 1}` }));
}

function at(targets: ReturnType<typeof createWebLlmTargetPackets>, handle: string): string {
  const resolution = targets.resolve(SCOPE, handle, PAGE);
  return resolution.ok ? resolution.selector : resolution.code;
}

test("a look cut short forgets no handle the page had, and adds its own", () => {
  const targets = createWebLlmTargetPackets();
  const capture = captures();
  const bound = LIVE_PACKET_LENGTH;
  // Shown: a packet ending at the filter.
  targets.remember(SCOPE, capture([...buttons(bound - 1, "control"), { tagName: "div", selector: "#voltbay", visibleText: "Voltbay" }]));
  assert.equal(at(targets, `target.${bound}`), "#voltbay");
  // Not shown: a notice first, and a capture the browser cut before the
  // filter. The notice is a control the Flow has not numbered yet, so it takes
  // the next number.
  const look = capture([{ tagName: "button", selector: "#allow", visibleText: "Allow" }, ...buttons(bound - 1, "control")], true);
  assert.equal(look.evidence.truncated, true);
  targets.rememberLook(SCOPE, look);
  assert.equal(at(targets, `target.${bound}`), "#voltbay", "the filter the model was shown is still pressable");
  assert.equal(at(targets, `target.${bound + 1}`), "#allow", "what the look described is pressable too");
  assert.equal(at(targets, "target.1"), "#control-1");
});

test("a look that described the whole page replaces the page's handles, as a shown packet does", () => {
  const targets = createWebLlmTargetPackets();
  const capture = captures();
  targets.remember(SCOPE, capture(buttons(2, "control")));
  const look = capture(buttons(1, "control"));
  assert.equal(look.evidence.truncated, false);
  targets.rememberLook(SCOPE, look);
  assert.equal(at(targets, "target.1"), "#control-1");
  assert.equal(at(targets, "target.2"), "unknown", "a control a complete look did not describe has left the page");
});
