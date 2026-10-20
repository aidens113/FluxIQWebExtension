// The covered press's next (`../next-sentence.ts`): handles inline, in the
// order they are acted on, and never "make this same call again, unchanged"
// (`run-mvcwem7d-34689f55`).

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmRejectionNext } from "../next-sentence";

// social `run-mvgf7ij5-a9747575`: "Repeat this ordering after each Next page
// move" prescribed a row loop inside a page loop, which Core's script grammar
// refuses, and the build spent its briefs writing that nesting.
test("incomplete text loads every row first, then one row-context read, the per-row disclosure over it, then the full read, with no loop inside a page loop", () => {
  const next = webLlmRejectionNext("incomplete_text", ["private column"], ["private control"], "private row") ?? "";
  assert.match(next, /cannot hold another repeat/u);
  assert.match(next, /Load every row first.*Scroll step with mode untilStable.*Next page in its own repeat-while span.*Then read only nonempty stable row-context columns.*without.*incomplete text field.*repeat over that read.*registered row-bound click.*Then read the full text/u);
  assert.doesNotMatch(next, /after each Next page/iu);
  assert.doesNotMatch(next, /private column|private control|private row/u);
});

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
