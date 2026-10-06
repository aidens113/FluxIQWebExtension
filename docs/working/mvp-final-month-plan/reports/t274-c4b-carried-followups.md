# t274-c4b: carried candidates survive a stalled round; a carried merge is never shown or counted as untested

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`.
Nothing committed.

## Outcome

Mostly done. All three items are fixed, each with a test that failed first. The vitest set passes and the
structure audit passes. `pnpm run check` (tsc) fails with exactly one error. It is in
`RT/result-verification/build-test/tests/judge-rows.test.ts`, an untracked file belonging to another worker's
`judge.ts` work. None of my files are involved, and I stopped there as the brief says.

## What changed and why

1. **`RT/flow-bootstrap/unfinished-build/round-ending.ts`**: the stall ending now copies each step with a local
   `stallCopy` instead of a bare `structuredClone`.
   - `stallCopy` deep-copies the step, sets the same `scheduledCandidate` reference, and calls
     `automationStudioFlowDraftCopyScheduledCandidate(step, copy)`. This is the same approach `RepairSeed` uses.
   - The header gets a t274-c4b paragraph that cites `run-muw60j7c-bb7c9a62`, which had 48 `unusable_decisions`
     stops.
   - I searched `RT/flow-bootstrap/unfinished-build/` for other copies (`structuredClone`, `...step`, JSON
     round-trips). The only other clone is `judgement.ts` `RepairSeed`, which already carries the candidate and
     is not mine. `phases.ts` hands `judged.seed` straight to the next round, and the loop copies it with
     `CopyScheduledCandidate`.
2. **`RT/result-verification/build-test/summary.ts`**: a carried routing join is left out of `buildTest.steps`.
   I added one `.filter(!automationStudioFlowDraftStepCarriedJoin)` before the steps map, an import from
   `../../flow-draft/carried-step/index.ts`, and a sentence in the header's `carried` bullet. Nothing else in the
   file changed (`stores` was left as it is).
   - **Why leave it out rather than give it an outcome:** the test never sends the join, so any outcome word
     (`replayed`, `present`, …) would claim an answer the test never gave. `not_run` is what caused the bug. The
     outcome union is in `contracts.ts`, which I may not touch. The seeded optional step's routing is
     `{kind:"optional"}` and names no position, so no other shown step points at the omitted one.
   - The remaining steps keep their Flow numbers (1, 2, 4, 5…), so a judge that names a step still matches the
     draft.
   - Because the join is no longer in the account, `automationStudioBuildTestUntestedCarried` cannot count it, so
     `judgement.ts` and `resume.ts` need no change.
3. **`RT/flow-draft/dry-run.ts`**: `automationStudioFlowDraftReplayable` and `automationStudioFlowDraftReplayFrom`
   now skip carried joins themselves. This is the single place the C-4 report said the skip belongs.
   - `phases.ts:439`, which receives `automationStudioFlowDraftReplayable` from `service.ts:1625`, now announces
     "Testing the Flow so far" for a Flow that has a carried Merge. `phases.ts` was not edited.
   - The other callers already pass lists without joins, so the new filter changes nothing for them: the gate
     (`tested`), `replay-draft.ts` (`sent`) and `judgement.ts:132`.
   - There is no import cycle: `carried-step/` imports only `scheduled-candidate/` and a type from `step.ts`.
4. **New test**: `RT/tests/refuted-result/tests/carried-steps-between-rounds.test.ts`, with three tests. Its seed is
   a shortened version of the C-4 run fixture: navigate, optional Decline, Merge, Not now, type.

## Commands run and observed results

From `packages/fluxiq`.

Fail-first, before any source change: `pnpm.cmd exec vitest run .../carried-steps-between-rounds.test.ts` failed
all three tests:
- Stall: `AssertionError: expected [ 1, 2, 4, 5 ] to deeply equal []`, from the listing after `RoundEnding` on
  `AutomationStudioFlowBootstrapUnfinishedStall`.
- Replayable: `AssertionError: expected false to be true // Object.is equality`.
- Summary: `AssertionError: expected [ 3 ] to deeply equal []`, from untestedCarried. I re-ran it with `-t`
  after putting the untested assertion first. The first ordering failed with
  `expected [ 1, 2, 3, 4, 5 ] to deeply equal [ 1, 2, 4, 5 ]`.

After the change:
- The same file: `Tests 3 passed`.
- The brief's set
  (`pnpm.cmd exec vitest run $R/flow-bootstrap/ $R/flow-draft/ $R/llm/node-tools/ $R/result-verification/build-test/ $R/tests/refuted-result/`):
  exit 0, `Test Files 153 passed (153)`, `Tests 1906 passed (1906)`, `Duration 61.12s`.
- `pnpm.cmd run check` failed. Its only error (the count of `error TS` is 1) is
  `src/.../result-verification/build-test/tests/judge-rows.test.ts(59,26): error TS2339: Property 'fix' does not exist on type '{ verdict: "no"; ... records: AutomationStudioBuildTestRecordCounts; spent: AutomationStudioBuildTestJudgeSpend; }'`.
  That file is untracked and belongs to the worker editing `build-test/judge.ts`. I did not touch it.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (261 warning(s), 349 baselined).`

## Not verified

- Nothing was run live.
- The full `phases.ts` multi-round path with a stall and candidates is not driven end to end. The test calls
  `RoundEnding` and then `RepairSeed` plus a loop copy directly, and checks `Replayable` but not the
  announcement.
- tsc has not been confirmed clean for my files on their own. The one error is elsewhere, and tsc reported no
  errors in my files.

## Open questions or contradictions found

- The gate (`llm/node-tools/dry-run-gate.ts`) and `judgement.ts:132` still filter joins before calling
  `Replayable`/`ReplayFrom`. That filtering is now redundant but harmless, and both files belong to other owners.
  They could drop it later.
- The type error in `judge-rows.test.ts` (`fix` is missing on the judge's `no` verdict type) needs fixing by the
  worker that owns `judge.ts`.
