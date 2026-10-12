# t378 W8: loop guard and pace (worker-high)

## Brief

### Brief: t378-w8-loop-guard-and-pace (worker-high)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- User rule (binding): when a trial meets an interruption such as a site's "you're going too fast" notice, the build adapts the Flow: a branch on that page state that waits, presses the dismiss control and returns to the loop where it was, plus a pace between iterations that grows after a rate limit; the saved Flow keeps both. The runtime half is done (W7: wait node pauses; Flow node `metadata.paceMs`, key `AUTOMATION_STUDIO_PACE_METADATA_KEY` in `R/executor/pacing/pace-metadata.ts`, is honoured and raised after a hinted failure; the trial record carries `learnedPaces[{subflowKey,nodeKey,paceMs}]`; trial feedback names the slow-down, row and wait). This brief is the script half and the saved-Flow half.
- Task:
  1. Guarded group in a loop: `optional: yes` is allowed on a step inside a repeat span (today refused at `R/flow-bootstrap/authoring/assemble.ts:318-320`, and the optional's failed->merge branch would be refused inside a span by `draft-routing.ts:316-318`; wire it inside the span in the repeat lowering). Steps that directly follow an optional step and say `only after: <its label>` run only when it was done (optional success -> those steps -> join; failed -> join); then the pass goes on where it was. Refuse, naming the line and the fix, an `only after:` that names a step that is not optional, not directly before the group, or in another span or block. Works outside spans too.
  2. `repeat pace: <duration>` on a span's first step (beside `repeat over:`/`repeat while:`): `<n> ms|s|seconds|min|minutes`, a bare number is seconds; it becomes plan node field `paceMs` on that step's node.
  3. Plan node `paceMs` (positive integer ms, bounded): add it to the plan node type, accept it in `R/flow-bootstrap/plan/parsing.ts:107` (today `bootstrap.unexpected_field`), and carry it to Flow node `metadata.paceMs` where the plan becomes a Flow (`R/flow-bootstrap/adaptation.ts` metadata blocks ~:195-271; find every such place).
  4. Promotion `R/service/candidate-trial/promotion.ts` (:20, :69): the deciding trial's `learnedPaces` raise the matching plan node's `paceMs` (larger of authored and learned) before the Flow is saved, so the saved Flow keeps the learned pace, not only the audit detail. W7's report explains the record.
  5. Guidance and a parsed example in the candidate-only `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT` (`R/flow-bootstrap/plan/flow-script-format.ts`): when a trial says a step in a loop met a site's request to slow down (feedback names the row and the wait), adapt the Flow: right after that press inside the span, a step that closes the site's notice if it shows (`optional: yes`), then `only after:` that step a `builtin.timing.wait` of at least the named wait; and `repeat pace:` of at least that wait on the span's first step. Do not touch the legacy `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` (byte guard). Keep W2's existing example tests passing and extend them.
  6. Refusal locator (W1): every new Core-generated node maps to the written step that caused it; every new refusal code is covered by `R/flow-bootstrap/candidate/tests/refusal-locator-corpus.test.ts` (its source scan fails otherwise).
- Constraint: `R/flow-bootstrap/authoring/` holds 25 entries and the structure audit caps a directory: group your new files (and move related existing ones, with barrels) into a subdirectory rather than adding files beside them.
- Required reads: the files named; reports in `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/`: `w7-runtime-pace.md` (pace contract, item 5), `w1-refusal-locator.md` (locator design); lane D rate-limit analysis section 1 (read-only) `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-d-candidate-w1-rate-limit.md`.
- Owns: `R/flow-bootstrap/**` (authoring, plan, candidate, adaptation and their tests), `R/service/candidate-trial/promotion.ts` and its test.
- Must not touch: `R/executor/**`, `R/activity/**`, `R/llm/**`, other `R/service/**` files, `packages/contracts/**`, downstream, any other tree, lab slots or processes. Other workers edit those now; an error only in a file you do not own is theirs: record it, do not fix it.
- Definition of done: fail-first tests: an in-span optional dismiss plus an only-after wait assembles into the guarded shape and its locator lines are right; `repeat pace: 6 s` lands as `metadata.paceMs` 6000 on the Flow node; promotion raises a node's pace from `learnedPaces` into the saved Flow; the new example parses and assembles. `npx vitest run <paths>` from `T/!FluxIQ` (authoring, plan, candidate, candidate-trial tests, plus the adaptation tests); `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files; `node scripts/structure-audit.mjs` shows no violation in your files. Never commit; no `pnpm build`; no Lab run or provider call. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w8-loop-guard-and-pace.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

**Partial.** All six brief items are done and tested, and every Definition-of-done check passes. One gap remains, in a
file this brief does not let me touch, and it matters for live use:

- **The runtime does not yet treat a guarded group's optional step as optional.**
  `R/executor/step-skip/optional-step.ts` (`automationStudioOptionalStepWayOn`) counts a step as optional only when its
  `failed` edge and its `success` edge enter **the same** Merge. A step with a group after it has a different shape:
  `success` goes to the wait, and `failed` goes to the join after the wait. So when the notice is absent:
  - the step is not skipped as absent;
  - it goes through its retries and then the recovery ladder's "Follow failed route", which spends recovery and reroute
    budget on every pass;
  - in a long loop the budget runs out and the run fails.

  An optional step with nothing after it (the old shape) is still recognised. The proposed fix and a tripwire test are
  below under "Open questions". **Until that executor change lands, the slow-down example would not survive a pass
  where the notice is absent.**

Paths below are relative to R.

## What changed and why

### 1. Guarded groups: `optional:` inside spans, and `only after:` (item 1)

- **Placement.** The new module could not go in a subdirectory of `flow-bootstrap/authoring/`. The audit's 9-segment
  depth limit refuses any such file (first audit run: 5 `naming` FAILs for `authoring/script-statements/*`). It is
  therefore the sibling directory `flow-bootstrap/script-statements/`.
  - W1's `authoring/repeat-bound.ts` and its test moved there. That leaves `authoring/` at 23 source files, below the
    25-file limit.
  - The module reads authoring's types through the authoring barrel only (`import type`).
  - It reads a step's node through a `definitionOf` callback that the assembler passes in, so there is still only one
    matcher.
  - Its refusals go through its own `statement-refusal.ts`, which always names a line.
  - Result: no barrel bypass and no module cycle; the audit is clean for these files.
- **`flow-bootstrap/script-statements/guarded-steps.ts`** (`automationStudioFlowScriptGuardedSteps`). Replaces
  `optionalScriptSteps` and `repeatedScriptSteps`, which were removed from `authoring/assemble.ts`.
  - The shape is: `optional.failed -> join (Merge)`, `optional.success` falls into the first guarded step, and the last
    guarded step falls into the join.
  - The `failed` branch is marked with the new `guard: true` field on `AutomationStudioFlowScriptBranch`.
  - When a span ended at the group's last step, the span-head's `repeat.through` is rewritten to the join, so a pass
    that skipped the group still closes the loop.
  - With no `only after:` steps, the shape is unchanged from before (existing tests pass as written).
- **Refusals.** All `only after:` refusals use `flow_script.only_after_misplaced`, at the `only after:` line, with a
  fixed sentence and the fix. An `only after:` is refused when it:
  - names no step;
  - names a step in another block;
  - names a step that is not optional;
  - is not written directly after the group;
  - is in another span than the step it names;
  - sits on a step that is also optional;
  - sits on a step that branches or runs a block;
  - sits on the last step of a `repeat while` span.

  An optional step that is the last step of a `repeat while` span (the check that repeats it) is still refused, with
  `flow_script.optional_misplaced`. An optional step inside a span is no longer refused.
- **`script-statements/script-spans.ts`.** The span membership the passes share. A step whose only repeat lines are
  `most:` or `pace:` starts no span.
- **`authoring/parse.ts`.** Reads `only after: <label>` as `step.onlyAfter`, and `repeat pace:` as `repeat.pace` and
  `paceLine`.
- **`authoring/contracts.ts`.** Adds:
  - `onlyAfter` and `paceMs` on the step;
  - `pace` and `paceLine` on the repeat;
  - `guard` on the branch;
  - the type `AutomationStudioFlowScriptOnlyAfter`.
- **`authoring/draft-routing.ts` `scriptSpan`.** Exempts `guard` branches from `repeat_body_branches`. A branch the
  model wrote inside a span is still refused.

### 2. `repeat pace:` (item 2)

- **`script-statements/repeat-pace.ts`** (`automationStudioFlowScriptRepeatPaces`) runs first in
  `routeAutomationStudioFlowScriptRepeats`, before the `repeat most:` bounds.
- **Format.** `<n>` followed by `ms`, `s`, `sec`, `seconds`, `min` or `minutes`; decimals are allowed and a bare number
  is seconds. The value must be from 1 ms to 10 min.
- **Placement.** The pace is set as `paceMs` on the span's first step, and `assemble.ts` `buildNode` writes it onto that
  step's plan node. As with `repeat most:`, a pace written under a member of the span is moved to the span's first step.
- **Refusals.**
  - `flow_script.repeat_pace_misplaced`: no span takes it, or the span already has a pace.
  - `flow_script.repeat_pace_invalid`: the time cannot be read, or is out of range.

### 3. Plan node `paceMs` (item 3)

- **`plan/contracts.ts`**: adds `paceMs?: number`.
- **`plan/limits.ts`**: adds `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PACE_LIMITS` (`{minPaceMs: 1, maxPaceMs: 600_000}`).
- **`plan/parsing.ts`**: accepts `paceMs`. A value that is not a safe integer inside the bound is
  `bootstrap.invalid_pace`.
- **`adaptation.ts`**: writes `metadata[AUTOMATION_STUDIO_PACE_METADATA_KEY]`, imported from `../executor/pacing/`.
- **Every place a plan becomes a Flow.** I searched `runtime/` and found one: `adaptation.ts`. Validation's
  `layoutNodes` spreads the node, so the field survives it. Two other places read plan nodes but save no Flow:
  - `service/flow-bootstrap-commands/build-judge.ts` `planNodes` builds the judge's view only;
  - `llm/node-tools/draft-from-flow.ts` reads a Flow back as a draft and does not carry `paceMs` (see Open questions).

### 4. Promotion keeps the learned pace (item 4)

- **`service/candidate-trial/promotion.ts`.** The `withLearnedPaces` step raises each matching node's `paceMs` to the
  larger of the authored pace and the deciding trial's learned pace.
  - It does this in both `buildPlan.plan.subflows` and the laid-out `buildPlan.subflows`.
  - A learned pace above the plan's bound is held to the bound, and one that is not a positive integer is ignored.
- **Audit detail.** `learnedPaces` stays on the `candidateTrial` detail. A new `raisedPaces` field
  (`{subflowKey, nodeKey, authoredMs?, paceMs}`) names each node that was actually raised.
- **Plan and digest.** The stored draft is not changed. The proposed plan differs from the digest the trial judged; that
  is intended, and the header comment says so (W7 open question 2).

### 5. Guidance and example (item 5)

- **`AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`** gains three guidance lines and a third example, "a loop the site asked
  to slow down":
  - a confirm with `repeat over`, `repeat through: cooldown` and `repeat pace: 6 s`;
  - an `optional: yes` dismiss of the site's notice;
  - a `builtin.timing.wait` of 6 s with `only after: notice`.
- **Legacy format untouched.** `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` was not changed: the digest test passes.
- **`AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE`** (candidate-only) loses the clause "never inside a repeat", which now
  contradicts the loop format.
- **`plan/issue-feedback.ts` `AUTHORED_CODES`** gains the new codes. It also gains the three optional codes, which were
  absent, so the model now sees the sentences that name the fix.

### 6. Locator and corpus (item 6)

- **Locator.** The join carries `cause` set to the optional step's line. The loop nodes keep W1's `cause`, which is the
  step that says repeat.
- **Locator test.** It asserts every node's place: the join maps to "notice" at line 15, and the two Merges and the For
  Each map to line 8.
- **Corpus cases.** `refusal-locator-corpus.test.ts` gains 6 cases:
  - 3 for `only_after_misplaced`;
  - 1 for `optional_misplaced` at the end of a while span;
  - `repeat_pace_misplaced`;
  - `repeat_pace_invalid`.
- **Corpus source scan.** It now reads `authoring/` and `script-statements/` recursively, ignoring `tests/`. A new
  assertion checks that the scan reaches the statement sources.

### Tests (new and changed)

- **New:**
  - `authoring/tests/guarded-loop.test.ts`:
    - the in-span shape, with its edges, validation and pace;
    - the locator places;
    - the out-of-span group;
    - an optional step that ends a span;
    - two `it.fails` tripwires for the runtime gap.
  - `script-statements/tests/guarded-steps.test.ts`: every refusal, and a group of several members.
  - `script-statements/tests/repeat-pace.test.ts`: units, invalid values, misplaced paces, a pace moved from a member,
    and a `while` span.
  - `flow-bootstrap/tests/pace.test.ts`: `repeat pace: 6 s` reaches Flow node `metadata.paceMs` = 6000 through parse,
    validate and `normalizeAutomationStudioFlowBuildPlan`, and is read back by `automationStudioAuthoredPaceMs`.
- **Extended:**
  - `plan/tests/parsing.test.ts`: plan `paceMs` accepted and refused;
  - `plan/tests/loop-format.test.ts`: the guidance, and the new example building its shape with `paceMs` 6000;
  - `plan/tests/flow-script-format.test.ts`: the example list, and the optional clause;
  - `service/candidate-trial/tests/promotion.test.ts`: the raise, authored above or below the learned pace, the bound,
    and none learned.
- **Changed expectations (they encoded the old behaviour the brief lifts):**
  - `optional-step.test.ts`: "refuses an optional step inside a repeat" became "takes an optional step inside a repeat".
  - W7's promotion test "leaves the plan as the trial judged it" became "raises the matching node's pace".

## Commands run and observed results

All commands were run from `T/!FluxIQ`. Here P = `packages/fluxiq/src/programs/automation-studio/runtime`.

| Command | Observed result |
| --- | --- |
| Baseline before editing: `npx vitest run P/flow-bootstrap/authoring P/flow-bootstrap/plan P/flow-bootstrap/candidate P/service/candidate-trial P/flow-bootstrap/tests` | 2 failed, 580 passed (59 files). The 2 failures are pre-existing (see below). |
| Final: the same set plus `P/flow-bootstrap/script-statements` | Test Files 2 failed, 61 passed (63). Tests 2 failed, 620 passed (622). Only the same 2 pre-existing failures. |
| Fail-first: each change disabled in place (files backed up to scratch), run `guarded-loop`, `script-statements/tests`, `pace`, `parsing`, `loop-format`, `promotion` and the corpus. The disabled changes: guarded-steps made inert; the pace pass skipped; the adaptation metadata line removed; `paceMs` taken off the parsing allowlist; promotion given no learned paces | 33 failed, 30 passed, 5 skipped (the corpus `beforeAll` threw). Every new test failed. All 5 files were restored, and `cmp` reported each identical. |
| After the restore, the same 9 files | 68 passed (68). |
| Wider read-only run: `P/llm/harness-options P/llm/node-tools P/service/flow-bootstrap-commands P/flow-draft P/executor/step-skip P/executor/pacing P/service/candidate-failure` | 92 files, 918 tests passed. |
| `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` | No output (clean), on the final tree. |
| `node scripts/structure-audit.mjs` | `structure-audit: 4 violation(s) across 3 rule(s)`, exit 1. **None is in my files.** See the breakdown below. |

The two pre-existing test failures belong to other workers:

1. `flow-bootstrap/tests/plan.test.ts`: `expected 6074 to be less than 6000`. This is the legacy completion schema size
   after W2's deliberate legacy clause. I did not change the legacy schema; its digest test passes.
2. `flow-bootstrap/candidate/tests/submission-refusal.test.ts`: it expects `call:...:[0-9a-f]{8}` and receives
   `call:flow_bootstrap.evidence_completion_parameters_unresolved`. The refusal-run key printing in
   `llm/decision-handlers/` has evidently changed. That is another worker's area.

The four structure-audit violations, none in my files:

- `as-never` in `activity/tests/call-context.test.ts`;
- `as-never` in `executor/tests/slowdown-recovery-words.test.ts`;
- `directory-files` on `executor/tests/` (26 files);
- `file-lines` on `executor/graph-run.ts` (814 lines).

My files raise advisory warnings only: `adaptation.ts` is at 402 lines (it was about 397), and `authoring/` holds 23
files.

## Not verified

- **No live, Lab or browser run, and no provider call** (the brief excluded them). It is not shown that a model given
  the new guidance writes the example's shape, nor that a 6 s pace avoids lane D's 7th-press refusal.
- **The runtime path through a guarded group with the notice absent.** It fails today: see Outcome. It was checked only
  as far as `automationStudioAbsentStepSkip` returning `undefined` (the `it.fails` tripwires). The recovery ladder's
  budget behaviour in a long loop was inferred from reading `recovery-ladder.ts`, not run.
- **A dismissal inside a `repeat over` span may be handed the pass's row.** For Each sends `item` to every member whose
  node declares an `item` input, and in the test registries the click does. Whether the extension then looks for the
  notice's close control inside the row was not checked; that is downstream.
- **A JSON plan (not a script) cannot say `paceMs`.** `authoring/json-plan.ts` was not changed.

## Open questions or contradictions found

1. **Executor change needed (blocking for live use).** In `R/executor/step-skip/optional-step.ts`
   `automationStudioOptionalStepWayOn`, accept a step as optional when its `failed` edge enters a Merge, and its
   `success` path reaches that same Merge through single-way-on, non-branching steps.
   - Keep the existing `failed.targetNodeId === success.targetNodeId` case, and bound the walk (for example 32 steps,
     no revisits).
   - The way on stays the `failed` edge.
   - This file is owned by the executor lane. When it lands, change the two `it.fails` in
     `authoring/tests/guarded-loop.test.ts` to `it`; they will start failing to say so.
2. **The brief's subdirectory constraint conflicts with the audit's depth limit.** `authoring/` sits at 9 segments, so
   any subdirectory of it fails `naming`. I used the sibling `flow-bootstrap/script-statements/`. Its import design
   avoids the barrel-bypass ratchet and module cycles; see item 1.
3. **A pace is lost when a saved Flow is read back as a draft.** `llm/node-tools/draft-from-flow.ts` carries no
   `metadata.paceMs` (that file is not mine). A re-authored Flow would lose both an authored and a learned pace.
4. **Wording.** The new example's dismiss target `t30` and its 6 s wait are illustrative, as the other examples' handles
   are. The guidance tells the model to read the real wait from the trial feedback.
