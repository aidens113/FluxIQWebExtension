# t772 w3-claims-scope report

## Outcome
Done.

## What changed and why
Core `FB/site-reset/undo-claims.ts`: `ran()` now attaches the list a landed look under `undoes` names only if the new private `reads(act, list)` holds:
- the act already has that list (same scope or group), or
- the list's resource (`receipts.resourceOf`) equals the act's `spot.resource`, or
- the list's read location (`receipts.described().location`) equals the act's `place.location`, or
- the act records neither resource nor location (a trial act with no witness): nothing shows the list is elsewhere, so it is attached as before.
Otherwise `act.destinations` is unchanged and the act stays `in_place`. `receipts` port type widened with `resourceOf` and `described`; `ledger.ts` passes the full CreateBaselines object, so no ledger edit. No words used or added.

New test `FB/site-reset/tests/undo-claims.test.ts` (notes app vs library catalogue):
1. List read on another resource, never named: destinations stay [] and the act stays `in_place`.
2. List read on the act's own resource: attached.
3. List the act's press named: attached once, a later look does not duplicate.

## Commands run and observed
- Failing first (before the fix): undo-claims.test.ts, "Tests 2 failed | 1 passed (3)" (the case-1 destinations held the catalogue list). Case 3 failed then only because my first draft named an off-resource list; it was rewritten.
- With the fix, first run: 4 failures in the group, two being existing trial-act tests (trial-witness, settlement-shapes) that name a list on a trial act with no resource. Added the "records neither" fallback above.
- Final: `node ../../scripts/vitest-groups.mjs --groups=parallel src/programs/automation-studio/runtime/flow-bootstrap/site-reset` -> `Test Files 26 passed (26)`, `Tests 404 passed (404)`.
- Typecheck (`tsc --noEmit` with 8 GB heap; default heap OOMs): one error, in `service/project-build/tests/project-build-told.test.ts(14,26)` (another worker's untracked file); none in my files.

## Specs read (not run, not edited)
office-address-confirm.spec.ts states the builder never names an act under `undoes` (asserts `sent.filter(undoes !== null)` is []); office-cross-brief.spec.ts has no `undoes` at all. Neither is altered by this change.

## Not verified
No browser/live run. words.test.ts failed mid-way earlier (words.ts is being edited by another worker) but passed in the final run.

## Open questions
Same-resource different-page lists are still attached (resource match is the brief's criterion); a stricter page match would need the act's page read location always recorded.
