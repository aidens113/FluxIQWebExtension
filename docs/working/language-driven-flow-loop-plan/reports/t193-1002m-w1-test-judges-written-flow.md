# t193-1002m-w1: the test judges the Flow as it will be written

Worker report (worker-high), revised after the lead's review. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`,
branch `task/t193-live-self-repair`. `R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing
committed.

## Outcome

Done. Task A was accepted as first delivered; only its comments changed. Task B is revised as the lead asked:

- The two-replay allowance is back.
- The `unchanged` line is attached to every refusal of a Flow whose signature equals the last refused one, in two
  wordings.
- `completion.test.ts` passes unchanged and was never edited.

The narrow set has one failure: `recorded-windows` "everything-store-run4". It fails the same way with both of my
behaviour changes switched off (round 1).

## What changed and why

### Task A (R1-C1): every judgement reads the Flow as it will be written

- New `R/flow-draft/interruption.ts` has one export, `automationStudioFlowDraftStepAnsweredInterruption(step)`. It is
  true when `interruption === true`, there are no acts, no routing, and the step is proposed. This is the definition
  `automationStudioFlowDraftInterruptionStepIds` used. The file imports only `./step.ts`, so there is no cycle.
- `R/flow-draft/routing.ts`: `automationStudioFlowDraftConditionalStepIds` adds every step that passes the predicate.
  That set feeds:
  - the replay (reanchor and verdict)
  - the gate's `madeOptional`
  - step-place `firstBlocking`
  - `run-flow-part.ts`
  - the sometimes-present scan

  A step that claims an act stays mandatory.
- `R/flow-draft/sometimes-present.ts`: `automationStudioFlowDraftInterruptionStepIds` keeps its name and is now built
  from the predicate, so there is no copy.
- `R/flow-draft/index.ts`: exports `./interruption.ts`.
- Revision: comments in `interruption.ts`, `routing.ts`, `tests/routing.test.ts`, the gate test and the doc no longer
  say "a correct Flow was refused". They now say the test refused the Flow on that step alone, while every later step
  replayed. The debug shows the draft was otherwise wrong: the napkins were named on a link press, and "+" came after
  Add to cart.

### Task B (R1-C3), revised: an unchanged refused Flow is told so

`R/llm/node-tools/dry-run-gate.ts` was restored from HEAD and B re-applied:

- `MAX_REPLAYS_OF_ONE_DRAFT = 2`, its comment, `refused.replays` and every existing gate test expectation are as in
  HEAD. An unchanged refused Flow is replayed twice, then refused from those replays without a third.
- On a replay whose Flow signature equals the last refused one (`again`), the feedback gets
  `unchanged: "Nothing in the Flow changed since the last test, and it failed the same way again. Change step 26 (failed) before you say the Flow is ready: rerun it with a corrected argument (amend_draft rerun), mark it optional, or drop it."`
- On the no-replay refusal (the existing `.again` branch), it gets
  `unchanged: "Nothing in the Flow changed since that test, so it would fail the same way, and it was not run again. Change step 26 (failed) before you say the Flow is ready: ..."`.
- One addition beyond the brief, so the line stays true: if the second replay failed on different steps or answers
  than the first (`sameFailures` compares reset plus the blocking `[step, status]` pairs), the replayed wording reads
  "...and it failed again." instead of "...the same way again.".
- Steps named are the blocking outcomes not excused by the conditional or withheld sets. The feedback shape is
  otherwise the existing one.
- `R/flow-draft/tests/dry-run.test.ts` and `R/llm/node-tools/tests/replay-draft-verify.test.ts` were restored from
  HEAD, because their round-1 edits existed only for the removed rule.

### Tests

- `R/flow-draft/tests/routing.test.ts`: an interruption step is in the conditional set, and a verdict with its replay
  failed passes. An act step, or one not proposed, is not in the set.
- `R/llm/node-tools/tests/dry-run-gate.test.ts` (HEAD plus new tests at the end):
  - A: draft 2, 11 (interruption), 12, 13 (act). Step 11 failed, the Flow passes, and the draft is not rewritten.
    With an act on 11 it is refused `core.replay.failed`.
  - B: the second completion replays (`dryrun.2.*`) and carries the replayed wording. The third does not replay
    (`ran: []`, `attempt: 2`) and carries the not-replayed wording. A second replay that fails differently carries
    "...and it failed again." and names steps 26 and 30. A changed draft is replayed and has no `unchanged`.
- `R/llm/node-tools/tests/step-place-done-again.test.ts`: the put-back passes over a failed interruption step, and
  the rerun runs (cart 2).

### Docs and generated reference

- `docs/architecture/automation-studio/llm-flow-bootstrap.md`:
  - The interruption paragraph says the test passes over such a step.
  - The dry-run exemptions include it, and every judgement reads one set.
  - The "replayed at most twice" sentence is kept and the `unchanged` line is added. The live-run sentence was
    corrected as above.
- Both `framework-reference.md` files were regenerated. The last regeneration also picked up the other worker's
  concurrent `verify-only.ts` exports, because the file is shared and generated.

## Commands run and observed results (revision)

All from `packages/fluxiq` unless noted.

1. Revised B tests against the HEAD gate (gate swapped in temporarily, then restored):
   `npx vitest run R/llm/node-tools/tests/dry-run-gate.test.ts` gave `Tests 2 failed | 34 passed (36)`. The two
   failures are the "replayed once more ... not run again" test and the "failed again on other steps" test. With the
   revised gate: `Tests 36 passed (36)`.
2. Narrow set:
   `npx vitest run R/flow-draft/tests R/llm/node-tools/tests R/flow-bootstrap/authoring/tests R/flow-bootstrap/reachability/tests R/llm/decision-handlers/tests R/llm/decision-context/tests R/llm/evidence-loop/tests R/activity R/llm/tests/evidence-loop-seeded-draft.test.ts R/llm/tests/context-window.test.ts src/ui/activity-action/tests`
   gave `Test Files 1 failed | 101 passed (102)`, `Tests 1 failed | 954 passed (955)`. The only failure is
   `recorded-windows.test.ts` everything-store-run4. `completion.test.ts` passed and is unedited.
3. After the build, rerun of
   `npx vitest run R/flow-draft/tests R/llm/node-tools/tests R/llm/decision-handlers/tests R/llm/decision-context/tests R/flow-bootstrap/authoring/tests`
   gave `Tests 1 failed | 430 passed (431)`. The failure is the same recorded-windows test.
4. `npx tsc --noEmit -p .`:
   - First run: `tsc_exit=2`. The errors were only in the other worker's files, `flow-draft/tests/verify-only-acts.test.ts`
     and then `verify-only.test.ts` (10) and `instructed-acts/tests/choice-order.test.ts` (5).
   - Rerun after they settled: no errors.
5. Core root: `node scripts/structure-audit.mjs` gave `structure-audit: passed (223 warning(s), 349 baselined).`
6. Core root: `node scripts/docs-reference.mjs --check` reported stale twice while the other worker was editing. After
   `node scripts/docs-reference.mjs` it printed `Wrote ... (3013 public declarations).` and the check printed
   `Deterministic framework reference is current.`
7. Core root: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193-w1 core build r2" pnpm build`:
   - First run failed in `fluxiq:build` on the other worker's
     `instructed-acts/contracts.ts(217,74): error TS2552: Cannot find name 'AutomationStudioInstructedChoiceAfterAct'`.
     I did not fix it.
   - Rerun (`r3`): `fluxiq:build` stored (60427 ms), `client-gateway-websocket:build` reused, `web:build` built.
     `dist/.../dry-run-gate.js` contains `replayed_differently` and `dist/.../flow-draft/interruption.js` exists.

## Not verified

- No live or Lab run of 1002-M step 11, of the 0029 rerun, or of the model reading the `unchanged` line.
- No full suites were run.
- recorded-windows was not run on a clean HEAD checkout. In round 1 it failed with both behaviour changes switched off.
- The build and tsc ran on a tree that also holds the other worker's in-progress edits (`verify-only.ts`,
  `replay-draft.ts`, `run-flow-part.ts`, `instructed-acts/**`).

## Open questions or contradictions found

1. `recorded-windows` everything-store-run4 is not caused by this change and needs its own owner. Rows D32, D38 and D42
   differ: for example, `rerun.23` is not run after `rerun.23.place`.
2. `framework-reference.md` is shared and generated, and the other worker's exports moved it during my run. Whoever
   integrates should regenerate it once after both workers finish.
3. The "failed again" fallback wording is my addition beyond the lead's two wordings. It exists so that a second
   replay failing on other steps is not described as failing "the same way".
