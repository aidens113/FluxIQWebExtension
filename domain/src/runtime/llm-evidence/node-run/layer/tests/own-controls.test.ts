// A fixed help-desk chat panel over a store page: the covered press is refused
// naming the panel's own controls, its header's icon-only collapse button first,
// and never the links inside it as controls (`../own-controls.ts`;
// `run-mvswfjbq-d0a95f6e`, the covered feedback that named message threads).

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { rejectionDetail } from "../../../tool-rejection";
import { webCoveredTarget } from "../../covered-target";
import { webLayerOwnControls } from "../index";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const page = (elements: Partial<WebLlmEvidenceElement>[]): WebLlmPageEvidence => ({ elements } as unknown as WebLlmPageEvidence);

const store = page([
  { target: "t10", tag: "button", name: "Add to cart", coveredBy: ["t20"], box: box(900, 600, 200, 40) },
  { target: "t20", tag: "aside", frontLayer: true, name: "Help desk", box: box(860, 300, 400, 420) },
  { target: "t21", tag: "h2", text: "Help desk", box: box(880, 310, 200, 30) },
  { target: "t22", tag: "button", attributes: [["aria-label", "Minimise"]], name: "Minimise", box: box(1200, 310, 28, 28) },
  { target: "t23", tag: "a", name: "Order status", href: "/orders", box: box(880, 400, 300, 30) },
  { target: "t24", tag: "a", name: "Returns policy", href: "/returns", box: box(880, 440, 300, 30) },
  { target: "t25", tag: "a", name: "Shipping times", href: "/shipping", box: box(880, 480, 300, 30) },
  { target: "t26", tag: "button", text: "Send", name: "Send", box: box(1150, 660, 80, 30) }
]);

test("the icon-only header button is named first with its handle, and the links are not its controls", () => {
  const covered = webCoveredTarget(store, "t10");
  assert.equal(covered?.covers[0], "t20");
  assert.deepEqual(webLayerOwnControls(store, "t20", covered?.closers), [
    "t22 (a control with no words in the layer's header)",
    "t26 (a button)"
  ]);
});

test("the refusal's next names the icon button and its handle, and says the links are content", () => {
  const detail = rejectionDetail({
    reason: "covered_by_layer", target: "t10", instead: ["t20"], missing: undefined, requestId: undefined, closeWith: [],
    layerControls: webLayerOwnControls(store, "t20", [])
  });
  assert.deepEqual(detail.layerControls, ["t22 (a control with no words in the layer's header)", "t26 (a button)"]);
  assert.match(detail.next ?? "", /Close, collapse or answer that layer first with one of its own controls\. t20's own controls, header first: t22 \(a control with no words in the layer's header\); t26 \(a button\)\./u);
  assert.doesNotMatch(detail.next ?? "", /Order status|t23|t24|t25/u);
  assert.match(detail.next ?? "", /links and rows inside the layer are its content/u);
});

test("a layer with closers still names the other own controls after them", () => {
  const withClose = page([...(store.elements as Partial<WebLlmEvidenceElement>[]), { target: "t27", tag: "button", name: "Close", box: box(1230, 310, 28, 28) }]);
  const covered = webCoveredTarget(withClose, "t10");
  assert.deepEqual(covered?.closers, ["t27"]);
  assert.deepEqual(webLayerOwnControls(withClose, "t20", covered?.closers), ["t22 (a control with no words in the layer's header)", "t26 (a button)"]);
});
