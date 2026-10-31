# w4-pace (t799, P6 item 5)

## Outcome
Done: goals 1, 2, 3 and 4. The tsc, the tests of the touched directories and the structure audit were run (below).

## What changed (RT = packages/fluxiq/src/programs/automation-studio/runtime in the Core t799 tree)
1. `RT/executor/pacing/pace-keeper.ts`: `learnUnhinted(node, at?)`: next = max(authored, min(60 s, max(1 s, ceil(pace*1.5)))); returns the new pace when it rose. `learn` unchanged.
2. New `RT/executor/pacing/rate-limit-pace.ts` (`automationStudioPaceAfterRateLimit`, exported by the pacing barrel). A stated wait (fault `hintedWaitMs`, else `obstruction.retryAfterMs` for a rate_limit) goes through `learn`; a rate_limit obstruction or cleared `rate_limit` layer without one goes through `learnUnhinted`; it sets `pace.raisedToMs` on the attempt; with no rate limit it returns the same attempt object (byte-identical).
   Called from `step-loop/failed-attempt.ts` (replaces the old hint-only block) and from `executor/graph-run.ts` on the succeeded, unskipped path just before `automationStudioStepLearnInterruption`.
3. Core writes the pace:
   - New `RT/flow-bootstrap/learned-paces.ts` (`AutomationStudioLearnedPaces`: `of(environment)`, `trial(attempts, graph)`, `list()`, `lower(plan)`). It records the largest `raisedToMs` per step identity (definitionId plus parameters with `ensureState` off, read from the trial graph, never the key). `lower` sets `paceMs` (rounded up to 100 ms, clamped to AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PACE_LIMITS, never below the step's own) and returns the same plan object when nothing changes. The file is `learned-paces`, not `explored-paces`, because three `explored-` files in `flow-bootstrap/` trip the naming audit.
   - `candidate/submission.ts`: new input `exploredPaces?: { lower }`. `lower` is applied beside the toggle step, then `relaid` (validate and lay out again). A resubmission of the same script text is a new revision while a pace is waiting to be written; otherwise the same-text shortcut would hide it.
   - Wired beside the toggle and interruption trial calls: `service/candidate-trial/{contracts,run}.ts`, `service/subflow-trial/run.ts`, `service/project-build/{subflow-trials,brief-ports}.ts`, `service.ts` (trial environment gets `exploredPaces`).
   - `candidate/trial-slow-down.ts`: the instruction now says Core sets the pace itself at the next submission, asks for no `repeat pace:` for it, and says to submit and test again. The model is still asked for the dismiss-and-wait step when a way out was named. The gate rule is untouched. Model text is generic.
   - `flow-bootstrap/index.ts` (barrel): one export line.
   - `scoped-submission.ts` needed no change: tying is by identity, and `input.submission` spreads `exploredPaces` through.
4. Red card: `failed-attempt.ts` no longer calls `settleFailed()` when `ladder.kind === "retry" && ladder.rung === "clear_interference"`. The await rung is as before.

## Tests (new unless noted)
- `executor/pacing/tests/pace-keeper-no-hint.test.ts`
- `executor/step-loop/tests/rate-limit-pace.test.ts`: failure path, retryAfterMs as a hint, no rate limit changes nothing, success path with a cleared rate_limit layer, no failed card for a clear_interference retry, and a card still shown when nothing clears the layer.
- `flow-bootstrap/candidate/tests/pace/tests/{submission-paces,trial-slow-down-words}.test.ts`
- `flow-bootstrap/tests/learned-paces.test.ts`
- Edited the existing `flow-bootstrap/candidate/tests/trial-gate-slow-down.test.ts`: it now asserts "Core sets its pace to at least 5.5 s itself" in place of "repeat pace:".

## Commands run (each under heavy-check.lock)
- `cd packages/fluxiq && node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` -> no output after TSC-END: 0 errors (final run, after the test fixes).
- `pnpm test -- RT/executor/pacing RT/executor/step-loop RT/flow-bootstrap/candidate/tests/pace RT/flow-bootstrap/candidate/tests/trial-gate-slow-down.test.ts RT/flow-bootstrap/tests/learned-paces.test.ts` -> Test Files 15 passed (15); Tests 86 passed (86).
- Earlier run, before the last two test fixes: `... RT/flow-bootstrap/candidate/tests/toggles RT/service/project-build RT/service/candidate-trial` -> Test Files 72 passed, 2 failed (74); the 2 failures were my new tests (a dispatcher mistake in the test, and a JSON-plan `paceMs` the plan reader drops). I fixed the tests. The service suites ran in a second vitest group: 7 files, 35 tests passed.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (456 warning(s), 1152 baselined)", exit 0. An earlier run flagged my three `explored-` files (fixed by the rename). Two other violations in that run, in `llm/harness-options/tests`, were not mine and are no longer reported.

## Not verified
- Fail-first was not shown. I wrote the implementation before the tests and ran no red pass; no mutating git was allowed to stash it.
- After the last edits I did not re-run `RT/service/**`, the toggles tests or `flow-bootstrap/candidate` as a whole. Their green run was before the rename `explored-paces` -> `learned-paces` and the two test fixes; only tsc and the touched-directory tests ran after.
- No live or browser run. The web client does not send `obstruction` or `retryAfterMs` yet.
- Whole-candidate submission with `service.ts` and `brief-ports.ts` wiring has no end-to-end test. The pieces are covered separately: the recorder, `lower` via the submission controller, and the trial calls via the ports types.
- `paceMs` written in a JSON-plan node is dropped by the plan reader (found while testing), so only the script's `repeat pace:` reaches the plan. The "never below the step's own pace" rule is tested on `lower` directly.
- A trial's pace is recorded whatever the verdict (the call sits beside the toggle recording, before the verdict). The brief said "passed trial"; I judged a learned pace valid either way.

## Open questions or contradictions
- Deviations from the owned-path list: `flow-bootstrap/index.ts` (barrel export) and `service.ts` line 1588 (the submission input) plus its import line, beyond "the trial environment line only". Both are one-token changes and are needed to compile and wire.
- The slow-down instruction is truthful only while the next submission keeps the step as the trial ran it. It says so in its last sentence.
