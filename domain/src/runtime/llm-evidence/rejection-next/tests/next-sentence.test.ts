// The covered press's next (`../next-sentence.ts`): handles inline, in the
// order they are acted on, and never "make this same call again, unchanged"
// (`run-mvcwem7d-34689f55`).

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmRejectionNext } from "../next-sentence";

test("a covered press with closers names the closers, then the cover, then the target, in that order", () => {
  assert.equal(
    webLlmRejectionNext("covered_by_layer", ["t476"], ["t478", "t488"], "t474"),
    "Nothing was done: layer t476 covers t474. Press t478 or t488 first; it closes that layer. "
      + "Do not press t474 again while t476 covers it: that press is refused the same way. Once the layer is gone, press t474 again."
  );
  assert.match(webLlmRejectionNext("covered_by_layer", ["t5"], ["t6"], "t4") ?? "", /Press t6 first;/u);
  assert.match(webLlmRejectionNext("covered_by_layer", ["t5"], ["t6", "t7", "t8"], "t4") ?? "", /Press t6, t7 or t8 first;/u);
});

test("a covered press with no closers says to use a control inside the layer, never one covered by it", () => {
  const next = webLlmRejectionNext("covered_by_layer", ["t476"], undefined, "t474") ?? "";
  assert.match(next, /^Nothing was done: layer t476 covers t474\. Close or answer that layer first with a control inside it/u);
  assert.match(next, /never a control marked covered-by t476: those lie under the layer\./u);
  assert.match(next, /Do not press t474 again while t476 covers it: that press is refused the same way\./u);
  assert.equal(webLlmRejectionNext("covered_by_layer", ["t476"], [], "t474"), next);
});

test("anything that is not one of this domain's handles is never inlined, and the field names are said instead", () => {
  const next = webLlmRejectionNext("covered_by_layer", ["Close me"], ["t0", "No thanks"], "a b") ?? "";
  assert.equal(next, "Nothing was done: the layer in instead covers the target. Press one of closeWith first; it closes that layer. "
    + "Do not press the target again while the layer covers it: that press is refused the same way. Once the layer is gone, press the target again.");
  assert.match(webLlmRejectionNext("covered_by_layer", undefined, undefined, undefined) ?? "", /^Nothing was done: the layer in instead covers the target\./u);
});

test("no covered press ends by telling the model to make the same call again, unchanged", () => {
  for (const closers of [undefined, ["t9"]]) {
    assert.doesNotMatch(webLlmRejectionNext("covered_by_layer", ["t2"], closers, "t1") ?? "", /unchanged/u);
  }
});
