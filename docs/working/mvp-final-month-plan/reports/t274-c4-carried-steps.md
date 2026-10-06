# t274-c4: the re-author never orders a rerun of a carried step the domain refuses

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`.
Nothing committed. Nothing downstream edited.

## Outcome

Done, with three follow-ups outside my files. They are listed under "Open questions". The most important one is
`RT/flow-bootstrap/unfinished-build/round-ending.ts:30`. On a stall ending (`unusable_decisions`, which is how
every round of run muw60j7c ended) it deep-clones the steps, and a clone loses its scheduled candidate. So on that
path the next round would still list the carried steps.

## What changed and why

- **New `RT/flow-draft/carried-step/`** (`carried-step.ts`, `index.ts`, `tests/carried-step.test.ts`). This is the
  one predicate that the gate, the replay and the judgement now share. It sits in flow-draft so that all three can
  import it without a cycle. The directory has three functions:
  - `automationStudioFlowDraftStepCarried` (moved here; `f<n>`).
  - `automationStudioFlowDraftStepCarriedJoin`: a carried `builtin.control.merge`.
  - `automationStudioFlowDraftStepNotRunInThisBuild`: the step is carried, is not a join, has no valid
    scheduled-candidate call, and lacks `ranWith` or `replay`.

  It is imported through its barrel, the same way `scheduled-candidate/` is. `flow-draft/index.ts` was not touched.
- **`RT/llm/node-tools/draft-from-flow.ts`**: re-exports `automationStudioFlowDraftStepCarried` from the new
  directory, so existing importers such as `result-verification/build-test/summary.ts` keep working. The duplicate
  regex is gone, and the stale "every carried step runs again" comment is corrected.
- **`RT/flow-bootstrap/unfinished-build/not-run.ts`**: lists positions using the shared predicate, and its own regex
  is gone. An unchanged carried step with a candidate is no longer listed, and neither is a carried Merge.
- **`RT/flow-bootstrap/unfinished-build/judgement.ts`**:
  - `automationStudioFlowBootstrapRepairSeed` now carries each candidate over to its copy. It keeps the same
    candidate reference and calls `automationStudioFlowDraftCopyScheduledCandidate`. Without this, the
    `structuredClone` dropped the candidate, and the next round could not run the step as saved.
  - `JudgeUnfinished` asks `replayable` of the seed with carried joins filtered out, so a Flow holding the Merge is
    tested instead of being "not_tested".
  - The header comment is updated.
- **`RT/llm/node-tools/dry-run-gate.ts`**:
  - Carried joins are taken out before `cannotRun`, `noStart` and `automationStudioFlowDraftReplayable`.
  - `unrunnableWord` uses the shared predicate, so `not_run_in_this_build` there means exactly what `not-run.ts`
    lists.
  - A carried step whose candidate stands but whose node has no fixed output is now worded `cannot_run_again` rather
    than `not_run_in_this_build`, because a rerun would not change what its node is.
  - The header is updated.
- **`RT/llm/node-tools/replay-draft.ts`**:
  - A carried join is skipped in `automationStudioFlowDraftReplaySteps`: no call is sent and no outcome is recorded.
    Because the skip is in the shared walk, it applies to `core.run_flow` too.
  - The reset and its tool come from the first step that is actually sent.
  - `WithholdsLater` reads the next step that is not a join.
  - The header has a new paragraph explaining this.
- **`RT/flow-draft/full-run-required.ts`**:
  - The `not_run_in_this_build` text now reads: "cannot be run as that Flow saved it -- it was changed since, or that
    Flow kept too little to run it -- so it has to run in this build".
  - The instruction adds: "the Flow's other steps are run as they stand, and need nothing done to them".
  - The header is updated.
- **`RT/recovery/refuted-result/brief.ts`**:
  - `NOT_RUN_LINES` is rewritten. It now says three things:
    - The test runs each unchanged step as the Flow saved it, and each changed step with the change.
    - "do not rerun a step you are not changing".
    - Only a step the test names by number (`not_run_in_this_build`) needs a live rerun.
  - Step 5 of READ_STEPS and ACT_STEPS now ends "is left as it is -- the test runs it as the Flow saved it."
  - The t194-w78 line (Core's account outranks the advice) and READ/ACT steps 1-4 are unchanged.
  - The header gains a t274-c4 paragraph.
- **Tests**:
  - Rewritten: `RT/recovery/refuted-result/tests/brief-rerun-carried.test.ts`, which pinned the old rerun wording.
  - New: `RT/tests/refuted-result/tests/carried-steps-as-saved.test.ts`. This is the fail-first test, seeded from
    debug Stage 3: navigate, optional Decline joined at a Merge, Not now, type, two reads. It has captured start pages
    for the action nodes, and steps 6 and 7 are rerun as `d`-steps, as in rounds 0054-0055.

## Commands run and observed results

Fail-first, before the change. From `packages/fluxiq`:
`pnpm.cmd exec vitest run src/.../tests/refuted-result/tests/carried-steps-as-saved.test.ts` gave `6 failed (6)`:
- not-run listing: `AssertionError: expected [ 1, 2, 3, 4, 5 ] to deeply equal []`
- gate: `AssertionError: expected { …(2) } to be undefined`, received `{"issueCodes": ["llm_evidence_loop.full_run_required"]}`
- replay: `AssertionError: expected [ 1, 2, 3, 4, 5, 6, 7 ] to deeply equal [ 1, 2, 4, 5, 6, 7 ]`. The Merge, step 3,
  gets an outcome, and the test also asserts `ok`.
- stopped round: `AssertionError: expected +0 to be 1`. The judgement never tested the Flow.
- brief: `expected 'This build is repair attempt 1 of at …' not to match /rerun each step|still rerun live|rer…/u`.
  The body quoted "rerun each step of your draft live" and "5. ... but each is still rerun live (amend_draft rerun)".
- carried step changed or missing its start: `expected [ 1, 2, 3, 4, 5, 6, 7 ] to deeply equal [ 2, 4 ]`

After the change:
- The same file plus `flow-draft/carried-step` plus `brief-rerun-carried.test.ts`: `Test Files 3 passed (3)`,
  `Tests 13 passed (13)`.
- The brief's set: `pnpm.cmd exec vitest run` over `$R/flow-bootstrap/ $R/llm/node-tools/ $R/flow-draft/ $R/recovery/ $R/service/runtime-adaptation/ $R/tests/service-bootstrap/`,
  plus `$R/tests/refuted-result/`. Result: exit 0, `Test Files 221 passed (221)`, `Tests 2618 passed (2618)`,
  `Duration 127.53s`.
- `pnpm.cmd run check` (tsc) after the final edit: `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq ..."}`,
  then a re-run gave `"reuse" ... "inputs and outputs match the stamp"`, `exit 0`.
