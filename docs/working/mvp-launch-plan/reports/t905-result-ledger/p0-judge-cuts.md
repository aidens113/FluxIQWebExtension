# p0-judge-cuts (lane t905, phase 0a)

## Outcome
Partial: code and tests done and verified; `pnpm check` via heavy-slot was still queued (position 3 of 3) when this was written, so it is not verified.

## What changed and why
Dir F = Core/packages/fluxiq/src/runtime/result-verification/flow-less.
- `F/judged-summary.ts`: removed LOOKS_SHOWN, FOUND_CHARS, WHERE_CHARS and `cut()`. Every look goes to the judge whole (still screened by `words`). Header and `lookedShown` comments updated. Also removed the `readPagesNotShown` key from the sent summary, since nothing is left out now.
- `F/read-pages-shown.ts`: removed READS_SHOWN, WHERE_CHARS, PLACE_CHARS, FOUND_CHARS and `cut()`. Every read is shown, with address, place and condition-found values whole. `notShown` removed from the return type. Screening (screen/deniedKeys/withheld) untouched.
- Tests: `tests/looked-view.test.ts` (replaced the "latest few, each cut short" test with a whole-look test: a 2,000+ char look and 10 looks all reach the request), `tests/read-pages.test.ts` (+55 reads with 320-char addresses and 120-char places all shown, no `readPagesNotShown`; +300-char left-out label shown whole), `tests/window-fitting.test.ts` (+12 long looks and 45 read pages sent whole, then window-fitting summarises `looked` and `readPages`, with `summarised.items` naming them and `core.summarised` counts).
- Each new test fails with the change reverted: the old code cut found at 600 and where at 300 (2,000-char look), kept 6 looks, kept 40 reads (55 reads), cut left-out labels at 200 (300-char label).
- Snapshot `tests/__snapshots__/judged-summary.json`: it pins only the question and an empty summary, none of the cut fields, so it needs no change and its diff is empty (not regenerated).

## Commands run and observed results
- `npx vitest run src/runtime/result-verification/flow-less` (final run, after the fixture trims): `Test Files 11 passed (11)`, `Tests 100 passed (100)`. Earlier runs failed on my own fixtures (the screen trims trailing whitespace); fixed with `.trim()`.
- `node scripts/structure-audit.mjs` (after replacing two `as never` casts in tests that the audit flagged): `structure-audit: passed (535 warning(s), 969 baselined).`
- `heavy-slot.mjs run t905 -- ... pnpm check`: only output so far `heavy-slot: t905 waiting (position 3 of 3)`. Output file: `C:/Users/osrs_/FluxStuff/fxwork/scratch-check.txt` (ends with `end <code>` when done).

## Not verified
- `pnpm check` (tsc) result. The test edits after the last vitest run were only the cast replacements (typed `NonNullable<AutomationStudioFlowLessSummary["readPages"]>[number]` and `as unknown as ReturnType<typeof sent>`); vitest was not re-run after them.
- Snapshot -u not run since nothing in it changed.

## Open questions or contradictions found
- `F/question.ts` (not mine to edit) still says "readPagesNotShown counts any earlier reads left out"; no such key is sent now. Changing it changes the judged-summary.json snapshot. Needs a follow-up edit to question.ts plus the snapshot.
- `build-test/*` files outside F also mention notShown (not examined).
- window-fitting.ts needed no change; it summarises `looked` and `readPages` as lists by entry count.
