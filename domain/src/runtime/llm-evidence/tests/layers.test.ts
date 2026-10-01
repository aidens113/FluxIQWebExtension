// What stands in front of the page is marked on each element's own entry, in
// document order (t200, `../layers.ts`). The packet stopped moving a modal's
// controls to the front, and these hold that the model is still told, element
// by element, which one is the dialog, which one is the wall, what the wall
// covers and what sits inside the dialog.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, sanitizeWebLlmSnapshotWithBindings } from "../sanitize";
import { createWebLlmStableTargetHandles } from "../stable-handles";
import { webLlmStateDigest } from "../state-digest";
import type { WebLlmEvidenceElement } from "../elements";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

/**
 * A consent wall: a full-viewport backdrop holding a modal dialog, over the
 * page's own buttons. "Buy now" sits under the dialog's box as well as under
 * the backdrop, which is the case geometry alone gets wrong.
 */
const consentWall = (): Record<string, unknown> => ({
  url: "https://shop.test/product/42",
  title: "Kettle",
  interactiveElements: [
    { tagName: "a", selector: "#home", visibleText: "Home", bounds: box(0, 0, 50, 20) },
    { tagName: "button", selector: "#add", visibleText: "Add to cart", bounds: box(100, 300, 120, 40) },
    { tagName: "button", selector: "#buy", visibleText: "Buy now", bounds: box(300, 300, 120, 40) },
    { tagName: "div", selector: "#backdrop", bounds: box(0, 0, 1280, 800), frontLayer: true },
    { tagName: "div", selector: "#consent", role: "dialog", accessibleName: "We value your privacy", bounds: box(200, 200, 400, 300), frontLayer: true },
    { tagName: "p", selector: "#consent-text", visibleText: "We and our partners use cookies.", bounds: box(220, 240, 360, 60), frontLayer: true, leadStatement: true },
    { tagName: "button", selector: "#accept", visibleText: "Accept all", bounds: box(250, 400, 120, 40), frontLayer: true },
    { tagName: "button", selector: "#reject", visibleText: "Reject all", bounds: box(430, 400, 120, 40), frontLayer: true },
    { tagName: "a", selector: "#privacy", visibleText: "Privacy policy", bounds: box(0, 900, 100, 20) }
  ],
  evidence: {
    dialogs: {
      modal: true,
      open: [{ selector: "#consent", role: "dialog", modal: true, native: false, label: "We value your privacy", bounds: box(200, 200, 400, 300), kind: "consent" }]
    },
    overlays: {
      tested: 7,
      blockedCount: 3,
      // `#newsletter` is covered too, and is not among the elements described.
      blockers: [{ selector: "#backdrop", blocks: 3, blocked: ["#add", "#buy", "#newsletter"], bounds: box(0, 0, 1280, 800), kind: "consent" }]
    }
  }
});

const named = (elements: readonly WebLlmEvidenceElement[], words: string): WebLlmEvidenceElement => {
  const element = elements.find((candidate) => (candidate.name ?? candidate.text) === words);
  assert.ok(element, `no element reads ${words}`);
  return element;
};

test("a consent wall keeps document order, and every element says what it is to the wall", () => {
  const evidence = sanitizeWebLlmSnapshot(consentWall());
  const { elements } = evidence;
  // Document order, and every element in it: nothing was moved to the front.
  assert.deepEqual(elements.map((element) => element.target), Array.from({ length: 9 }, (_, index) => `t${index + 1}`));
  assert.deepEqual(elements.map((element) => element.name ?? element.text ?? element.tag), ["Home", "Add to cart", "Buy now", "div", "We value your privacy", "We and our partners use cookies.", "Accept all", "Reject all", "Privacy policy"]);

  // The dialog is marked on itself.
  const dialog = named(elements, "We value your privacy");
  assert.deepEqual(dialog.isDialog, { modal: true, kind: "consent" });
  assert.equal(dialog.inDialog, undefined, "a dialog does not sit inside itself");

  // The backdrop covers the page's buttons, by handle, and says how many it covers in all.
  const backdrop = elements[3];
  assert.deepEqual(backdrop?.covers, ["t2", "t3"]);
  assert.equal(backdrop?.coversCount, 3);
  assert.equal(backdrop?.kind, "consent");

  // The covered buttons name what covers them, and are not inside the dialog --
  // "Buy now" included, though its centre is under the dialog's box.
  for (const words of ["Add to cart", "Buy now"]) {
    const covered = named(elements, words);
    assert.deepEqual(covered.coveredBy, ["t4"], words);
    assert.equal(covered.inDialog, undefined, words);
  }

  // What the dialog holds is marked with the dialog's handle.
  for (const words of ["We and our partners use cookies.", "Accept all", "Reject all"]) {
    assert.equal(named(elements, words).inDialog, dialog.target, words);
    assert.equal(named(elements, words).coveredBy, undefined, words);
  }

  // Outside the wall altogether: nothing is marked.
  for (const words of ["Home", "Privacy policy"]) {
    const element = named(elements, words);
    assert.deepEqual([element.isDialog, element.inDialog, element.covers, element.coveredBy, element.frontLayer], [undefined, undefined, undefined, undefined, undefined], words);
  }
});

