# t366 — Downstream progress-projection review

## Final verdict after t367

**GO.** T367 closes the t366 blockers. The original findings below are retained
as the review trail; each required correction is now present in the final
source/tests/documentation inspected for this follow-up.

- `draftChange.targetedStepIds` is the only nested-list seam. It is validated
  atomically at Core's 16-entry bound, string-only, duplicate-free, against the
  evidence-step-id grammar and digest exclusion. Invalid, oversized, nested,
  mixed-type, duplicate, or digest-bearing input drops the whole
  `draftChange` record; it is neither filtered nor truncated.
- Generic one-level records again admit scalars only. Existing top-level scalar
  lists retain their legacy filtered/bounded behavior, so no generic nested-list
  widening remains.
- All four named progress records now receive closed-shape runtime validation,
  including required counters/flags and closed progress/answerability states,
  before the public types are asserted.
- Valid proposed and refused rows traverse the shared rule and are asserted
  exactly equal. Shared sanitizer tests cover malformed progress, target-list
  boundaries and deeper content; adaptation mapping drops the complete unsafe
  named records.
- Accounting is now deep-compared in full for identical rows with and without
  progress, covering calls, grouping, token totals, cost, recorded/unrecorded
  state, totals and gate state.
- Compatibility/documentation claims are now precise: the four records are
  additive, digest-shaped generic strings are an intentional tightening,
  unrelated legacy scalars/top-level lists retain their prior behavior, and
  Core—not downstream syntax screening—owns non-content-derived id provenance.

The live-snapshot test still contains absence assertions for literals not fed
to that writer, but this is non-blocking because it also proves the relevant
snapshot contract—exact embedding—and privacy is now tested at the shared
mapping boundary that performs screening.

## Original verdict before t367

**NO-GO (superseded).** The happy-path Core row was preserved on both proposed
and refused builds, but the first implementation admitted nested scalar lists
generically and silently filtered/truncated them. The findings below describe
that pre-t367 state.

## Findings

### 1. Nested-list widening is not fail-closed

`publishable-step-value.ts` now sends every array-valued member of every
one-level record through `publishableScalarList`. The helper retains any
code-shaped scalar, drops individual rejected entries, and truncates after 32.
Consequently:

- `{ arbitrary: { values: ["page_value"] } }` is now publishable even though
  only `draftChange.targetedStepIds` required a nested list;
- `targetedStepIds: ["d1", "private product name"]` becomes `["d1"]`, which
  changes the claimed amendment target rather than rejecting an invalid fact;
- a 33-id target list becomes its first 32 ids, again changing the evidence;
- numbers and booleans are accepted in that list at runtime even though both
  public downstream types claim `readonly string[]`.

The new test currently blesses the partial-filter behavior. That is not exact
Core-member preservation and is unsafe for an evidence record.

**Required correction:** keep the generic one-level-record grammar unchanged,
and admit a nested list only at the shared path
`draftChange.targetedStepIds`. Validate that member atomically: at most 32
entries, every entry a string satisfying the agreed build-local step-id grammar,
and no digest-shaped value. If any entry or the length is invalid, drop the
whole `targetedStepIds` member (or reject the row); never filter or truncate it.
Both proposed and refused readers must continue to call the same shared rule.

### 2. The privacy proof is weaker than its claims

The screen rejects whitespace-bearing prose, obvious full URLs/selectors, and
hex digest forms. It cannot establish that an otherwise code-shaped value was
not copied from page content or derived from content. For example, a short page
value, hostname-like string, UUID, or non-hex digest can satisfy the generic
string grammar. Widening arbitrary nested lists increases that exposure.

The live-snapshot test asserts that forbidden literals are absent, but none of
those literals is present in the `CreatedFlowBuild` supplied to the snapshot
writer, so those assertions are vacuous. The proposed/refused parity test puts
unsafe values only on the proposed input, not on the refusal input.

**Required correction:** add adversarial coverage for code-shaped page values,
hostname/selector-like values, UUID/non-hex digest forms, arbitrary nested
lists, and nested records/lists. Exercise the same unsafe row through both the
proposed and refused mapping inputs and compare their screened results. Keep
the snapshot test focused on exact embedding; privacy must be proven at the
shared mapper boundary. Amend the architecture text to say that Core owns
build-local, non-content-derived identity provenance and that downstream
enforces only bounded syntax; do not claim downstream proves that no
content-derived digest can occur.

### 3. Bounds and closed shapes need direct regression tests

The implementation has row, record, and list constants, but the new tests do
not cover an oversized nested target list, a wrong scalar type in that list,
or a list under an unrelated nested member. They also do not prove that the
named closed progress states and answerability issue code are enforced at
runtime; the generic screen will retain any code-shaped alternative while the
TypeScript cast claims the narrower type.

**Required correction:** add boundary tests at 32/33 target ids, invalid mixed
types, unrelated nested lists, deeper list/record combinations, and invalid
closed-state/code members. Either validate the four named progress records to
their declared public shapes before casting, or widen the downstream types and
documentation so they do not promise validation that does not occur. Exact
Core public values must pass byte-for-byte at the object-member level.

### 4. Accounting invariance is only partially asserted

`build-usage.test.ts` adds progress to the two-rows/one-iteration fixture and
still checks call count, grouping, and total tokens. It does not compare input
tokens, output tokens, cost, unrecorded calls, or the complete usage result
against the same fixture without progress. The report's statement that tokens
and cost are unchanged is therefore stronger than the test.

**Required correction:** compute usage for identical rows with and without the
four progress members and assert equality of the complete accounting projection
(or at minimum calls, grouping/request ids, input/output/total tokens, cost,
`perCallRecords`, and `unrecordedCalls`).

### 5. Compatibility needs a narrower statement

The four optional public members are additive, so an older Core that omits them
remains compatible. But the shared sanitizer also newly removes digest-shaped
strings that older downstream code admitted, and it newly admits nested scalar
lists. Comments describing the policy as unchanged and the report's broad
backward-compatibility wording hide those observable changes.

**Required correction:** document compatibility as additive for the four Core
members while explicitly recording the sanitizer behavior change. After the
fail-closed path-specific correction above, add a regression showing that
unrelated legacy fields retain their previous accepted/rejected behavior.

## What is already sound

- The same `publishableStepFields` seam is used by proposed and refused build
  mapping; no second snapshot schema was introduced.
- The exact happy-path `progress`, `draftChange`, `draft`, and `answerability`
  member names survive the fresh Core parser in the reported 60/60 run.
- Snapshot writers embed `CreatedFlowBuild` rather than reconstructing the new
  records.
- The usage reader does not inspect the new progress members, so there is no
  direct production accounting change.
- Optional members preserve compilation/runtime compatibility with an older
  Core that simply omits them.

## Validation scope

The initial review was read-only apart from this report. The t371 follow-up
inspected only the final changed sanitizer/mapping tests, accounting test,
parity/snapshot tests, testing-facility documentation, and t367 report. I did
not inspect raw artifacts or provider, page, prompt, response, selector, URL,
browser, or credential data. I ran no tests, builds, provider calls, live runs,
commits, or pushes. This report is the only file I wrote.
