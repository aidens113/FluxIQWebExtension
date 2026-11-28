# t1096 core-loop: repeats answered from memory, or refused by the guard, go through loop detection

## Outcome

Partial. The fix is in, and the offline replay of the recording proves it (before: first firing at 0061/0062 `no_progress x16`; after: `near_repeat x2` at 0033). One existing test in a file I do not own needs its assertion updated, because it asserted the old order of steers (see Open questions). The package type check shows no errors in my files; its only errors (3) are in `view-channel/tests/binding.test.ts`, which another worker owns.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t1096/!FluxIQ`, all under `packages/fluxiq/src/runtime/llm/`:

- `repeat-guard/loop-detection/detector.ts`: `unrun` returns the `near_repeat` finding once the entry for that call on that page reaches `AUTOMATION_STUDIO_LLM_LOOP_NEAR_REPEAT_AT` (2), and records it as caught, as `ran` does. No count was added or changed.
- `repeat-guard/loop-detection/watch.ts`: `answered` and `guardRefused` hand that finding to `found()` and return the steer, as `ran` does. A strike is never counted twice: the old `looksOnly` strike and the `refusing` strike apply only when there was no finding. The steer is held as `steerOwed()` until the caller gives it. `caught(finding)` recognises that steer, gives it once, and does not put it on the ladder a second time. `ran` and `moved` clear what is owed.
- `evidence-loop.ts`: the refused-repeat and answered-from-memory paths now share one block. After either handler returns `continue`, the owed steer is given through the existing `automationStudioLlmEvidenceLoopCaught` (the steer note, with the `core.loop_decision` ask where it is offered). An answered ask that owed no steer then checks `loopOverdue`, as `automationStudioLlmEvidenceLoopRan` does after a call that ran (a refusal already checks it in its handler). The file went from 798 to 793 lines with no new packed statements.
- `repeat-guard/loop-detection/replay.ts`: answered and guard-refused events report the steer they now make. An answered event with no steer checks `due()`, mirroring the live loop.
- Tests:
  - `repeat-guard/loop-detection/tests/answered-repeat.test.ts`: the replay of recording steps 0029-0061, with synthetic digests, handles and answers (4 tests).
  - `tests/answered-repeat/tests/evidence-loop-answered-repeat.test.ts`: the real loop (3 tests). It sits in a subfolder because `runtime/llm/tests/` is at the 25-file limit.

Model-facing text is unchanged. No site, task or product is named anywhere.

Judgment call: I first left guard-refused findings unsteered (the guard's refusal already tells the model). That climbed the ladder's two steer rungs without telling the model, and the existing `no-count-ends` test caught it: no `core.loop_check` was ever shown. So a guard-refused near repeat is now steered beside its refusal, once. "Do not double-report": a ladder refusal never calls `guardRefused`, an answered ask never runs the ladder check, and `caught` never finds an owed steer twice.

## Commands run and observed results

- Before the fix: `pnpm exec vitest run src/runtime/llm/repeat-guard/loop-detection/tests/answered-repeat.test.ts`, asserting `firings[0]` equals `{step: 61, rung: "steer", pattern: "no_progress", repeats: 16, toolIds: ["core.full_page","core.run_node"]}`. Result: 1 passed. This is the recording's own steer, which it wrote as folder 0062.
- After the fix, the same file with the new assertions: 4 passed. `firings[0]` is `{step: 33, steer, near_repeat, 2, ["core.full_page"]}`. The ladder then steers again at 35 and reaches `change_approach` at 41 (x6), on the existing counts. No `no_progress x16` firing remains.
- `pnpm exec vitest run src/runtime/llm/repeat-guard/loop-detection/tests/`: 6 files, 84 tests passed (before the guard-refused steer was added; the files were re-run later, see the next line).
- `pnpm exec vitest run src/runtime/llm/tests/answered-repeat/ src/runtime/llm/repeat-guard/loop-detection/tests/answered-repeat.test.ts`: 2 files, 7 passed.
- The evidence-loop test with the steer line disabled: 2 failed (`expected [] to have a length of 1`). Restored, it passes.
- Heavy-slot: `vitest run src/runtime/llm/tests/ decision-handlers/tests/ repeat-guard/ evidence-loop/tests/`, on the final watch and loop code (before the test files were moved): 106 files, 1158 passed, 1 failed (`evidence-loop/tests/repeat-guard.test.ts`, t1014 "through the loop", line 574). Re-run on the final tree (`heavy-slot run t1096-loop-tests`): `Test Files 1 failed | 105 passed (106)`, `Tests 1 failed | 1158 passed (1159)`. The one failure is the same t1014 test. `answered-repeat.test.ts` (4), `evidence-loop-answered-repeat.test.ts` (3), `look-loop` (8) and `no-count-ends` (13) all passed.
- `pnpm structure:check` (Core root): 2 violations, neither mine. They are `evidence-loop/tests/` at 26 files and `view-channel/tests/binding.test.ts:111` statement packing, both in other workers' paths. Earlier my file had pushed `runtime/llm/tests/` to 26; I moved it into a subfolder, and the directory is now at 25.
- `heavy-slot run t1096-loop -- pnpm check` in `packages/fluxiq` (`tsc --noEmit` over `tsconfig.json`, which includes `src/**/tests/**`): exit 2, with 3 errors, all in `src/runtime/llm/view-channel/tests/binding.test.ts` (lines 88, 93, 94: TS2352, TS2554). That file belongs to another worker. No errors in `evidence-loop.ts`, `loop-detection/**` or either new test file.

## Not verified

- No live or paid run, no browser run. The recording replay uses synthetic state digests. The page left by step 0029 is modelled as a new digest, which is what makes the window start at 0031; that is the only reading that reproduces the recorded `x16` with tool ids in the order `[full_page, run_node]`.
- I did not check that no other caller of `AutomationStudioLlmLoopWatch` depends on `answered` or `guardRefused` returning `void`. A grep found only the decision handlers, which ignore the return, and `replay.ts`.

## Open questions or contradictions found

1. **A test in a file I do not own needs updating.** `packages/fluxiq/src/runtime/llm/evidence-loop/tests/repeat-guard.test.ts:574` (t1014, "through the loop") expects a steer naming `core.completion_check`. Its script is P C P P C P ... with an identical part run P. The second identical P is now refused by the guard as a near repeat and steered at once (x2, then x3). The round ends on loop detection's signal (`change_approach near_repeat [core.run_flow] x4`) after 8 decisions, so the completion refused again arrives on the refusing rung as a strike, not a steer. The test's own `signals` assertions still pass. Suggested edit for its owner: assert the steer on the repeated part run, or script the completions back to back with no identical tool call between them so that path still gets the first steer. The unit tests above it already cover `automationStudioLlmEvidenceRefusedAgainEnds`.
2. A guard-refused repeat now shows two notes on one decision: the `core.repeat_check` refusal and the `core.loop_check` steer. If the lead would rather have one note, the alternative is to drop `guardRefused` from the fix entirely. Climbing without a steer is not an option, because it spends the steer rungs untold.
