# install-core-d1 (t707 round 3): written steps refused as failed repeats

## Outcome

Done. A call the host answers `core.run_node.written` is no longer recorded by the repeat guard, so an identical repeat of it is never refused with the "did not work" or "changed nothing" words. The guard against repeating a genuinely failed or no-effect call on the same page is unchanged.

## What changed and why

Confirmed from the code how a written call reaches the guard. `evidence-loop.ts:452` calls `handling.repeats.recorded({... effect: record.effect, effectApplied, refused, resultCode, answer ...})` and does not pass `record.written`. A written step is `effect: "mutate"`, `effectApplied: false`, `refused: false`, `resultCode: "core.run_node.written"`. So `repeat-guard/outcomes.ts` computed `failed = call.refused || (mutate && !effectApplied && !runsDraft)` = true and stored `{outcome: "failed", resultCode: "core.run_node.written"}` under the call's key (tool + canonical input incl. `write: true` + page). The next byte-identical write on that page hit `blocks()` at `evidence-loop.ts:762` and was refused as `repeat_refused (failed)`. Even with `failed` excluded, `changedNothing` would have been true (page unchanged), so the fix has to skip the record, not just reword it.

What a repeat should get instead:
- **Running the step now** (no `write`) is a different input, so it was never under the write's key and is never blocked by it. A test pins this.
- **Writing the identical step again**: the guard records nothing, so the call runs. The host checks it again. Then the Flow's own second-copy rule (`flow-draft/second-copy.ts` rule (a): same mutate input, same `ranWith`, same `stateBefore`; applied in `evidence-loop.ts:208` via `decision-handlers/second-copy.ts`) keeps it `taken` and tells the model which step already does it (`second_copy`). If that step was dropped in the meantime, the write joins the Flow again, which a page-keyed refusal could not tell apart. I chose this over a new `already_written` refusal outcome because the guard cannot see the draft (`draftOf` is supplied only for `core.run_flow` by `evidence-loop.ts`, which I do not own), so a guard-side refusal would wrongly refuse a re-write after a drop.
- A write the host **refused** (`ok: false`) is still a failed call. A host that ignored `write` and answered another code is still an ordinary call. Both are tested.

Files:
- New `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/written-call.ts`: `automationStudioLlmEvidenceCallWritten(call)` returns true when the call was not refused, `resultCode === AUTOMATION_STUDIO_NODE_WRITTEN_CODE` and `input.write === true`. Both constants are imported from `../node-tools/replay.ts`, the same place `run-node.ts` imports them from. This reads the step the way the decision parse does: written only beside the code.
- `repeat-guard/outcomes.ts`: in `recorded`, after the `checked` and precondition handling and the `state === undefined` return, a written call deletes any outcome under its key and returns. Added a header paragraph (t707 D1) and a "What still runs" bullet.
- `repeat-guard/index.ts`: exports `./written-call.ts`, and the barrel comment now mentions it.
- New tests: `repeat-guard/tests/written-step.test.ts` (guard behaviour, 4 tests) and `repeat-guard/tests/written-call.test.ts` (the predicate, 2 tests).

The `core.run_node` handler was not touched. The cause is in the guard.

## Commands run and observed results

From `C:/Users/osrs_/FluxStuff/fxwork/t707/!FluxIQ`:
- Before the fix: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/repeat-guard` -> 1 failed, 66 passed (11 files). The failure was `written-step.test.ts` "never makes the identical call a repeat to refuse": expected undefined, received `{ callId: "c1", outcome: "failed", resultCode: "core.run_node.written" }`. That is the live defect. The other three new tests passed before the fix, as intended: running the step, a failed run still refused, a refused or ignored write still refused.
- After the fix: the same command -> Test Files 12 passed (12), Tests 69 passed (69).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (397 warning(s), 1154 baselined).` exit 0.

## Not verified

- No test covers the end-to-end path where an identical write runs again and the second-copy rule keeps it out with the `second_copy` words. That path lives in `evidence-loop.ts` and `decision-handlers/second-copy.ts`, outside my test scope. Rule (a) requires the host's declared `input` and `ranWith` for both writes to match and both to carry the same `stateBefore`. I read that this holds; I did not run it.
- Whether repeated identical writes are bounded by the no-progress guard (`maxStepsWithoutProgress`) once each one is kept out as a second copy. Not traced.
- No typecheck (per brief). Live behaviour is not re-run (no browser or Lab). The live report itself says it did not prove that every refused resend was byte-identical to a written call. Any refused resend that repeated the failed `target_covered` run was a correct refusal and still is.

## Open questions or contradictions found

- `evidence-loop.ts:452` already holds `record.written`, but it is not passed to `recorded()`. The guard now infers written from the code plus `input.write`, the same way the decision parse does. Passing `written: record.written === true` explicitly would be cleaner if the supervisor wants it; that file was not mine.
- Search-streak accounting for a written call is unchanged: it is a `mutate`, so it ends a run of looks, as before.
