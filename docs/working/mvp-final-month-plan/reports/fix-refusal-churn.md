# t287 Refusal churn (lead report)

Brief: `docs/working/mvp-final-month-plan.md`, "Briefs: fix every open item of the week report", t287 bullet.
Trees: `fxwork/t287/` (Core and downstream, branch `task/t287-fix-refusal-churn`). Core edits only; no commits.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime` in Core.

## Items

| Item | Source | Owner | Status |
| --- | --- | --- | --- |
| Lane B cause 6: a no-op `drop` beside no-op keeps escapes "keep adds nothing" | `run-mux6pndp-16feb842.md` row 6 | lead | done |
| `mustvzvg` C4: `changes_nothing` worded for a step that never ran | `run-mustvzvg-99695308.md` C4 | worker B | done, verified |
| W2: every refusal / no-change answer names the exact way out (audit) | week report W2 | worker B | done, verified |
| W10 `mustvzvg` C3: a rerun merges over the refused attempt | `run-mustvzvg-99695308.md` C3 | worker A | done, verified |
| W10 `murdouox` R3: a left-out key of a restated map is kept | `run-murdouox-*.md` R3 | worker A | done, verified |
| Lane C R3-2: an unchanged rerun is answered `applied` / `draftState: changed` | `run-mux6naez-6c20f26e.md` R3-2 | lead | done (group 2) |
| W2: refusals of one kind 3 in a row end the round and test what exists | week report W2 | lead | done (group 2) |

## Lane B cause 6 (lead, done)

- Cause: `keepOnly` in `R/llm/decision-handlers/amendment.ts` required every amendment to be `keep`; a decision of
  no-op keeps plus a `drop` of a step already out (refused `already_out`) changed nothing yet was not told
  "keep adds nothing".
- Fix: `keepOnly` now also accepts a `drop` of a step that was out before the decision (`outBefore`), with at least
  one `keep` present; the instruction says "keep on a step already in the Flow or drop of a step already out".
- Test: `R/llm/decision-handlers/tests/keep-adds-nothing.test.ts`, "is said too when the no-op keeps come with a drop
  of a step already out". Fail-first observed: `- "keepAddsNothing": true` missing (1 failed, 2 passed). After the fix:
  `npx vitest run src/programs/automation-studio/runtime/llm/decision-handlers/tests/` -> 7 files, 26 tests passed.

## Group 1 (C4, W2 way-out audit, W10 C3 and R3): workers A and B, verified by the lead

- W10 (worker A, `reports/t287-rerun-merge.md`): `R/llm/evidence-loop/rerun-input.ts` -- an object the patch writes
  out again (more entries repeated as shown, or renamed, than left out) drops the keys the model saw and left out;
  keys withheld by the domain's denied evidence keys are kept; the patch root and a node's `parameters` are never a
  restatement. `rerun-request.ts` passes `deniedEvidenceKeys` into the merge. The draft step keeps no refused key
  names, so C3 is fixed by the same rule (0061's exact patch drops the stray `maxPages`).
- C4 and W2 (worker B, `reports/t287-refusal-next.md`): `R/llm/draft-amendment-feedback.ts` -- every amendment
  refusal reason now carries a numbered `next`, with or without a checklist (`wayOut` / `fallback`); a
  `changes_nothing` about a step that did not work says the call was refused before and would be again, and to change
  what its refusal named. Tests: `R/llm/tests/draft-amendment-feedback.test.ts` (split for the 800-line budget),
  new `R/llm/decision-handlers/tests/refusal-way-out.test.ts`, `R/llm/evidence-loop/tests/stalled-amendments-replay.test.ts`
  (pinned refusals with no `next`).
- Lead validation (Core t287 tree, `packages/fluxiq`):
  - `npx vitest run` on `llm/{decision-handlers,evidence-loop,evidence-progress,decision-context,repeat-guard}/tests`,
    `llm/tests/{draft-amendment-feedback,evidence-loop,repeat-policy}.test.ts`: 50 files, 499 tests passed.
  - Tests elsewhere that pin the changed wording (`activity/tests/observer.test.ts`, `llm/step-log/tests/answer-step.test.ts`,
    `tests/deepseek-bootstrap/tests/answerability.test.ts`, `flow-bootstrap/unfinished-build/tests`): 28 files, 252 passed.
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0. `structure-audit:check`: passed (265 warnings, 349 baselined).
  - `pnpm.cmd build`: exit 0.
- Owed by other streams (not edited): `R/flow-draft/amendment/schema.ts:24` still says "a key left out is kept"
  (t283 S2 owns it; replacement text in `t287-rerun-merge.md`); repeat-guard `FAILED_AMENDMENT_INSTRUCTION` (t281),
  `R/llm/node-tools/tool-failure.ts`, `unusable-decision.ts` `amend_not_offered`, and recording `resultReason` on the
  draft step -- each listed in `t287-refusal-next.md`.
- What a live run should see: refusals of every reason carry `next` naming the step and the amendment or call to
  send; a rerun of a refused read that restates its `extractList` no longer carries the refused key; a column map
  restated without a column loses it; keeps beside a drop of a step already out hear "keep adds nothing".

## Group 2 (R3-2, W2 stop, owed ways out): lead, 2026-10-06

Done by the lead (agent limit blocked workers). All Core, `R` as above.

- **R3-2, the unchanged rerun's answer.** Cause: the amend_draft row is recorded before its rerun runs, as
  `draft_rerun`, appliedCount 1, `draftState: changed`, and nothing corrected it once
  `automationStudioLlmEvidenceSettleHeldAmendments` found the rerun unchanged; the rerun's own tool row also recorded
  `draftChanged` from the new step id. Fix: `decision-handlers/amendment.ts` `correctRerunRow` sets
  `resultReason: rerun_changed_nothing`, `amended`/`appliedCount` to what else landed, `draftState: unchanged`, and
  rewrites the step-log answer; `evidence-loop.ts` records the rerun's row `draftChanged` false when settled unchanged
  (line-neutral). `step-log/answer-step.ts` (no stream owns it): an explicit `AUTOMATION_STUDIO_LLM_STEP_LOG_ANSWER_REWRITE`
  rewrites a written row with verdict, applied and reason recomputed from the row; a `draft_rerun` row reads `ignored`
  only once it carries `rerun_changed_nothing`. The model's own history already said "unchanged" (checked in
  `run-mux6naez` 0041's request); the wrong words were in the trace row and answer folder.
- **R3-2, near-identical reruns finding the same rows.** In `run-mux6naez` the rerun answers 0036-0062 differ only in
  `read.commandId/startedAt/finishedAt` (checked by key diff, no page data read). New `decision-handlers/rerun-result.ts`
  compares a rerun's answer with its step's earlier answer with those keys and Core's `rerunPlace` removed (no key
  for a `rerunCheck`); the same answer counts as no progress (through `RerunChangedNothing`) and the model is told
  under `core.rerun_result` that the change made no difference to what the step found.
- **W2 stop, refusals of one kind 3 in a row.** New `evidence-progress/refusal-run.ts` (counter, max 3) and
  `decision-handlers/refusal-run.ts`: kinds are an amendment decision that changed nothing (its refusal reasons
  sorted, or `keep_adds_nothing`), a rerun that changed nothing or found the same, and a mutating or proposing call
  the page refused with nothing applied (by result code, except retry-later codes; looks excluded). Anything between
  breaks the run. At 2 the model gets `core.refusal_run` ("one more ... ends this exploration ... tested and judged as it
  stands"); at 3 the round stalls through `unusableDecisions.stalled` with `draft_amendments_refused` or
  `repeat_refused`, so `not-done.ts` needs no change. An edit that undid itself is left to the no-progress guard.
  Hooks: `amendment.ts`, `refused-repeat.ts`, one line-neutral call in `evidence-loop.ts` (still 800 lines).
  `repeat-guard/retry-later.ts` now holds the retry-later pattern, used by `outcomes.ts` and the run.
- **Owed ways out.** `repeat-guard/feedback.ts`: a refused rerun that did not work now names `rerun step N` with
  the rerun shape, and that a key the patch does not write stays (set it to null). `tool-failure.ts` +
  `decision-handlers/failed-call.ts`: a failed call names the draft step it became and the rerun to send.
  `unusable-decision.ts` `amend_not_offered`: says why editing was not offered and to run a tool call with add true,
  or complete.
- Integration fix: `decision-handlers/tests/refusal-way-out.test.ts` lacked `settings_rewrite_run` in its exhaustive
  record after the dev merge (`fluxiq:check` TS2741); added.
- Tests (fail-first observed for each): `decision-handlers/tests/rerun-unchanged-told.test.ts` (new, 3; 2 failed first),
  `evidence-progress/tests/refusal-run.test.ts` (new, 3) and `decision-handlers/tests/refusals-of-one-kind.test.ts`
  (new, 4; 6 of 7 failed first), `step-log/tests/answer-step.test.ts` (rewrite case), `tests/evidence-loop-tool-failure.test.ts`
  and `evidence-loop/tests/repeat-guard.test.ts` (wording; failed first), `refusal-way-out.test.ts` (amend_not_offered;
  failed first). Changed expectations: `repeat-guard.test.ts` t227 and run-36 cases now stall one decision sooner
  (the first rerun found the read's rows; three `act_already_named` in a row), each commented.
- Validation (Core t287 tree):
  - `npx vitest run src/programs/automation-studio/runtime/llm`: 162 files, 1609 tests passed.
  - `flow-bootstrap`, `recovery`, `activity`, `result-verification`, `runtime/tests`: 294 of 298 files passed. The
    failures were 15 s timeouts in service tests, a different set on each of two runs. The 20 service files that
    failed in either run, run alone: 20 files, 112 passed (the P3/P4 load timeouts, t289's item).
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0. `structure-audit:check`: passed (267 warnings, 349 baselined).
  - `pnpm.cmd build`: exit 0.
- What a live run should see: an identical rerun's answer folder says `ignored` / `rerun_changed_nothing` and
  `draftState: unchanged`; a rerun whose rows match its step's gets `core.rerun_result` and counts toward the stop;
  the second same-kind refusal in a row carries `core.refusal_run`, and the third ends the round with the Flow tested;
  a failed call names its step and rerun.
- Not done / owed: `flow-draft/amendment/schema.ts:24` (supervisor). Recording `resultReason` on draft steps
  (`evidence-loop.ts` `draftRecord`, `R/flow-draft/step.ts`) so C4 can quote it -- not done: `evidence-loop.ts` is at its
  800-line budget. The UI (`R/activity/**`, t288) reads trace rows live and does not see the post-settle correction.
