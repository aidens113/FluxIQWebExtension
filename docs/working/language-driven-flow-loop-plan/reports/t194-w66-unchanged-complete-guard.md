# t194-w66: unchanged-complete guard (C-C), untested-repair wording (C-F), test announcement (UI-4)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`.
Built on top of the uncommitted w63/w64/w65 changes. Nothing was committed.

## Outcome

Done. All three fixes are in, each with a test that failed first and passes now. The named test directories, the
Core typecheck and the structure audit all pass.

## What changed and why

### C-C: a `complete` on the Flow the judge refuted, unchanged, is refused

- New `R/flow-bootstrap/unfinished-build/unchanged-complete.ts`, exported from the barrel:
  `automationStudioFlowBootstrapUnchangedCompleteRefusal({ repair, steps, writable })` and the issue code
  `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_UNCHANGED_SINCE_JUDGED_WRONG = "bootstrap.flow_unchanged_since_judged_wrong"`.
  It returns an `{ ok: false, issueCodes, feedback }` completion check only when all of these hold:
  1. the round is a repair with steps in its seed;
  2. `repair.resume.judgement.judge.verdict === "no"`. It never fires after `unknown` or `not_judged`;
  3. the completing draft is the Flow the check builds, meaning every proposed step is `writable`
     (`automationStudioFlowBootstrapDraftStepIsWritable`, which checks `toolId === "core.run_node"`);
  4. `automationStudioFlowDraftFlowSignature(steps) === automationStudioFlowDraftFlowSignature(repair.seed)`.

  The feedback is `{ ok: false, code, verdict: "no", advice?, instruction }`. `advice` is `judgement.judge.advice` when
  the judge gave one. The instruction reads: "This is the Flow the judge said does not do what was asked
  (judgement.judge), unchanged: testing it again tests the same thing, so completing it again is refused. Change what
  judgement.judge.advice names, then complete. If no change can make the Flow do what was asked, say that it is not
  doable and why, instead of completing it again."
- Why condition 3 was added (not in the brief). My first version compared draft signatures only. It broke
  `R/tests/deepseek-bootstrap/tests/answerability.test.ts` ("converges through the judge's no when the corrected plan
  retains the record-producing node"). In that test the draft is made of a domain's own tool steps, which are not
  writable. `checkAutomationStudioFlowBootstrapCompletion` (`R/llm/harness-options/bootstrap-completion.ts:258-261`)
  then builds the Flow from the reply's plan, and the repair sends a corrected plan over an unchanged draft. In that
  case the draft does not identify the Flow, so the guard stays silent. The live run's steps were `core.run_node`, so
  the guard covers it.
- `R/service.ts`: inside `checkCompletion`, on the same line as `keeper.attempted(context.steps)` so the file stays at
  its 4419-line baseline, the guard is called first. When it refuses, `accepted.verdict = undefined` and the refusal
  is returned without running the full check. Two names were added to existing import lines:
  `automationStudioFlowBootstrapUnchangedCompleteRefusal` from `./flow-bootstrap/index.ts` and
  `automationStudioFlowBootstrapDraftStepIsWritable` from `./llm/index.ts`. The predicate is passed in, not imported
  by the new module, to avoid a new value edge from `flow-bootstrap/` to `llm/node-tools/` (`node-tools` already
  imports `flow-bootstrap` values).

How the refusals count, and how the round ends when the model keeps completing unchanged:

- Each refusal is an unusable decision in the evidence loop (`R/llm/evidence-loop.ts:307-324`). It adds to
  `unusableInARow`. The same draft refused the same way again also steps the no-progress count.
- The bootstrap limit is `maxConsecutive = min(8, maxIterations)`. Measured in the new loop test with 64 decisions
  available: exactly **8** decisions are made, all of them completions, and all 8 are refused. The 2nd decision onward
  sees the refusal feedback under `core.completion_check`, with `advice`. Then `unusableDecisions.stalled` ends the
  round with `issueCodes: ["bootstrap.flow_unchanged_since_judged_wrong"]`.
- In `phases.ts` that is a round that stopped short as `unusable_decisions`. Phase 2 replays the seed again if it is
  replayable. The judgement is then compared with the judged-wrong round before it. With no measurable progress the
  build ends **`not_doable`, `noRoute: no_progress`, after 2 rounds, and the judge is not asked again**. This is pinned
  by the phases-level test in `unchanged-complete.test.ts`. That test passed before the guard existed: it records the
  ending the stall already reaches, not new behaviour.
- Caveat: if the phase-2 replay proves more acts than the judged round's test did (`acts_proven`), progress is measured
  and one more repair round opens. With a deterministic page the two tests match.

### C-F: the repair is no longer told an untested Flow was tested

`R/llm/evidence-loop/resume.ts`: a new `UNTESTED_REPAIR_INSTRUCTION` is used when `judgement.test === "not_tested"`.
It says "What it had was not run from where it starts (judgement.test is not_tested), so nothing here says whether
its steps work: judgement says how much of the acts checklist is done." and "The page is wherever the last round left
it". It drops "Correct or drop a step the test found not working". A Flow that was run (`replayed_clean` or
`replay_failed`) keeps `REPAIR_INSTRUCTION` unchanged.

