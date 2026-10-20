// The veto and a read step's target whose words an earlier step changed (t743 D2, reworked D2b).
//
// Office rerun round 4 (`run-mvgvyaip-d856e135`, 0055): a read step's identity carried the words its paragraph
// showed when it was captured; an earlier step of the same Flow changed them, the recorded selector found the
// paragraph, and the veto refused it, four times, as `web.target.not_found`. The domain now saves a read's target
// with its words, marked `readsWords` (`domain/.../plan-resolution/read-identity.ts`), and the veto judges a marked
// target without them (`../read-words.ts`). Pinned here, on an invoice page whose total a discount changed:
// - a bare paragraph read (tag, selector, words) whose words changed is acted on, not vetoed;
// - the same paragraph saved as a press target, unmarked, is refused as it always was;
// - a name the element carries besides its words still has to agree, and still refuses a paragraph that lost it;
// - a name that says only the words again, or arrives alone, is the words and does not veto.
// `vetoExactMatch` is what `action-runtime/resolve-target.ts` asks of a selector's lone match before acting on it.

import assert from "node:assert/strict";
import test from "node:test";
import type { TargetCandidate } from "../candidates";
import type { RecordedIdentity } from "../score";
import { vetoCandidate, vetoExactMatch } from "../veto";

const TOTAL = "#summary > p:nth-of-type(2)";

/** The invoice total as the page shows it after the discount, in the fingerprint shape `candidateFingerprint` gives it. */
function shown(extra: Partial<TargetCandidate["fingerprint"]> = {}): TargetCandidate {
  const fingerprint = {
    candidateId: "total", tagName: "p", role: "paragraph", selector: TOTAL, classNames: ["summary-line", "total"],
    visibleText: "Total 36.00", isVisibleOnViewport: true, ...extra
  };
  return { element: { candidateId: "total" } as unknown as Element, fingerprint };
}

/** A bare paragraph as a step saved it before the discount: its tag, its selector and the words it showed. */
const BARE: RecordedIdentity = { tagName: "p", selector: TOTAL, visibleText: "Total 40.00" };
/** The same paragraph as a read step saves it: the words kept, marked as the value it reads. */
const READ: RecordedIdentity = { ...BARE, readsWords: true };

test("a press-style target identified by its old words is refused once they changed, exactly as before", () => {
  const verdict = vetoCandidate(BARE, shown());
  assert.ok(verdict.refusedBecause === "contradicted" || verdict.refusedBecause === "uncorroborated", JSON.stringify(verdict));
  const classed = vetoCandidate({ ...BARE, classNames: ["summary-line", "total"] }, shown());
  assert.ok(classed.refusedBecause !== undefined, JSON.stringify(classed));
});

test("a bare read target whose words changed is acted on when its selector finds it, not vetoed", () => {
  assert.deepEqual(vetoCandidate(READ, shown()), {});
  assert.deepEqual(vetoCandidate({ ...READ, classNames: ["summary-line", "total"] }, shown()), {});
  // The precondition returns before the element is read, so the selector's lone match is the answer.
  assert.deepEqual(vetoExactMatch(READ, {} as Element), {});
});

test("a name the read target carries besides its words still has to agree", () => {
  const named: RecordedIdentity = { ...READ, accessibleName: "Amount due" };
  const agreeing = vetoCandidate(named, shown({ accessibleName: "Amount due" }));
  assert.equal(agreeing.refusedBecause, undefined, JSON.stringify(agreeing));
  assert.ok(agreeing.measurement !== undefined, "weighed, since the recording named something besides its words");
  const other = vetoCandidate(named, shown({ accessibleName: "Amount paid" }));
  assert.ok(other.refusedBecause !== undefined, JSON.stringify(other));
});

test("a name that says only the read's words again is the words, and does not veto", () => {
  const named: RecordedIdentity = { ...READ, accessibleName: "Total 40.00" };
  assert.deepEqual(vetoCandidate(named, shown({ accessibleName: "Total 36.00" })), {});
  // The packet drops a text equal to the name, so a name may arrive alone: it is the words too.
  const alone: RecordedIdentity = { tagName: "p", selector: TOTAL, accessibleName: "Total 40.00", readsWords: true };
  assert.deepEqual(vetoCandidate(alone, shown({ accessibleName: "Total 36.00" })), {});
});
