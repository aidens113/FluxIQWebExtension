// Which controls the page an act left shows only inside a layer the page raised by itself (t499, `../page-raised.ts`),
// read off the capture's own layer marks. The whole path, through exploration and the signer, is held in
// `../../tests/act-effect.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement, WebLlmPageEvidence } from "../../..";
import { webAutomationRouteLayerOnlyHashes, webAutomationRouteState } from "../../../../route-state";
import { webLlmPageRaisedNames } from "..";

type Layered = Pick<WebLlmPageEvidence, "blockedBy" | "dialogs">;

function capture(document: number, elements: readonly Partial<WebLlmEvidenceElement>[], layers: Layered = {}): WebLlmPageEvidence {
  return {
    location: "https://recipes.test/recipes/lemon-tart",
    navigation: { type: "navigate", timeOrigin: document },
    elements: elements.map((element, index) => ({ target: `t${index + 1}`, tag: "div", ...element })),
    ...layers
  } as unknown as WebLlmPageEvidence;
}

const PAGE: Partial<WebLlmEvidenceElement>[] = [
  { tag: "a", text: "All recipes" },
  { tag: "button", text: "My box: 1 recipe" },
  { tag: "button", text: "Close" }
];
/** A bubble at t4, its control under it by `parent`, and a "Close" that the page proper also shows. */
const BUBBLE: Partial<WebLlmEvidenceElement>[] = [
  { tag: "div", covers: ["t1"] },
  { hasClickHandler: true, text: "Need help? ×", parent: "t4" },
  { tag: "button", text: "Close", parent: "t5" }
];
const AFTER = [...PAGE, ...BUBBLE];

test("on a new document a covering layer is the page's: its own controls are named, a name the page also shows is not", () => {
  const names = webLlmPageRaisedNames(capture(1, PAGE), capture(2, AFTER, { blockedBy: [{ target: "t4", blocks: 1 }] }));
  assert.deepEqual([...names], [...webAutomationRouteLayerOnlyHashes(["Need help? ×"], [])]);
});

test("on the same document only a layer of a recognised kind is the page's", () => {
  assert.equal(webLlmPageRaisedNames(capture(1, PAGE), capture(1, AFTER, { blockedBy: [{ target: "t4", blocks: 1 }] })).size, 0);
  assert.equal(webLlmPageRaisedNames(capture(1, PAGE), capture(1, AFTER, { blockedBy: [{ target: "t4", blocks: 1, kind: "assistant" }] })).size, 1);
  // The kind can be on the element's own mark as well as on the page's list.
  const marked = AFTER.map((element, index) => (index === 3 ? { ...element, kind: "promotion" as const } : element));
  assert.equal(webLlmPageRaisedNames(capture(1, PAGE), capture(1, marked)).size, 1);
  // Without both documents known, nothing is taken as a new one.
  assert.equal(webLlmPageRaisedNames(undefined, capture(2, AFTER, { blockedBy: [{ target: "t4", blocks: 1 }] })).size, 0);
});

test("a dialog's controls are its own by `inDialog` as well as by the tree", () => {
  const after = capture(2, [...PAGE, { tag: "div", isDialog: { modal: true } }, { tag: "button", text: "Serves 6", inDialog: "t4" }]);
  assert.deepEqual([...webLlmPageRaisedNames(capture(1, PAGE), after)], [...webAutomationRouteLayerOnlyHashes(["Serves 6"], [])]);
});

test("controls are named as the route state names them, so every hash is one of the page's own", () => {
  const after = capture(2, [...PAGE, { tag: "div", covers: ["t1"] }, { hasClickHandler: true, text: "Need help?×", readable: "Need help? ×", parent: "t4" }, { tag: "button", text: "Hidden", hidden: true, parent: "t4" }]);
  const names = webLlmPageRaisedNames(capture(1, PAGE), after);
  const listed = webAutomationRouteLayerOnlyHashes(String((webAutomationRouteState(after).page as Record<string, unknown>).controls).split(" | "), []);
  assert.equal(names.size, 1);
  for (const hash of names) assert.ok(listed.has(hash), "a name the route state lists");
});