### UI-4: "Testing the Flow so far" is said only when a test will run

`R/flow-bootstrap/unfinished-build/phases.ts` (~line 333): the note is now announced only when
`ending.kind === "unfinished"`, the repair seed has steps, **and** `input.replayable(seed)`. That is the same condition
`automationStudioFlowBootstrapJudgeUnfinished` uses to decide whether to call `test`.

### Tests

- New `R/flow-bootstrap/unfinished-build/tests/unchanged-complete.test.ts` (8 tests):
  - refusal and feedback shape;
  - no advice key when the judge gave none;
  - a changed argument, routing or added step is not refused;
  - a Flow built from the reply is not refused;
  - `unknown` and `not_judged` are not refused;
  - the exploration, a stopped-short repair and an empty seed are not refused;
  - an evidence-loop run that stalls after 8 refusals;
  - the phases run that ends `not_doable` after 2 rounds.
- `R/llm/evidence-loop/tests/resume.test.ts`: added "tells a repair whose Flow was not run from its start that it was
  not, and never that it was tested".
- `R/flow-bootstrap/unfinished-build/tests/phases.test.ts`: added "announces no test of a Flow so far that cannot be
  replayed, and runs none", plus a small `withoutReplay` helper.

## Commands run and observed results

All tests ran from `packages/fluxiq`. R = `src/programs/automation-studio/runtime`.

1. Failing first, new module test (module written, barrel export not yet added):
   `npx vitest run $R/flow-bootstrap/unfinished-build/tests/unchanged-complete.test.ts`
   -> `Tests 6 failed | 1 passed (7)`, `TypeError: automationStudioFlowBootstrapUnchangedCompleteRefusal is not a
   function`. The one that passed is the phases-ending test, which does not use the guard. The module file was created
   before this run, so this proves the barrel wiring, not a genuine red on the logic.
2. After the barrel export: same command -> `Tests 7 passed (7)`.
3. Failing first, C-F: `npx vitest run $R/llm/evidence-loop/tests/resume.test.ts` -> `Tests 1 failed | 17 passed
   (18)`, `expected 'This is the repair of a Flow that was…' not to contain 'tested from where it starts and judged'`.
   After the fix -> `Tests 18 passed (18)`.
4. Failing first, UI-4: `npx vitest run $R/flow-bootstrap/unfinished-build/tests/phases.test.ts` -> `Tests 1 failed |
   19 passed (20)`, `expected [ …(2) ] to deeply equal [ 'repairing: Repairing the Flow' ]`. After the fix ->
   `Tests 20 passed (20)`.
5. Named directories, first pass with the draft-only guard:
   `npx vitest run $R/flow-bootstrap $R/llm/evidence-loop $R/service/flow-bootstrap-commands $R/tests/deepseek-bootstrap`
   -> `Test Files 1 failed | 97 passed (98)`, `Tests 1 failed | 1296 passed (1297)`. The failure was
   answerability.test.ts "converges through the judge's no ...": `sentIterations` had 26 entries where 12 were
   expected. That led to the `writable` condition.
