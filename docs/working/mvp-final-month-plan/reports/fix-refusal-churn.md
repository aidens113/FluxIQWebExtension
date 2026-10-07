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
| Lane C R3-2: an unchanged rerun is answered `applied` / `draftState: changed` | `run-mux6naez-6c20f26e.md` R3-2 | worker C (not run) | open (group 2) |
| W2: refusals of one kind 3 in a row end the round and test what exists | week report W2 | worker C (not run) | open (group 2) |

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

## Remaining (group 2)

- Lane C R3-2: an unchanged rerun answered `applied` / `draftState: changed`; reruns with the same result counted as
  progress. Files: `R/llm/decision-handlers/amendment.ts`, a new file under `R/llm/evidence-loop/` or
  `decision-handlers/`, and the smallest possible edit in `R/llm/evidence-loop.ts` (supervisor's request: lane A's
  b181f4bc changed it).
- W2 stop: refusals of one kind 3 decisions in a row end the round and test what exists (new module, wired in
  `amendment.ts`, `refused-repeat.ts`, and one call site in `evidence-loop.ts`).
- Worker C's brief was written but not run: the dispatch hit the concurrent-subagent limit.
