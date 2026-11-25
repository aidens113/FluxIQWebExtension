# t1036 c-no-look-no-search (D4, D11, D15)

## Outcome
Partial. Edits made in owned files. The machine gate never granted a slot after my first Core run (about 3 hours queued behind other jobs; my queued jobs were then killed), so the final Core vitest, `pnpm --filter fluxiq check`, all Ext domain tests and the domain check were NOT run on the final tree.

## What changed and why
Core (packages/fluxiq/src/runtime):
- llm/decision-handlers/look-withdrawal.ts: rewritten as an inert seam (nothing withdrawn or counted; `offer` only strips `actionInputKey`). Exports kept because evidence-loop.ts (not mine) still imports and calls them.
- decision-handlers/answered-request.ts: no longer calls AskedAgain. withdrawn-actions.ts: marked retired (anthropic/decision-check.ts still reads it).
- llm/node-tools/run/node.ts: the node in `initial` (the capture node) is left out of the `node` enum the model copies from (kept only if it is the sole node). Core still runs it as the round opening. Description no longer says "a snapshot ... to see where you are".
- evidence-progress/stall-redirect.ts, planning-tools.ts: all "looking is withdrawn" words and the "page search" route removed; `lookBudget` removed. loop-configuration.ts: lookBudget validation removed, `lookWithdrawal` marked retired. `looksWithdrawn` stays as a retired optional field (evidence-loop.ts and redirect-facts.ts still pass it).
- project-agents/supervisor: look-budget.ts deleted; planning.ts, guidance.ts, index.ts no longer use it.
- unusable-decision.ts: `look_withdrawn` instruction removed. repeat-guard/{feedback,candidate-feedback,loop-detection/feedback}.ts and decision-handlers/{refusal-run,rerun-result,stall-recovery,searching}.ts: "look at or search the page" became "read the page below", "exact look" became "exact request".
- agents/tools/definition.ts: comment.
- Tests: look-budget.test.ts renamed planning-looks-never-withdrawn.test.ts (rewritten); look-withdrawal-finishing-tools.test.ts replaced by look-withdrawal-inert.test.ts; state-digest-cost, stall-redirect, run-node (new enum test), refusal-run-wording, repeat-guard feedback and supervisor planning tests updated.

Ext (domain/src/runtime/llm-evidence):
- system-instructions: version web-15; "Finding things" no longer names a page search; added "The page shown below your evidence is the page now, refreshed after every result: never ask for it. core.full_page shows the whole page, hidden elements and their attributes included, in parts." Test updated.
- harness-options (recovery): `web.recovery.find_on_page` removed (options, execute, vocabulary ids, index, test); inspect description no longer names find_on_page. The recovery `inspect` option stays (that harness has no page channel).
- vocabulary.ts: find_on_page marked retired (id stays like the other retired ids: tools.ts indexes it and test-runner reads recorded runs). call-words.ts keeps the id for recorded runs. node-run/run.ts comment.

