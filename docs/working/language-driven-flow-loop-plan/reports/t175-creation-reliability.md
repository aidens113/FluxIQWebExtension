# t175: creation reliability (lane lead report)

Worker report. Core worktree `C:\Users\osrs_\FluxStuff\fxwork\t175\!FluxIQ`,
branch `task/t175-creation-reliability`. Nothing committed. No live runs, no
provider calls.

Status: **done** (five fixes landed, validated; no live measurement).

## What the evidence says fails

Read from `lane-summary.md` (both rounds), the six `lane-run-*.md` debugs,
`mvp-today-plan.md` Current State (runs 1-4), and the t173 reports.

Already fixed before this lane, so not re-done here (confirmed in the Core
tree at 259a11b): completion reports every gate at once and names the
profile limit (`llm/harness-options/bootstrap-completion.ts`,
`flow-bootstrap/plan/profile-limits.ts`); a drafted plan is held to the
Flow's own limits, not a reply's; instructed lasting acts are checked at
completion (`flow-bootstrap/instructed-acts/`); an exhausted build keeps its
draft (t173-C); the start step is restored and a rerun keeps what it replaces
until it works (t173-K8); the wrap-up refuses tools it did not offer.

What is left is the stall itself. Walking every iteration table, the commonest
decision that changed nothing is an `amend_draft` that was refused, **and then
the same amendment again**:

| Run | Decisions | Pattern |
| --- | --- | --- |
| bigbox r2 `mum0ke7z` | #7, #8, #10, #12, #22-23, #25 | #7 drops four refused presses; #8/#10/#12 refuse "d3" three times (the one step that worked, i.e. a `keep` confirmation); #22-25 identical refusals |
| everything-store r2 `mum06sfc` | #16-#19 | 5 of 5 refused, identical targets, four decisions running |
| crossborder r1 `mulxsbyy` | #12-#15, #22-23, #26, #29-30 | one step dropped, kept, dropped (kept count 4, 5, 4, 4), all `draft_amended`, so invisible to the guard |
| bigbox r1 `mulx76vv` | #17, #19, #21, #26 | same five targets refused again and again |
| classifieds `mulxk0ro` | #13-#14 | identical refusal twice |
| job board `mulwm2dc` | #19-#20 | refused twice |

The bundles keep codes and step ids, not amendment words, so the causes below
were found by reading the code paths those codes can come from.

### Causes (Core source, before this lane)

1. **A step that did not work is listed as `kept`, under an instruction that
   says it worked.** `flow-draft/entry.ts` lists every action step, refused ones
   included (the web domain declares refused calls with `proposes: true` and
   `effectApplied: false`, `domain/.../node-run/run.ts:395-420`), with
   `disposition: "kept"`, `inResult: false`; the draft instruction said "every
   step here is something you actually ran **and that worked**". A model
   reading that drops the refused step (which *applied*, so it looked like
   progress) or keeps it (refused `already_so`).
2. **`already_so` is false in the model's reading and names nothing to do.**
   `flow-draft/amendment.ts` refused a `keep` of a kept step and a `drop` of a
   dropped one with one reason, told as "The step already says that". For a
   refused step (`inResult: false`), "keep" being "already so" contradicts what
   the draft shows; for a step in the Flow, `keep` is a confirmation, and the
   refusal did not say that nothing needs confirming.
3. **A refusal given again was told as news.** `llm/draft-amendment-feedback.ts`
   had no memory: the fourth identical refusal read exactly like the first.
4. **Toggling a step is invisible to the no-progress guard.** `llm/evidence-loop.ts`
   counted an amendment decision as no progress only when it applied nothing.
   A drop/keep/drop cycle applies each time.

## Fixes landed

Each has a test that failed before and passes after; the replay is
`llm/evidence-loop/tests/stalled-amendments-replay.test.ts` (Core), a
provider-free scripted run of the recorded shapes: 4 of its 5 original cases
failed against the unchanged tree (the fifth is the control), all 6 pass now.

