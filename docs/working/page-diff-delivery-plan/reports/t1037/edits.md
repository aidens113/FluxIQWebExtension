# t1037 W3 `edits` report

## Outcome
Done. Old grammar unchanged when the new option is absent; all acceptance checks pass.

## What changed and why (Core, `packages/fluxiq/src`)
- `runtime/flow-authoring/draft/amendment/edits/` (new, barrel `index.ts`, exported via `amendment/index.ts`): `changes.ts` (`AUTOMATION_STUDIO_FLOW_DRAFT_EDIT_CHANGES` = keep, drop, result, repeat, unrepeat, bind), `schema.ts` (`AUTOMATION_STUDIO_FLOW_DRAFT_EDIT_SCHEMA`: keys step, change, input, through, over, while, most, act, place), `is-edit.ts`, `left-out.ts`, `result.ts`, `put-in-over.ts`, plus `tests/edits.test.ts`.
- `amendment/changes.ts`: the const stays the old 13; the change type now also accepts the edit changes (so `result`).
- `amendment/types.ts`: refusal reasons `not_an_edit`, `not_a_read`.
- `amendment/apply.ts`: `options.grammar?: "framework"`. Under it: a change outside the six is `not_an_edit` (before any lookup); `keep` on a left-out step (`drafted` a reason, `disposition: taken`) is applied as `add` (same checks and refusals); `drop` as today; `result` on a read (observe and proposable) sets `result: true`, `disposition: kept`, a non-read `not_a_read`, an already-result and kept read `already_so`; a `repeat` whose `over` is a left-out read puts it in (put back if the repeat is refused); every applied keep/drop/result/repeat deletes `drafted`. Absent option: no code path changes.
- `draft/entry.ts`: `authored?: boolean | "framework"`; `FRAMEWORK_INSTRUCTION` added to `AUTOMATION_STUDIO_FLOW_DRAFT_GUIDES`; left-out lines show `out: <drafted reason>` under framework (an existing `cancels`/`coveredBy` out wins). Test added in `draft/tests/entry.test.ts`.
- `llm/decision-handlers/types.ts`: optional `draftEdits?: "framework"`. `decision-handlers/amendment.ts`: passes `grammar: "framework"` through `amendmentChecks`; under it a `rerun` is filtered out before the rerun request and refused `not_an_edit` (never carried out); keep-adds-nothing words use a framework version. `llm/evidence-loop/held-amendments.ts`: `settle` options carry `grammar` through (needed, one field).
- `llm/draft-amendment-feedback/{refusal-reasons,fallback}.ts`: words for the two reasons. `flow-authoring/bootstrap/evidence-loop-steps.ts`: both reasons allowed.
- Tests: `decision-handlers/tests/amendment-told.test.ts` (appended describe; that directory is at the 25-file limit, so no new file), `draft-amendment-feedback/tests/edit-refusals.test.ts`.

### Outside my ownership list (needed so `pnpm --filter fluxiq check` passes; additive, flag for the supervisor)
- `src/ui/activity-action/refusal-words.ts`: two lines, `not_an_edit` and `not_a_read` ("that is not one of the changes the draft takes", "that step does not read, so it cannot be the result"); the type forces every reason a word there.
- `src/runtime/llm/decision-handlers/tests/refusal-way-out.test.ts` and `src/runtime/llm/tests/draft-amendment-feedback.test.ts`: the exhaustive-by-type reason tables got the two keys.

## The telling's exact words
FRAMEWORK_INSTRUCTION: "Core drafts the Flow from the calls that worked, in the order they ran, leaving out looks, failures, repeats, undone presses and dead ends: each line left out says why under out. Make it lean with amend_draft: repeat for steps done again for each item or page, bind for typed values that change between runs, result for the read that holds the answer, drop for waste, keep to put back a step that was left out. A step joins the Flow by running it. What did something lasting is never done again for a draft edit. The Flow is tested whole from its start."

not_an_edit: "That change is not one the draft takes. The Flow is drafted from the calls that worked, and it is edited with six changes only: keep puts back a step that was left out, drop takes a step out, result names the read that holds the answer, repeat and unrepeat loop steps done again per item or page, bind makes a typed value a parameter. To do something else, run the call that does it."

not_a_read: "result names the read that holds the answer, and that step does not read: a press or another act changes something and is never the result. Name the step that reads the answer."

Handler under framework, keep-adds-nothing: "keep adds nothing here: ... keep puts back only a step the framework left out (its out line says why). A step joins the Flow by running it: ... with act naming it. ..." (no "add").

## Commands and results
- Core, `NODE_OPTIONS=--max-old-space-size=3072`, heavy gate `t1037-edits`, `vitest-groups.mjs --groups=parallel,real-sql` over draft, bootstrap, decision-handlers, draft-amendment-feedback, evidence-loop, provider-task, automation-activity, decision-context, repeat-guard, step-log, llm/tests, flow-bootstrap-commands, deepseek-bootstrap (first full pass, before the typed-stub rewrite): `Test Files 558 passed | 1 skipped (559)`, `Tests 6012 passed | 2 skipped (6014)`.
- Same after the final edits over draft, bootstrap, decision-handlers, draft-amendment-feedback, evidence-loop, provider-task, llm/tests, automation-activity, ui/activity-action: `Test Files 515 passed | 1 skipped (516)`, `Tests 5868 passed | 2 skipped (5870)`.
- `pnpm --filter fluxiq check` (heavy gate): first run exit 1 (three exhaustive tables, listed above); after the fix exit 0, no `error TS` lines (draft/compose type-checked clean too).
- `node scripts/structure-audit.mjs` (Core root): first run 3 violations of my own (`as never` casts, 26 files in decision-handlers/tests, barrel import); fixed; now `structure-audit: passed (572 warning(s), 903 baselined)`.
- Downstream `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 545 model-facing Core files, 14211 string literals)`.

## Not verified
- The loop does not set `draftEdits` or `authored: "framework"` yet (phase 2; `evidence-loop.ts` is not mine), so the handler flag is tested with a stood-in context, not through a real loop run.
- `result` clearing another step's `result: true` is left to compose (the drafting function), not to apply.
- A repeat that is accepted by `route` but taken back later by repeat revalidation does not put a pulled-in left-out read back out.
- No provider calls, no live browser.

## Open questions
- Phase 2 must also swap the draft-edit schema the decision is offered (`AUTOMATION_STUDIO_FLOW_DRAFT_EDIT_SCHEMA`) in `evidence-loop-decision.ts`, and pass `draftEdits` into the handler context.
