// The route state's controls list names each control as a reader sees it
// (U-B3-3, lane B round 3, `run-mux6pndp-16feb842`). A size chip drawn as two
// stacked lines -- its name, and its price in a block child -- has a `name`
// and a `text` that run the two together, because both are read as
// `textContent` is, and those two stay as they are: a recorded fingerprint and
// a target's identity compare them. The capture sends the spaced words beside
// them as `readable`, and the page view already printed those; the controls
// list read `name ?? text` and listed "12 Double Rolls$16.47".
//
// The proofs are that a control whose name or text differs from `readable` by
// spacing alone is listed by `readable`, and that a name from anywhere else --
// an authored label -- is listed as written, whatever `readable` says.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement, WebLlmPageEvidence } from "../../llm-evidence";
import { webAutomationRouteState } from "..";

function evidence(elements: readonly Partial<WebLlmEvidenceElement>[]): WebLlmPageEvidence {
  return {
    location: "https://shop.test/ip/paper-towels/1",
    title: "Paper Towels",
    elements: elements.map((element, index) => ({ target: `t${index + 1}`, tag: "div", ...element }))
  } as unknown as WebLlmPageEvidence;
}

function controls(elements: readonly Partial<WebLlmEvidenceElement>[]): unknown {
  const page = webAutomationRouteState(evidence(elements)).page as Record<string, unknown>;
  return page.controls;
}

test("a control whose name and price are separate blocks is listed with a space between them", () => {
  assert.equal(controls([
    { hasClickHandler: true, name: "6 Double Rolls$8.97", readable: "6 Double Rolls $8.97" },
    { hasClickHandler: true, text: "12 Double Rolls$16.47", readable: "12 Double Rolls $16.47" }
  ]), "6 Double Rolls $8.97 | 12 Double Rolls $16.47");
});

test("a control with no readable words beside its name is listed by its name, as written", () => {
  assert.equal(controls([{ tag: "button", name: "Double Rolls" }]), "Double Rolls");
});

test("an authored name is listed as written, not replaced by readable words that say something else", () => {
  assert.equal(controls([{ tag: "button", name: "Close dialog", readable: "× Close" }]), "Close dialog");
});
