// The look a node run takes before it acts, held against the packet store
// (`../target-packets.ts`) on its own.
//
// Live run `run-muohbi3e-e5847e5a`: the packet the model was shown ended at the
// "Voltbay" brand filter, the look before the next press was cut short at forty
// controls before reaching it, and remembering that look as the page's packet
// made the filter's handle unknown.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_LLM_EVIDENCE_BOUNDS } from "../../limits";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmTargetPackets } from "..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const PAGE = "https://farbazaar.test/search";

/** Captures numbered as the authoring tools number them: one number per control for the whole Flow. */
function captures() {
  const handles = createWebLlmStableTargetHandles();
  return (elements: JsonObject[]) => handles.restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: PAGE, interactiveElements: elements }));
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
  const bound = WEB_LLM_EVIDENCE_BOUNDS.elements;
  // Shown: the whole bound, ending at the filter.
  targets.remember(SCOPE, capture([...buttons(bound - 1, "control"), { tagName: "div", selector: "#voltbay", visibleText: "Voltbay" }]));
  assert.equal(at(targets, `target.${bound}`), "#voltbay");
  // Not shown: a notice first, so the look ends before the filter. The notice
  // is a control the Flow has not numbered yet, so it takes the next number.
  const look = capture([{ tagName: "button", selector: "#allow", visibleText: "Allow" }, ...buttons(bound - 1, "control"), { tagName: "div", selector: "#voltbay", visibleText: "Voltbay" }]);
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
