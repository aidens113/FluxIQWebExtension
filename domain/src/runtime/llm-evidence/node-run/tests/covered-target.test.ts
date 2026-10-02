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
