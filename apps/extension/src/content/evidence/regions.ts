// The page's landmark regions: the shape a reader would describe the page by,
// rather than the thousands of elements it is made of.
//
// A snapshot already says which landmark each element sits inside
// (`DomElementContext.landmark`, from `identity/context.ts`), but nothing says
// what landmarks the page has. That is the difference between "this button is
// in a navigation" and "this page has a search form, a product list and a
// pagination navigation" -- the second is what a reader needs before it can
// choose where to act.
//
// The role rule is `landmarkRole` in `identity/context.ts`, imported rather
// than repeated. This module had a byte-identical copy of it until Phase 1.4,
// which is the shape of duplication that already leaked a billing card number
// elsewhere in this plan: one copy gets fixed and the other does not. Here the
// consequence is quieter but still wrong -- an element's `context.landmark`
// would name a region this list does not contain -- and the fix is the same
// one, a single rule with a single home.

import { selectorFor } from "../selector";
import { accessibleNameFor, landmarkRole } from "../identity";
import { queryComposedInOrder } from "../shadow-dom";
import { visualDocumentBounds } from "../visual-bounds";
import { present } from "../../shared/present";
import type { RegionEvidence } from "./types";

const REGION_SELECTOR = "main,nav,header,footer,aside,section,form,search,[role='main'],[role='navigation'],[role='banner'],[role='contentinfo'],[role='complementary'],[role='search'],[role='region'],[role='form']";

/**
 * Every landmark of the page in composed document order, open shadow roots
 * included, or `undefined` when it has none. There was a cap of twenty (t200).
 */
export function regionEvidence(): RegionEvidence[] | undefined {
  const regions: RegionEvidence[] = [];
  for (const element of queryComposedInOrder(REGION_SELECTOR)) {
    const role = landmarkRole(element);
    if (!role) continue;
    const label = accessibleNameFor(element);
    const bounds = visualDocumentBounds(element);
    regions.push(present<RegionEvidence>({
      role,
      selector: selectorFor(element),
      label: label || undefined,
      bounds
    }));
  }
  return regions.length ? regions : undefined;
}
