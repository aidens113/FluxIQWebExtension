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

// t507, company-website (`run-mv6qrcln-2e194a12`, step 0008): a help widget's
// greeting card over a consent sheet's own answers. The press on the sheet's
// answer is rightly refused -- the card takes that click -- but the refusal
// named no closer: the card's "×" carries no cursor or listener of its own (its
// card answers for it), and the card, whose words start with that "×", opens
// the widget when pressed rather than closing it.
const sheetUnderWidget = (extra: Partial<WebLlmEvidenceElement>[] = []) => page([
  { target: "t4", tag: "div", role: "dialog", isDialog: { modal: true, kind: "consent" }, frontLayer: true, box: box(0, 520, 1280, 200) } as Partial<WebLlmEvidenceElement>,
  { target: "t7", tag: "button", name: "Decline optional", parent: "t4", coveredBy: ["t9"], box: box(960, 650, 170, 44) },
  { target: "t9", tag: "div", frontLayer: true, covers: ["t7"], box: box(1280, 720, 0, 0) } as Partial<WebLlmEvidenceElement>,
  { target: "t10", tag: "div", name: "Help", cursor: "pointer", hasClickHandler: true, parent: "t9", box: box(1204, 644, 60, 60) },
  { target: "t11", tag: "div", text: "× Need a hand? Ask our assistant anything.", cursor: "pointer", hasClickHandler: true, parent: "t9", box: box(868, 552, 396, 152) },
  { target: "t12", tag: "div", name: "Close", text: "×", parent: "t11", box: box(1238, 560, 14, 28) },
  ...extra
]);

test("a widget's × inside its pressable card is the widget's closer, and the card whose words start with it is not", () => {
  assert.deepEqual(webCoveredTarget(sheetUnderWidget(), "t7"), { code: "target_covered", target: "t7", covers: ["t9"], closers: ["t12"] });
});

test("only a mark that is nothing but a closing word is pressed through its card, and never one outside the layer", () => {
  const covered = webCoveredTarget(sheetUnderWidget([
    // Words that start like closing inside the card are not a mark of their own.
    { target: "t13", tag: "p", text: "Close the door behind you", parent: "t11", box: box(884, 600, 300, 20) },
    // A "×" in a pressable card on the page itself is not the widget's.
    { target: "t20", tag: "div", text: "Spring offer", cursor: "pointer", hasClickHandler: true, box: box(300, 300, 300, 100) },
    { target: "t21", tag: "div", name: "Close", text: "×", parent: "t20", box: box(580, 305, 14, 28) }
  ]), "t7");
  assert.deepEqual(covered?.closers, ["t12"]);
});

// Classifieds step 0046 (w1-job-classifieds-debug, fix 7): a settings panel the
// model had just changed covered its next press; the refusal said only "close
// it", and the model pressed Cancel, which threw the change away. A layer with
// a control that keeps what was set names it beside the ones that dismiss.
const settingsPanel = (kind: Partial<WebLlmEvidenceElement> = { kind: "promotion" }) => page([
  { target: "t30", tag: "button", name: "Show results", coveredBy: ["t40"], box: box(20, 600, 200, 40) },
  { target: "t40", tag: "div", frontLayer: true, box: box(300, 100, 600, 500), ...kind } as Partial<WebLlmEvidenceElement>,
  { target: "t41", tag: "button", name: "×", box: box(860, 110, 24, 24) },
  { target: "t42", tag: "select", name: "Sort by", box: box(340, 200, 300, 40) },
  { target: "t43", tag: "button", name: "Save 20% with a plan", box: box(340, 300, 300, 40) },
  { target: "t44", tag: "button", name: "Cancel", box: box(560, 540, 140, 40) },
  { target: "t45", tag: "button", name: "Apply", box: box(720, 540, 140, 40) }
]);

test("a layer that both keeps and discards a change names the control that keeps it first, then the ones that dismiss", () => {
  assert.deepEqual(webCoveredTarget(settingsPanel(), "t30")?.closers, ["t45", "t41", "t44"]);
});

test("a confirming word inside a longer name is not a confirming control, and a consent layer's OK is never one", () => {
  assert.deepEqual(webCoveredTarget(settingsPanel(), "t30")?.closers.includes("t43"), false);
  const consent = page([
    { target: "t30", tag: "button", name: "Show results", coveredBy: ["t40"], box: box(20, 600, 200, 40) },
    { target: "t40", tag: "div", kind: "consent", frontLayer: true, box: box(300, 100, 600, 500) } as Partial<WebLlmEvidenceElement>,
    { target: "t46", tag: "button", name: "OK", box: box(720, 540, 140, 40) },
    { target: "t47", tag: "button", name: "Reject all", box: box(560, 540, 140, 40) }
  ]);
  assert.deepEqual(webCoveredTarget(consent, "t30")?.closers, ["t47"]);
});