## Commands run and observed results
- Core vitest (parallel,real-sql) on decision-handlers, prior-nodes, project-agents/supervisor, evidence-progress, repeat-guard, node-tools, harness-options, llm/tests, anthropic, before my test fixes: `Test Files 8 failed | 191 passed (199); Tests 18 failed | 1952 passed (1970)`. The 18: asked-table-replies (3, anthropic, W2's), refusal-run-wording, state-digest-cost (4), stall-redirect (4), binding, run-node (3), repeat-guard feedback, supervisor planning. All but the 3 anthropic ones were then fixed.
- Re-run of the touched files (core2): all passed except planning.test.ts (a set-equality assertion, since removed). Not re-run after the last edits (state-digest-cost closing brace, planning edit): UNVERIFIED.
- Core `node scripts/structure-audit.mjs`: 1 violation, `as-never` in llm/page-channel/tests/binding.test.ts (not mine).
- Ext `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 562 model-facing Core files, 14324 string literals)`.
- Ext `node scripts/structure-audit.mjs`: 10 violations, none in my files (stable-handles-run.test.ts spread, plan-resolution/tests and tests/ directory size, target-packets.ts 823 lines, page-view naming, imports in full-page, evidence-summary, judge-evidence).
- `pnpm --filter fluxiq check`, Ext domain tests, domain check: queued about 3 hours, killed; not run.

## Not verified
Final Core vitest; fluxiq typecheck (look-withdrawal.ts shim against evidence-loop.ts call sites; removed `lookBudget` users); all Ext domain tests (instructions, harness-options options, vocabulary).

## Edits needed in files I do not own
Core evidence-loop.ts (worker A): drop imports of AskedAgain, LookBudget, LookWithdrawal (lines 21, 27); delete 205 (`looks` creation); 254 `looksWithdrawn: ...`; 261 `looks.redirectShown`; `looks` at 363 and 369; 367 `looks.offer(x, epoch)` becomes a map stripping `actionInputKey` (`({ actionInputKey: _k, ...t }) => t`); 443 and 575 `looks.sawLook`; 444 the LookBudget call; 505 the AskedAgain call; 615 comment. evidence-loop/resume.ts lines 97, 104, 115, 142, 147, 158, 225 say "look first": reword to "read the page below". After that delete look-withdrawal.ts, withdrawn-actions.ts, `looks` in decision-handlers/types.ts, the `looks` use in prior-nodes tool-admission/tool-withdrawal, `lookWithdrawal` in loop-configuration.ts, `looksWithdrawn` in stall-redirect.ts and redirect-facts.ts.
Core anthropic/decision-check.ts: comments at 21-26 and the reader at 39/65 go with withdrawn-actions.ts. anthropic/tests/asked-table-replies.test.ts (3 tests) expects `askedAgain` true: build the narrowed schema by hand or drop them.
Core provider-task/request-messages.ts:281 "a look whose entry says prepared" to "an opening read". flow-authoring/bootstrap/plan/flow-script-format.ts:235 comment. draft-amendment-feedback/did-not-work.ts:28 "look at the page again" (in no list). answer-first act-gate.ts:53 and record.ts:147 "Look at the page" (model-facing).
The nodeCatalog text in flow-authoring may still list the capture node: check. binding.ts needs no change (my filter is in node.ts).
Ext tools.ts (W2): remove the `runWebFindOnPage` import (73), the `WEB_LLM_FIND_ON_PAGE_TOOL_ID` import (104), the find tool declaration (~329) and handler (~431-434); describe description at 341 "or a find_on_page match printed" becomes "printed on a page line". Then delete page-find/run.ts, search.ts (and query.ts, near.ts, schema-version.ts if describe does not use them) and trim page-find/index.ts. Tests that mint handles through find must use a capture instead: page-find/tests, plan-resolution/tests, structure/tests/target-binding, rejection-next/tests, tests/vocabulary.test.ts:50, the apps/extension crossborder e2e spec.
Ext page-view/header.ts lines 6 and 54: remove " · find_on_page searches the rest" (the model reads it). page-view/element/index.ts:3 and structure/detect.ts:76 comments. docs/architecture page-evidence.md (592, 605, 683, 858) and testing-facility.md (97, 116) mention find_on_page.
test-runner loop-replay/read-steps.ts keeps find_on_page in LOOKS on purpose (recorded runs).

## Remaining "look" and "find_on_page" in model-facing text
Core: flow-authoring reset-settlement and site-reset words use "look" for a read node that names an act (kept: a read, not the retired command); node-tools/run/part.ts:68 "look for yourself" (plain English); the not-owned items above. Ext: only retired-id comments and the call-words and vocabulary entries for recorded runs, plus tools.ts:341 and page-view/header.ts:54 (not owned, above).

## Open questions
`web.recovery.inspect` (a model-requested capture on the recovery path) is kept because that harness has no page channel. Confirm.
