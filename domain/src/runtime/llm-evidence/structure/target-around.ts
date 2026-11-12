// Whether a detected list is around the element a detection was aimed at (t903, F2).
//
// A targeted detection starts at its target and, finding no rich run there,
// searches outward, as far as the page's body
// (`apps/extension/src/content/extraction/detect-structure.ts`). Its answer
// then still carried the target, so the packet told the model the list was
// around what it named. On `run-mwbkuxqt-c57f42cb` a detection aimed at the
// account control in the page header answered the home page's product grid
// and, on an item page, the product's colour and size options, each as
// `target: "t15"` (steps 0054, 0087): the model was told a list sat around its
// account control when none did.
//
// So the packet names its target only where the detection's own capture does
// not show the list elsewhere. The list is around the target when the target
// is the list's container, one of its items, or inside the container; it is
// shown elsewhere when the capture holds the target and the list's container
// and items, and the target is in none of them. Anything the capture cannot
// settle -- a container or item selector the walk does not read, a target the
// capture does not list (a hidden one: the detection's capture lists what is
// rendered) -- is `undefined`, and the target is named as before.

import type { WebAutomationExtractionProposal } from "../../../extraction";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webLlmCaptureWalk } from "./first-item";

/**
 * `true` when the capture shows the target inside the list's container, `false`
 * when it shows the target and the list apart, `undefined` when it cannot tell.
 * `selector` is the one the target was bound through.
 */
export function webLlmListAroundTarget(proposal: WebAutomationExtractionProposal, detected: WebLlmSnapshotBinding, selector: string): boolean | undefined {
  const walk = webLlmCaptureWalk(proposal, detected);
  const container = walk.tree.addressed(proposal.container);
  const target = walk.tree.addressed(selector);
  if (container === undefined || walk.items.length === 0 || target === undefined) return undefined;
  const byHandle = new Map(detected.evidence.elements.map((element) => [element.target, element]));
  const around = new Set([container.element.target, ...walk.items.map((item) => item.element.target)]);
  const seen = new Set<string>();
  for (let handle: string | undefined = target.element.target; handle !== undefined && !seen.has(handle); handle = byHandle.get(handle)?.parent) {
    if (around.has(handle)) return true;
    seen.add(handle);
  }
  return false;
}
