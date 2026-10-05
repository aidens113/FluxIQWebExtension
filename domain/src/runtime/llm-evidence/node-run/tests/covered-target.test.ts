// What covers a control, and which of the cover's own controls close it
// (`../covered-target.ts`). Crossborder's `run-muqc07fh-eeffbc86` step 0018: the
// search field under a "Welcome back" coupon popup whose "×" and "No thanks"
// close it, and whose "Collect all" does not.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webCoveredTarget } from "../covered-target";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function page(elements: Partial<WebLlmEvidenceElement>[]): WebLlmPageEvidence {
  return { elements } as unknown as WebLlmPageEvidence;
}

const popup = (extra: Partial<WebLlmEvidenceElement>[] = []) => page([
  { target: "t489", tag: "input", coveredBy: ["t476"], box: box(300, 20, 400, 40) },
  { target: "t476", tag: "div", kind: "promotion", frontLayer: true, box: box(340, 100, 600, 400) } as Partial<WebLlmEvidenceElement>,
  { target: "t478", tag: "div", text: "×", cursor: "pointer", box: box(900, 110, 24, 24) },
  { target: "t479", tag: "h2", text: "Welcome back, Mara!", box: box(380, 140, 300, 30) },
  { target: "t487", tag: "button", name: "Collect all", box: box(380, 420, 200, 40) },
  { target: "t488", tag: "button", name: "No thanks", box: box(600, 420, 200, 40) },
  ...extra
]);

test("names the cover and the controls inside it that close it, in page order, and not the one that answers it", () => {
  assert.deepEqual(webCoveredTarget(popup(), "t489"), { code: "target_covered", target: "t489", covers: ["t476"], closers: ["t478", "t488"] });
});

test("a control the cover paints over, or one outside its box, is not its own; one under it by parent is", () => {
  const covered = webCoveredTarget(popup([
    { target: "t20", tag: "a", name: "Close account", coveredBy: ["t476"], box: box(400, 200, 100, 20) },
    { target: "t30", tag: "button", name: "Dismiss", box: box(10, 600, 80, 30) },
    { target: "t31", tag: "button", name: "Close", parent: "t476" }
  ]), "t489");
  assert.deepEqual(covered?.closers, ["t478", "t488", "t31"]);
});

// Cause 9 of `run-musq0b1m-0472cfa0` (step 0032): a cookie layer named no
// closer, so the model chose "Accept all", a consent the person never gave.
// Information only: the model may still press anything; the refusal only
// names the controls that close the layer while consenting to nothing.
const cookies = (kind: Partial<WebLlmEvidenceElement>, extra: Partial<WebLlmEvidenceElement>[] = []) => page([
  { target: "t1042", tag: "button", name: "Add to cart", coveredBy: ["t1067"], box: box(900, 600, 200, 40) },
  { target: "t1067", tag: "div", frontLayer: true, box: box(0, 500, 1280, 220), ...kind } as Partial<WebLlmEvidenceElement>,
  { target: "t1069", tag: "h2", text: "We value your privacy", box: box(20, 510, 300, 30) },
  { target: "t1071", tag: "a", name: "Cookie policy", box: box(20, 560, 100, 20) },
  { target: "t1073", tag: "button", name: "Manage choices", box: box(700, 650, 150, 40) },
  { target: "t1074", tag: "button", name: "Reject non-essential", box: box(870, 650, 180, 40) },
  { target: "t1075", tag: "button", name: "Accept all", box: box(1060, 650, 150, 40) },
  ...extra
]);

test("a consent layer's refusal names its least-consent closer, never its accept-all control", () => {
  assert.deepEqual(webCoveredTarget(cookies({ kind: "consent" }), "t1042"), { code: "target_covered", target: "t1042", covers: ["t1067"], closers: ["t1074"] });
});

test("a consent dialog names every way to close it that consents to nothing, refusals first, and no accept or agree", () => {
  const covered = webCoveredTarget(cookies({ isDialog: { modal: false, kind: "consent" } }, [
    { target: "t1080", tag: "button", name: "Agree and close", box: box(20, 650, 150, 40) },
    { target: "t1081", tag: "button", name: "Got it", box: box(200, 650, 100, 40) },
    { target: "t1082", tag: "button", name: "Necessary only", box: box(320, 650, 150, 40) },
    { target: "t1083", tag: "button", label: "Close", text: "×", box: box(1240, 505, 24, 24) }
  ]), "t1042");
  assert.deepEqual(covered?.closers, ["t1074", "t1082", "t1083"]);
});

test("a consent layer's \"Continue without accepting\" is a least-consent closer, though it starts like a consent", () => {
  const covered = webCoveredTarget(cookies({ kind: "consent" }, [
    { target: "t1084", tag: "a", name: "Continue without accepting", box: box(20, 690, 200, 20) }
  ]), "t1042");
  assert.deepEqual(covered?.closers, ["t1074", "t1084"]);
});

test("a layer that is not a consent layer keeps its plain closers: Reject is not read as closing it", () => {
  assert.deepEqual(webCoveredTarget(cookies({ kind: "promotion" }), "t1042")?.closers, []);
});