### Fix 1: refusals name the side of the Flow and what to do (`flow-draft/amendment.ts`, `llm/draft-amendment-feedback.ts`)

- New closed reasons: `did_not_work` (any edit but `rerun` about a step whose
  effect did not apply: "already out; the only amendment that changes it is
  rerun with a corrected argument; if the Flow does not need it, leave it"),
  `already_in_flow` (`keep` of a step in the Flow: "nothing to confirm, do not
  keep it again; run what the Flow lacks, or complete"), `already_out` (`drop`
  of a withdrawn step). `already_so` remains for routing and reorder no-ops.
- A drop of a refused step used to *apply*; it is now refused, so a decision of
  only such drops counts as no progress, which is what it is.
- Type-exhaustive vocabularies updated: `flow-bootstrap/evidence-loop-steps.ts`
  (published trace allow-list); the service trace sanitizer is shape-based and
  needed no change.

### Fix 2: the draft shows a failed step as out (`flow-draft/entry.ts`)

- A listed step with `effectApplied: false` shows `disposition: "did_not_work"`
  (display only; the stored disposition is unchanged).
- The full and brief instructions no longer say every step worked; both say a
  `did_not_work` step is already out and only rerun changes it, and that there
  is nothing to confirm. Held to the existing byte pins: full 1,047 -> 1,052
  bytes (the tightest pin has 53 bytes of margin), brief 575 -> 618.

### Fix 3: repeated refusals and undone edits (`llm/evidence-loop/amendment-memory.ts`, new; `llm/evidence-loop.ts`)

- The loop remembers each refusal (step, reason, node) and each draft state it
  stood at (step ids, dispositions, routing, settings).
- A refusal given before is marked `repeated: true` in the amendment check, with
  "it will be refused again however often it is sent: stop sending it".
- An applied edit that puts the draft back exactly as it stood is recorded as
  `llm_evidence_loop.draft_amendment_undone`, shown with
  `sameDraftAsIteration`, and counted as a step without progress, so the
  redirection fires on the third toggle instead of never. A tool call between
  two edits makes the draft new, so that is not flagged (tested).
- `evidence-loop.ts` stays at 800 lines (a re-export comment was condensed).

### Fix 4: an unusable reply is shown every decision it was offered (`llm/unusable-decision.ts`, `llm/evidence-loop.ts`)

- Cause: every lane-t172 build had one to three `llm_output.invalid_evidence_decision`
  replies (crossborder #32-#34 three in a row). The feedback's `accepted`
  picture listed `tool_call` and `complete` only, never `amend_draft`,
  though amending is the commonest decision a hard build makes (7 to 20 per
  build). A malformed amendment was answered with a picture of every decision
  except the one being made.
- Fix: the loop passes what it offered (`tools`, `complete`, `amend`), and the
  picture lists exactly those, including an `amend_draft` shape. A caller that
  does not say gets all three.
- Test: replay case "shows an unusable reply every kind of decision it was
  offered". Checked against HEAD's `unusable-decision.ts` (copied in
  temporarily): it failed with `['tool_call','complete']`. With the fix it passes.

### Fix 5 (supervisor addition): the start-step restoration is published

- Cause: `llm/harness-options/bootstrap-completion.ts` computed the t173-K8
  restoration and kept only `.steps`, dropping `restored`, so no record said
  the Flow judged had a step the model had taken out.
- Now: `flow-bootstrap/reachability/start-step.ts` adds `withdrawnAs`
  (`dropped` | `exploratory`) to `restored`. The completion check returns
  `restoredStep: { step: <draft position>, withdrawnAs }` on accepted and
  refused verdicts alike. The loop records it on that completion's trace row
  (`complete` or `unusable`). It is carried by every rebuilder:
  `llm/evidence-loop-decision.ts` (check parser),
  `llm/evidence-loop/completion-attempt.ts`, `llm/evidence-loop/trace.ts`,
  `service/flow-bootstrap-commands/evidence-trace.ts` (stored-trace sanitizer),
  and `flow-bootstrap/evidence-loop-steps.ts` (published step, builder and
  parser). Content-free: an integer and a closed word. The check-side reader
  is `automationStudioLlmEvidenceParseRestoredStep` in
  `llm/evidence-loop-decision.ts`, beside the answerability reader. The
  record-side reader is `evidenceStepRestoredStep` in
  `flow-bootstrap/evidence-loop-steps.ts`, and the service sanitizer uses that
  one.
  - **Pitfall hit and fixed:** importing that reader as a *value*, either from
    `llm/evidence-loop/index.ts` into `evidence-loop-decision.ts` or from
    `llm/index.ts` into `evidence-loop-steps.ts`, closes a module cycle. Tests
    pass alone and fail in a broad run with "X is not a function" in unrelated
    files (deepseek refusal, verify_result grant, service generation). Both
    readers are now local and import types only across the boundary.
- **Where the Lab reads it:** `build.evidenceLoop.steps[]`, on the step whose
  toolId is the completion or unusable decision id, as the object
  `restoredStep: { step, withdrawnAs }`, the same object-of-scalars shape as
  `evidenceLoop.incompleteDraft`. On a failed build it is also in the failure
  diagnostic's `evidenceLoop.steps`. The downstream projection is t177's.
- Tests:
  - `bootstrap-completion.test.ts`: the restore case asserts `restoredStep`,
    plus a new refused-and-restored and not-restored case. Both failed against
    HEAD's `bootstrap-completion.ts` (copied in temporarily) and pass now.
  - `completion-attempt.test.ts`: new loop case, where refused and then
    accepted rows both carry it.
  - The rebuilder test (`service/.../evidence-trace.test.ts`) holds the member.
  - `start-step.test.ts` covers `withdrawnAs`.

## Validation (final tree, all five fixes)

All run in the Core worktree. vitest was limited to `--minWorkers=1 --maxWorkers=2`
with `--exclude '.tmp/**'`.

- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (195 warning(s), 355 baselined)`,
  no FAIL. It also printed "1 baseline entries can be lowered", which is
  pre-existing and not from these files. `llm/evidence-loop.ts` stays at 800
  lines.
- Broad focused run (`--testTimeout=60000`) over `runtime/flow-draft`, `runtime/llm`,
  `runtime/flow-bootstrap`, `runtime/recovery`, `runtime/exploration-reduction`,
  `runtime/service/flow-bootstrap-commands`, `runtime/tests/service-bootstrap`,
  `runtime/tests/llm-deepseek-flow-bootstrap.test.ts` and
  `runtime/tests/deepseek-recovery-requests.test.ts` ->
  **Test Files 158 passed (158), Tests 2004 passed (2004)**.
- Heavy suites alone (`--testTimeout=600000`): `runtime/tests/deepseek-bootstrap-exploration.test.ts`
  (including the 26-decision exhaustion replay) and `runtime/tests/service-adaptation`
  -> **Test Files 17 passed (17), Tests 86 passed (86)**, 407 s.
  - In earlier broad runs these hit 30 s, 120 s and 180 s timeouts under the
    shared machine's load (the deepseek file took 595 s). They passed with no
    code change once they had the time.
- Fail-before evidence:
  - The replay's original 4 cases failed on the unchanged tree (shown above).
  - The unusable-reply case and the two restoredStep completion cases failed
    with HEAD's version of their source file copied in, then passed. The copy
    was restored from the scratchpad and confirmed by `git diff --stat`.
- Expectations that legitimately changed:
  - `flow-draft/tests/amendment.test.ts`: `already_in_flow` and
    `already_out`, plus a new did-not-work case.
  - `flow-draft/tests/entry.test.ts`: two rows show `did_not_work`.
  - `llm/tests/draft-amendment-feedback.test.ts`: the keep refusal reason, and
    the exhaustive reason map.
  - `llm/tests/evidence-loop-tool-failure.test.ts`: the failed row shows
    `did_not_work`.
  - `flow-bootstrap/reachability/tests/start-step.test.ts`: `withdrawnAs`.
- Downstream: no source changed. A grep of `domain/src`, `packages` and `apps`
  finds no reader of the changed refusal reasons, draft rows, feedback shapes
  or accepted shapes. Domain type-checking resolves Core through `dist`, so it
  was not re-run against unbuilt source.

## Changed files (Core, under `packages/fluxiq/src/programs/automation-studio/runtime/`)

- New:
  - `llm/evidence-loop/amendment-memory.ts`
  - `llm/evidence-loop/tests/stalled-amendments-replay.test.ts`
- Source:
  - `flow-draft/amendment.ts`
  - `flow-draft/entry.ts`
  - `llm/draft-amendment-feedback.ts`
  - `llm/evidence-loop.ts`
  - `llm/evidence-loop/index.ts`
  - `llm/evidence-loop/completion-check.ts`
  - `llm/evidence-loop/completion-attempt.ts`
  - `llm/evidence-loop/trace.ts`
  - `llm/evidence-loop-decision.ts`
  - `llm/unusable-decision.ts`
  - `llm/harness-options/bootstrap-completion.ts`
  - `flow-bootstrap/reachability/start-step.ts`
  - `flow-bootstrap/evidence-loop-steps.ts`
  - `service/flow-bootstrap-commands/evidence-trace.ts`
- Tests:
  - `flow-draft/tests/amendment.test.ts`
  - `flow-draft/tests/entry.test.ts`
  - `llm/tests/draft-amendment-feedback.test.ts`
  - `llm/tests/evidence-loop-tool-failure.test.ts`
  - `llm/evidence-loop/tests/completion-attempt.test.ts`
  - `llm/harness-options/tests/bootstrap-completion.test.ts`
  - `flow-bootstrap/reachability/tests/start-step.test.ts`
  - `flow-bootstrap/tests/evidence-loop-steps.test.ts`
  - `service/flow-bootstrap-commands/tests/evidence-trace.test.ts`
- Outside the brief's listed areas, touched because they own the behaviour:
  - `flow-draft/`: the draft the model is shown, and the amendment refusals.
  - `service/flow-bootstrap-commands/evidence-trace.ts`: one of the four trace
    rebuilders, which must carry a new row member.
- No recovery, result-verification or runtime-adaptation file (t176) was
  edited. The amendment change is generic, and the recovery suites pass.

## Not verified

- **Whether a live model now wastes fewer decisions.** The replay pins what
  Core shows and counts. It cannot pin how a model answers. The expected effect
  on the recorded runs is below; it needs a live run, which this lane may not
  make.
  - Bigbox r2 had 4 drops of refused presses (#7). Those are now refused
    `did_not_work` and counted as no progress. Its 3 identical "keep"
    refusals (#8, #10, #12) now say `already_in_flow` and then `repeated`.
  - Everything-store r2 #16-#19: the 2nd to 4th refusals are marked `repeated`.
  - Crossborder r1 #12-#15: the toggles count as no progress, and the redirect
    fires on the third.
- The Lab and panel display of `restoredStep`: the downstream projection is
  t177's.
- Domain `tsc` against a rebuilt Core `dist`.

## Not done, recommended next (by expected effect on decision count)

1. **More than one action per decision.** Bigbox's recorded script needs about
   20 actions. At one action per decision and about 34 affordable decisions,
   the slack for looking and correcting is almost nil, even with no stall.
   This is a grammar, loop and domain change (handles move after a page
   changes), too broad for this lane.
2. **The per-decision input size (~16k tokens)** is what turns a 600k token
   grant into about 34 decisions.
3. Invented locators (`target_not_a_handle`), `no_repeating_structure` and
   shadow-DOM effects remain the other large sources of wasted decisions.
   They belong to the domain and extension lanes.
