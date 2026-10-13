// The issues a column name a read cannot find is refused with, whether it was
// written in the read's `fields` (`./columns.ts`, t502) or in a condition
// (`./conditions.ts`, t497).
//
// The first is always `{code: "web.handle.unknown_field", field, valid}`: the
// name as written and every name the step can use there, so Core can say both
// (`./refusal-issues.ts`). Until t502 a name refused inside `fields` carried no
// issue at all, and lane D round 16 (`run-mv6i2akr-516b2f03`, D1) was told
// neither what it had written nor what the read had.
//
// The second is the evidence that the *detection* is what is out of date, and
// is added only when the names show it: the written name is one of the read's
// own columns with a part swapped for another (`output-nodes/extract-list/swapped-name.ts`),
// the shape of a key taken from the same item as the page shows it now, after
// an act gave it a column the detection never saw. In D1 that was the accepted
// card's status text, built by hand from the card after the accept, on a read of
// the list detected before it; the read's nearest column was the button the
// accept removed. Core reads `web.handle.columns_changed` as "detect the list
// again" rather than "the list's handle is right"
// (`runtime/flow-bootstrap/candidate/submission-refusal.ts` in Core). It carries
// the name and no `valid`: Core says `valid` as names to write instead, and the
// sibling it resembles is exactly the one not to write.

import type { WebAutomationExtractField } from "../../../../actions/extraction";
import { webExtractionNameSwapsPart } from "../../../../output-nodes";
import { webPlanBoundedIssues, type WebPlanRefusalIssue } from "./refusal-issues";

const HEADER_PREFIX = "column:";

/** The issues for `named`, which no column answers to: the name and the names the step can use (`valid`), and, when it is a detected column's sibling, that the items changed since the detection (header). */
export function webPlanUnknownColumnIssues(named: string, valid: readonly string[], detected: Readonly<Record<string, WebAutomationExtractField>>): WebPlanRefusalIssue[] {
  const written = named.startsWith(HEADER_PREFIX) ? named.slice(HEADER_PREFIX.length) : named;
  const sibling = Object.keys(detected).some((key) => webExtractionNameSwapsPart(written, key));
  const changed = sibling ? [{ code: "web.handle.columns_changed", field: written }] : [];
  return webPlanBoundedIssues([{ code: "web.handle.unknown_field", field: written, valid: [...valid] }, ...changed]);
}