test("the page-level dialog and blocker name the same elements by handle, with their kind", () => {
  const evidence = sanitizeWebLlmSnapshot(consentWall());
  assert.deepEqual(evidence.dialogs, [{ role: "dialog", name: "We value your privacy", modal: true, target: "t5", kind: "consent" }]);
  assert.deepEqual(evidence.blockedBy, [{ blocks: 3, target: "t4", kind: "consent" }]);
  assert.doesNotMatch(JSON.stringify(evidence), /#consent|#backdrop|#newsletter/u, "no selector reaches the packet");
});

test("the capture's front-layer and lead-statement flags are carried on the element", () => {
  const { elements } = sanitizeWebLlmSnapshot(consentWall());
  assert.deepEqual(elements.filter((element) => element.frontLayer).map((element) => element.target), ["t4", "t5", "t6", "t7", "t8"]);
  assert.deepEqual(elements.filter((element) => element.statement).map((element) => element.target), ["t6"]);
  const results = sanitizeWebLlmSnapshot({
    url: "https://shop.test/search?q=widget",
    interactiveElements: [{ tagName: "h1", selector: "#lead", visibleText: "No results for \"widget\"", leadStatement: true }]
  }).elements[0];
  assert.equal(results?.statement, true);
  // A flag that is not literally true is not a flag.
  const loose = sanitizeWebLlmSnapshot({ url: "https://shop.test/", interactiveElements: [{ tagName: "p", selector: "#p", visibleText: "x", frontLayer: "true", leadStatement: 1 }] }).elements[0];
  assert.equal("frontLayer" in (loose ?? {}), false);
  assert.equal("statement" in (loose ?? {}), false);
});

test("a non-modal dialog is marked, native and kind included, and holds nothing by `inDialog`", () => {
  const { elements, dialogs } = sanitizeWebLlmSnapshot({
    url: "https://shop.test/",
    interactiveElements: [
      { tagName: "dialog", selector: "#chat", accessibleName: "Chat with us", bounds: box(900, 500, 300, 250) },
      { tagName: "button", selector: "#chat-close", visibleText: "Close chat", bounds: box(1150, 510, 40, 20) }
    ],
    evidence: { dialogs: { modal: false, open: [{ selector: "#chat", role: "dialog", modal: false, native: true, label: "Chat with us", bounds: box(900, 500, 300, 250), kind: "assistant" }] } }
  });
  assert.deepEqual(elements[0]?.isDialog, { modal: false, native: true, kind: "assistant" });
  assert.equal(elements[1]?.inDialog, undefined);
  assert.deepEqual(dialogs, [{ role: "dialog", name: "Chat with us", target: "t1", kind: "assistant" }]);
});

test("a robot check in a child frame is joined to its own frame's element, never to the top frame's", () => {
  const { elements, dialogs, blockedBy } = sanitizeWebLlmSnapshot({
    url: "https://shop.test/",
    interactiveElements: [
      { tagName: "div", selector: "#check", visibleText: "Top frame div", bounds: box(0, 0, 10, 10) },
      { tagName: "div", selector: "frame[7] >> #check", accessibleName: "Verify you are human", attributes: { "data-fluxiq-frame-id": "7" }, bounds: box(400, 200, 400, 300) },
      { tagName: "button", selector: "frame[7] >> #go", visibleText: "I am human", attributes: { "data-fluxiq-frame-id": "7" }, bounds: box(500, 400, 100, 30) },
      { tagName: "button", selector: "#search", visibleText: "Search", bounds: box(420, 250, 80, 30) }
    ],
    evidence: {
      dialogs: { modal: true, open: [{ selector: "frame[7] >> #check", role: "dialog", modal: true, native: false, label: "Verify you are human", bounds: box(400, 200, 400, 300), kind: "robot_check" }] },
      overlays: { tested: 2, blockedCount: 1, blockers: [{ selector: "frame[7] >> #check", blocks: 1, blocked: ["#search"], kind: "robot_check" }] }
    }
  });
  assert.equal(elements[0]?.isDialog, undefined, "the top frame's #check is another element");
  assert.deepEqual(elements[1]?.isDialog, { modal: true, kind: "robot_check" });
  assert.equal(elements[1]?.frameId, 7);
  assert.deepEqual(elements[1]?.covers, ["t4"]);
  assert.equal(elements[1]?.kind, "robot_check");
  assert.equal(elements[2]?.inDialog, "t2");
  assert.deepEqual(elements[3]?.coveredBy, ["t2"]);
  assert.equal(elements[3]?.inDialog, undefined);
  assert.equal(dialogs?.[0]?.target, "t2");
  assert.equal(blockedBy?.[0]?.target, "t2");
});

test("a blocker the capture did not describe covers by count, and a kind the contract does not name is not carried", () => {
  const { elements, blockedBy } = sanitizeWebLlmSnapshot({
    url: "https://shop.test/",
    interactiveElements: [{ tagName: "button", selector: "#save", visibleText: "Save", bounds: box(10, 10, 50, 20) }],
    evidence: { overlays: { tested: 1, blockedCount: 1, blockers: [{ selector: "#toast", role: "status", label: "Saved", blocks: 1, blocked: ["#save"], kind: "banner" }] } }
  });
  // No handle to name, so no `coveredBy`; the page-level blocker still says it.
  assert.equal(elements[0]?.coveredBy, undefined);
  assert.deepEqual(blockedBy, [{ role: "status", name: "Saved", blocks: 1 }]);
});

test("a blocker whose covered controls are all outside the packet carries only its count", () => {
  const { elements } = sanitizeWebLlmSnapshot({
    url: "https://shop.test/",
    interactiveElements: [{ tagName: "div", selector: "#promo", visibleText: "Sale!", bounds: box(0, 600, 1280, 200) }],
    evidence: { overlays: { tested: 4, blockedCount: 2, blockers: [{ selector: "#promo", blocks: 2, blocked: ["#a", "#b"], kind: "promotion" }] } }
  });
  assert.equal(elements[0]?.covers, undefined);
  assert.equal(elements[0]?.coversCount, 2);
  assert.equal(elements[0]?.kind, "promotion");
});

test("a recapture renumbers the layer marks with the elements, and the state digest does not see the numbers", () => {
  const handles = createWebLlmStableTargetHandles();
  const scope = { projectId: "p", flowId: "f" };
  // Another page first, so this page's elements are not numbered from one.
  handles.restamp(scope, sanitizeWebLlmSnapshotWithBindings({
    url: "https://shop.test/",
    interactiveElements: Array.from({ length: 5 }, (_, index) => ({ tagName: "a", selector: `#nav${index}`, visibleText: `Nav ${index}` }))
  }));
  const binding = sanitizeWebLlmSnapshotWithBindings(consentWall());
  const restamped = handles.restamp(scope, binding);
  const { elements, dialogs, blockedBy } = restamped.evidence;
  const byTarget = new Map(elements.map((element) => [element.target, element]));
  const wordsOf = (handle: string | undefined) => {
    const element = handle === undefined ? undefined : byTarget.get(handle);
    return element?.name ?? element?.text ?? element?.tag;
  };
  const backdrop = elements[3];
  assert.equal(backdrop?.target, "t9");
  assert.deepEqual(backdrop?.covers?.map(wordsOf), ["Add to cart", "Buy now"]);
  assert.deepEqual(named(elements, "Buy now").coveredBy?.map(wordsOf), ["div"]);
  assert.equal(wordsOf(named(elements, "Accept all").inDialog), "We value your privacy");
  assert.equal(wordsOf(dialogs?.[0]?.target), "We value your privacy");
  assert.equal(blockedBy?.[0]?.target, backdrop?.target);
  // The binding passed in is left as it was.
  assert.deepEqual(binding.evidence.elements[3]?.covers, ["t2", "t3"]);
  assert.equal(binding.evidence.dialogs?.[0]?.target, "t5");
  assert.equal(webLlmStateDigest(restamped.evidence), webLlmStateDigest(binding.evidence));
});

test("a wall appearing changes the state digest, though no element's words changed", () => {
  const walled = consentWall();
  const clear = consentWall();
  delete clear.evidence;
  assert.notEqual(webLlmStateDigest(sanitizeWebLlmSnapshot(walled)), webLlmStateDigest(sanitizeWebLlmSnapshot(clear)));
});
