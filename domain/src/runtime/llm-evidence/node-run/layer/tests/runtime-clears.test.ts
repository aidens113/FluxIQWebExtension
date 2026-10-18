// Whether the runtime's own popup defence clears what covers a control
// (`../runtime-clears.ts`, `run-mvcxf4uz-64cd322c`). The shape of that
// run: a consent bar's decline under a promotion modal whose "×" and
// "No thanks" close it and whose "Collect all" does not.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { webCoveredTarget } from "../../covered-target";
import { webRuntimeClearsLayers } from "..";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function page(elements: Partial<WebLlmEvidenceElement>[]): WebLlmPageEvidence {
  return { elements } as unknown as WebLlmPageEvidence;
}

/** The consent bar at the foot of the page, its decline `t474` covered by the modal `t476` and its controls. */
function underModal(controls: Partial<WebLlmEvidenceElement>[], modal: Partial<WebLlmEvidenceElement> = { kind: "promotion" }): WebLlmPageEvidence {
  return page([
    { target: "t470", tag: "div", kind: "consent", frontLayer: true, coveredBy: ["t476"], box: box(0, 600, 1280, 120) } as Partial<WebLlmEvidenceElement>,
    { target: "t471", tag: "p", text: "We use cookies to improve this site.", coveredBy: ["t476"], box: box(20, 620, 600, 20) },
    { target: "t473", tag: "button", name: "Accept all", coveredBy: ["t476"], box: box(900, 650, 150, 40) },
    { target: "t474", tag: "button", name: "Reject non-essential", coveredBy: ["t476"], box: box(1060, 650, 200, 40) },
    { target: "t476", tag: "div", frontLayer: true, box: box(0, 0, 1280, 720), ...modal } as Partial<WebLlmEvidenceElement>,
    { target: "t479", tag: "h2", text: "Members save on every order", box: box(380, 140, 300, 30) },
    ...controls
  ]);
}

const clears = (evidence: WebLlmPageEvidence, own?: (layer: string) => boolean): boolean => {
  const covered = webCoveredTarget(evidence, "t474");
  assert.ok(covered, "the decline is covered");
  return webRuntimeClearsLayers(evidence, covered.covers, own);
};

const glyph = { target: "t478", tag: "div", text: "×", cursor: "pointer", box: box(900, 110, 24, 24) } as Partial<WebLlmEvidenceElement>;
const collectAll = { target: "t487", tag: "button", name: "Collect all", box: box(380, 420, 200, 40) } as Partial<WebLlmEvidenceElement>;
const noThanks = { target: "t488", tag: "button", name: "No thanks", box: box(600, 420, 200, 40) } as Partial<WebLlmEvidenceElement>;

test("a modal whose close glyph or No thanks the runtime presses is cleared by it, so the press under it is sent (run-mvcxf4uz-64cd322c)", () => {
  assert.equal(clears(underModal([glyph, collectAll, noThanks])), true);
  assert.equal(clears(underModal([collectAll, noThanks])), true, "No thanks alone");
  assert.equal(clears(underModal([glyph, collectAll])), true, "the glyph alone");
});

test("a modal whose only control answers it, confirms, or carries a consequential word is not cleared, so the press stays refused (C4)", () => {
  assert.equal(clears(underModal([collectAll])), false, "Collect all is no way out");
  assert.equal(clears(underModal([{ target: "t488", tag: "button", name: "Apply", box: box(600, 420, 200, 40) }])), false, "Apply confirms");
  assert.equal(clears(underModal([{ target: "t488", tag: "button", name: "Done", box: box(600, 420, 200, 40) }])), false, "Done confirms");
  assert.equal(clears(underModal([{ target: "t488", tag: "button", name: "Close account", box: box(600, 420, 200, 40) }])), false, "a dismissal word cannot carry a consequence");
  assert.equal(clears(underModal([])), false, "no control at all");
});

test("a layer only a person answers is never cleared, whatever closes it", () => {
  assert.equal(clears(underModal([glyph, noThanks], { kind: "robot_check" })), false, "a robot check");
  assert.equal(clears(underModal([glyph, noThanks, { target: "t480", tag: "h3", text: "Sign in to see your offers", box: box(380, 180, 300, 30) }])), false, "a sign-in");
  assert.equal(clears(underModal([glyph, { target: "t480", tag: "p", text: "Enter the verification code we sent you", box: box(380, 180, 300, 30) }])), false, "a one-time code");
  assert.equal(clears(underModal([glyph, { target: "t480", tag: "p", text: "Confirm your payment to continue", box: box(380, 180, 300, 30) }])), false, "a payment");
});

test("a consent layer is cleared by its least-consent answer, and only a consent layer is", () => {
  const decline = { target: "t488", tag: "button", name: "Reject all", box: box(600, 420, 200, 40) } as Partial<WebLlmEvidenceElement>;
  const accept = { target: "t487", tag: "button", name: "Accept all", box: box(380, 420, 200, 40) } as Partial<WebLlmEvidenceElement>;
  assert.equal(clears(underModal([accept, decline], { kind: "consent" })), true);
  assert.equal(clears(underModal([accept, decline, { target: "t480", tag: "p", text: "We value your privacy", box: box(380, 180, 300, 30) }], { kind: "promotion" })), true, "known by its words");
  assert.equal(clears(underModal([accept, decline])), false, "Reject on any other layer is an answer, not a way out");
  assert.equal(clears(underModal([accept], { kind: "consent" })), false, "accepting is never a way out");
});

test("a rate-limit notice is cleared by its OK, and OK closes nothing else", () => {
  const ok = { target: "t488", tag: "button", name: "OK", box: box(600, 420, 200, 40) } as Partial<WebLlmEvidenceElement>;
  assert.equal(clears(underModal([ok], { kind: "rate_limit" })), true);
  assert.equal(clears(underModal([ok])), false);
});

test("a layer a press of this build opened is never cleared by the runtime", () => {
  assert.equal(clears(underModal([glyph, noThanks]), (layer) => layer === "t476"), false);
  assert.equal(clears(underModal([glyph, noThanks]), (layer) => layer === "t470"), true, "the layer holding the target is not the cover");
});

test("more covers than the runtime clears in one go are not all cleared", () => {
  const covers = ["t901", "t902", "t903", "t904"];
  const evidence = page([
    { target: "t1", tag: "button", name: "Search", coveredBy: covers, box: box(10, 10, 80, 30) },
    ...covers.flatMap((cover, index) => [
      { target: cover, tag: "div", kind: "promotion", box: box(100 * index, 100, 90, 90) } as Partial<WebLlmEvidenceElement>,
      { target: `${cover}c`, tag: "button", name: "Close", parent: cover } as Partial<WebLlmEvidenceElement>
    ])
  ]);
  const covered = webCoveredTarget(evidence, "t1");
  assert.ok(covered);
  assert.equal(webRuntimeClearsLayers(evidence, covered.covers), false);
  assert.equal(webRuntimeClearsLayers(evidence, covers.slice(0, 3)), true);
});