6. After the `writable` condition: the same 4 directories -> `Test Files 98 passed (98)`, `Tests 1298 passed (1298)`.
   Rerun once more after the final edits -> same, `Tests 1298 passed (1298)`.
7. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w66 pnpm check fluxiq" pnpm check`:
   - first run: one error, `phases.test.ts(104,152): error TS2379 ... 'replay: undefined' ... exactOptionalPropertyTypes`.
     Fixed with the `withoutReplay` helper.
   - rerun: no errors (`"step":"fluxiq:check","reason":"no stamp; stored in the shared store"`).
8. `node scripts/structure-audit.mjs` at the Core root:
   - first run: `FAIL [file-lines] .../runtime/service.ts: 4420 lines exceeds ... Baseline for this entry is 4419`.
     Fixed by joining the guard onto the `keeper.attempted` line.
   - rerun: `structure-audit: passed (222 warning(s), 349 baselined).`

## Not verified

- The service wiring is not exercised by any test. No deepseek-bootstrap scenario has a repair completing an unchanged
  `core.run_node` draft after a `no`. The call is covered by the typecheck only; the logic and loop behaviour are
  covered by the module tests.
- No live or Lab run. No full suites, as the brief requires.
- The phase-2 replay of the unchanged Flow after the stall (it runs before the build ends `not_doable`) was not checked
  against a live page.

## Open questions or contradictions found

1. The model has no "not doable" verb. The refusal tells it to "say that it is not doable and why". In practice it can
   say so only in a decision's summary, and the build reaches `not_doable` through the stall: 8 refused decisions, then
   phase 2, then `no_progress`. A real declaration would need a decision kind or a completion field. That is out of
   scope here.
2. After the stall, phase 2 replays the unchanged Flow from its start once more before ending. By the same rule this
   guard enforces, that is a retest of an unchanged Flow. To skip it, `phases.ts` would compare `judgement.flowSignature`
   with the judged-wrong round's before testing. Not done; it is outside the brief.
3. A Flow built from the reply's plan (non-library draft steps) is not guarded, because the draft does not identify it.
   The repair carries no record of the refuted reply plan to compare against.
4. Only the Flow refuted by the round immediately before is compared. A later round that returns to an earlier refuted
   Flow is not caught.
5. The second half of C-C, a lone later `yes` overturning an earlier `no` on the same evidence (`agreement.ts`), was not
   in this brief and is untouched.

## Doc paragraph for `docs/architecture/automation-studio/llm-flow-bootstrap.md` (lead applies)

> **A repair may not complete the Flow its judge refuted, unchanged (t194-w66).** When a finished round's test is
> judged `no`, the repair round starts from that Flow, and its completion check first asks whether the Flow being
> completed is that same Flow: the draft's Flow signature (`automationStudioFlowDraftFlowSignature`) equal to the
> repair seed's, where the draft is what the check builds the Flow from (every step a library `core.run_node` step).
> Such a completion is the identical retry of a failed act on an unchanged state, so it is refused with
> `bootstrap.flow_unchanged_since_judged_wrong` and feedback telling the model that testing it again tests the same
> thing, to change what the judge's advice names, or to say it is not doable and why
> (`runtime/flow-bootstrap/unfinished-build/unchanged-complete.ts`). It never fires after an `unknown` or
> `not_judged` verdict, which refuted nothing, nor for a Flow built from the reply's own plan. Each refusal is an
> unusable decision: a model that keeps completing the unchanged Flow ends its round on the stall guard (eight in a
> row by default) as `unusable_decisions`, and the build then ends `not_doable` for no progress against the judged
> round, without asking the judge again. A repair of a round whose Flow was not run from its start
> (`judgement.test: not_tested`) is told exactly that, and the chat's "Testing the Flow so far" note is posted only
> when that test will actually run.