- `node scripts/structure-audit.mjs` (repository root). The first run failed:
  `FAIL [imports] .../carried-steps-as-saved.test.ts: ... "../../../llm/loop-configuration.ts"`. I fixed it with a
  test-local `loopSeed` that mirrors `automationStudioLlmEvidenceLoopSeedSteps`. The re-run printed
  `structure-audit: passed (261 warning(s), 349 baselined).` and the file was re-run: `6 passed`.
- These runs include other workers' uncommitted `result-verification/**` edits in the same tree, and all passed.

## Item 4: does the downstream domain accept a candidate's replay of an element click or type with no handle?

Yes, read-only. This is the path the build test uses:
- `domain/src/runtime/llm-evidence/node-run/run.ts:171-183`. A call carrying `replay` goes to `replayWebOutputNode`
  and returns before the `target_not_a_handle` refusal at `run.ts:283-286`. That refusal only applies to a live run
  the model asks for.
- `node-run/replay.ts:273-344` (`replayStep`):
  - Permission is checked against `value.consequences` (`:288`). The candidate sends `consequences: []`.
  - `resolveWebPlanNode` (`:309`) answers `unchanged` for parameters with no handle
    (`plan-resolution/resolve-plan-node.ts:47`, `:376`).
  - The written parameters are used as they are (`:333`) and sent with `executeAction` (`:344`).
  - `targetAbsentBefore` (`:434-446`) pre-checks only when the parameters hold a string `selector`, so the stored
    `element {tagName, accessibleName}` is not pre-checked.
- `node-run/verify.ts:116-150` covers a lasting candidate sent as `verify`. It resolves the same way (`:128`), reads
  `element` as the target (`:139`, `TARGET_KEYS` `:103`) and asserts visible and enabled with `web.dom.assert`
  (`:150`).
- Live evidence from the same run: the build test `0028-test-core.run_node` sent `replay: "step"` for
  `web.output.dom-type` with `element {input, "Search Brightaisle"}` and no handle, and got back
  `core.replay.replayed` with `effectApplied: true`. That call also carried a `selector`. The saved node has none, but
  playback 0036 ran the saved node's parameters successfully.

## Not verified

- No live run. The fail-first test drives the gate, replay and judgement with a stand-in host, not the web domain.
- The full multi-round path (`phases.ts` through `round-ending.ts`) with candidates on a stall ending is not tested,
  and it is known to lose candidates (see below).
- `pnpm check` at the repository root and the full suites were not run, per the brief.

## Open questions or contradictions found (outside my files)

1. **`RT/flow-bootstrap/unfinished-build/round-ending.ts:30`** handles the `unusable_decisions` stall with
   `steps.map((step) => structuredClone(step))`. That clone drops candidate correspondence, so
   `automationStudioFlowBootstrapRepairSeed` has nothing to carry over. Every round of muw60j7c stopped this way:
   48× `stopped: unusable_decisions` in the requests. On that path steps 1, 2, 4 and 5 would still be listed for the
   next round. Fix: after the clone, set `copy.scheduledCandidate = step.scheduledCandidate` and call
   `automationStudioFlowDraftCopyScheduledCandidate(step, copy)`, as `RepairSeed` now does.
2. **`RT/result-verification/build-test/summary.ts:303`** (`automationStudioBuildTestUntestedCarried`) counts a
   carried step with outcome `not_run` as untested. A carried Merge now has no outcome, so a non-yes judge verdict
   would carry `untestedCarried: [3]`. `judgement.ts` would then mark the round `not_tested`, and `resume.ts:183`
   would say "rerun them live" of the Merge. The one-line fix, which belongs to the result-verification owners, is to
   filter out `automationStudioFlowDraftStepCarriedJoin` there. The judge's account also shows the Merge as `not_run`.
3. **`RT/flow-draft/dry-run.ts`** (`automationStudioFlowDraftReplayable` / `ReplayFrom`) is where the join skip
   really belongs. The gate and `judgement.ts` filter joins before calling it, but `phases.ts:439` calls
   `input.replayable(toTest)` unfiltered, only to decide whether to announce "Testing the Flow so far". A Flow with a
   carried Merge is now tested without that announcement.

Lesser points:
- A merge inside a repeat span is still sent through `replay-span.ts` and would fail. This does not happen with
  seeded loops, because their framing Merges are dropped.
- Configuration includes position, so a candidate is invalidated by any change to the step, including marking it
  optional, and by a drop or insert before it. Such steps are then correctly listed for a rerun.
- `brief.ts` cannot name the unrunnable steps by number, because it is composed in
  `service/runtime-adaptation/refuted-result-port.ts:92` before the draft is seeded. The numbers come from the test's
  refusal and the round's judgement instead.
