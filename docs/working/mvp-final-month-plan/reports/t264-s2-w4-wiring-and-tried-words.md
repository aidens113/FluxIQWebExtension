# t264 S2 W4: w84 wiring, w80 R3c test-refusal steps, w80 U7 "tried" words

## Outcome

Done. All three tasks are applied. `answer-feedback.test.ts` passes 3/3. The Core vitest subset fails only on the 10 failures the brief lists as pre-existing. Every check exits 0. `evidence-loop.ts` is 798 lines. Every file I touched is LF.

Paths below use the brief's prefixes:

- `R/` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`
- `U/` = Core `packages/fluxiq/src/ui/`
- `X/` = downstream `apps/extension/src/`

## What changed and why

### Task 1 (w84): `R/llm/evidence-loop.ts`

I applied W3's item 1 exactly:

- Line 183: `automationStudioLlmEvidenceLoopTraceRecorder(trace, process.env, () => evidence)`. `evidence` is a `const` declared later at line 255. The closure is only read once rows are recorded, so there is no TDZ problem, and the test run confirms this.
- Line 609: `rows.decisionStarts();` replaces `rows.draftShown = undefined;`.

The file stays at 798 lines, with the same text as lane t194 lines 183 and 609.

### Task 2 (w80 R3c)

**`R/llm/evidence-progress/progress-trace.ts`**
- Added the lane's header paragraph.
- The `checkCompletion` wrapper is now `Object.assign(async ..., { testRefused })`. It logs `completion refused by=test issues=<codes> steps=<n,n>`, using `codeOf`/`numberOf` and capped at `MAX_LISTED`, then calls the inner check's `testRefused`.
- I did not port `automationStudioReauthorTryTrace` or its type.
- W2's `automationStudioLlmBuildTrace` use is unchanged.

**`R/llm/node-tools/dry-run-gate.ts`** (only the `steps` hunks)
- The refusal-type doc paragraph.
- `steps?` on `AutomationStudioFlowDraftDryRunRefusal`.
- The `refusal()` and `refusedSteps()` helpers.
- The three `return refusal(...)` sites: unrunnable, unchanged-again and replay-refused.

The w72 hunks were not ported: the carried-step header, `automationStudioFlowDraftCarriedJoinsPassed`, `automationStudioFlowDraftStepCarriedNotRun`, the `cannotRun` filter, the `executeTool` wrap, and the `unrunnableWord` change.

**Tests**
- `R/llm/evidence-progress/tests/progress-trace.test.ts`: the lane's test, "says a completion the test refused after the check passed...", plus its import.
- `R/llm/node-tools/tests/dry-run-gate.test.ts`: the lane's test, "carries the steps it names beside its codes...".

**End-to-end proof** (the lane has none)
- I added one test to `R/activity/tests/observer.test.ts`, in the R3c describe block: "reaches the chat as sent back, with how many steps, through a traced build's own test".
- It runs the real `runAutomationStudioLlmEvidenceLoop(observeAutomationStudioEvidenceLoop(...))`:
  - with `vi.stubEnv("FLUXIQ_BUILD_PROGRESS_TRACE", "1")`;
  - with a draft seeded with two carried steps that never ran, `fullRunRequired: true`, and a model that completes.
- So the real gate refuses `full_run_required`, and the real progress trace wraps the observer.
- The test asserts:
  - exactly one "The proposed Flow was sent back to be fixed" row, with text "...can't be tested from its start yet. 2 steps need fixing.";
  - the trace line `completion refused by=test issues=llm_evidence_loop.full_run_required steps=1,2`.
- The imports grew to add `vi`, `type AutomationStudioFlowDraftStep` and `runAutomationStudioLlmEvidenceLoop`.

**Negative check.** I temporarily renamed the trace's `testRefused` key. The new test then failed ("expected [] to have a length of 1 but got +0"). After restoring the key it passed. So the trace hook is what carries the row.

### Task 3 (w80 U7)

`U/activity-action/refusal-words.ts` now holds the five values from item 3 (`amendment.changes_nothing` and `repeated.{failed,changed_nothing,same_result,same_answer}`). They are identical to lane t194's `draft-edit-refused.ts`.

Pins updated:
- `R/activity/tests/refused-call.test.ts:51,90`
- `U/activity-action/tests/refusal.test.ts:50,57,95`
- `R/activity/tests/observer.test.ts:282`, where the regex is now `/already tried exactly this way/u`
- `X/panel/chat/stream/step/tests/card-words.test.ts:130,132`

### Grep for other pins

I searched these trees for "already ran exactly this way", "ran exactly this", "running it again would give" and "already ran":

- Core `packages/`, `docs/`
- downstream `apps/extension/src`, `domain/src`, `docs/architecture`

No other pin of the old words exists. The other hits for "already ran" are unrelated prose, for example `executor/tests/retry-policy.test.ts:82` and `refusal.ts:6`.

### Line endings

`core.autocrlf=true` checks out unedited files as CRLF. W1-W3's files were already LF. I wrote every file I touched as LF:

- `evidence-loop.ts`, `progress-trace.test.ts` and `dry-run-gate.test.ts` were CRLF in the worktree before my edit.
- Node counts 0 CRLF in all ten files.

## Commands run and observed results

**Core** (run from `packages/fluxiq` unless noted)

- `npx vitest run R/llm/step-log/tests/answer-feedback.test.ts`: 1 file, 3 passed.
- `npx vitest run` on the dry-run-gate and progress-trace tests: 2 files, 45 passed.
- `npx vitest run` on the brief's ten directories:
  - `Test Files 4 failed | 147 passed (151)`, `Tests 10 failed | 1363 passed (1373)`, exit 1.
  - The failures are exactly the listed pre-existing set: accounting.test.ts (6), generation.test.ts (1), judged-build.test.ts (2) and evidence-loop/tests/repeat-guard.test.ts (1). All four are also failing in `core-test.clean`.
  - `adaptation.test.ts`, which fails in `core-test.clean`, passed this run.
- From the Core root:
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
  - `node scripts/build-cache/cli.mjs structure-audit:check`: "structure-audit: passed (246 warning(s), 349 baselined)", exit 0.
  - `pnpm.cmd build`: exit 0.

**Downstream**

- `node .../t262-gate/run-subset.mjs <abs apps/extension> t264-w4 <13 test files>`: bundle exit 0.
  - The 13 files are every `*.test.ts` under `panel/chat/stream/step/tests`, `panel/chat/view/tests`, `shared/activity/tests` and `background/activity/tests`.
  - `node_modules/fluxiq` resolves to `fxwork/t264/!FluxIQ/packages/fluxiq`, and its `dist` holds the new words.
- `node --test <13 bundles>`: tests 135, pass 135, fail 0, exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: "Core's build ... is current with its source", exit 0.

**Line counts and git status**

- `evidence-loop.ts` is 798 lines; all touched files have 0 CRLF.
- Core `git status` against my pre-edit snapshot: the only new entries are `llm/evidence-loop.ts`, `llm/evidence-progress/tests/progress-trace.test.ts`, `llm/node-tools/dry-run-gate.ts` and `llm/node-tools/tests/dry-run-gate.test.ts`. All are owned. My other files were already listed by W1-W3.
- Downstream `git status`: `card-words.test.ts` was already modified by W3, and nothing else of mine appears. The `.test-build-scratch/t264-w4` output is git-ignored.

## Not verified

- No live Lab, browser or provider run, per the brief. The chat row is proven in-process only, through the real loop, trace and observer.
- I ran no full suites, only the brief's subset.
- `dry-run-gate.ts`'s unchanged-again and replay-refused `refusedSteps` paths are covered by type-check and the existing suite, not by a new test that asserts `steps`. The lane added a test only for the unrunnable path.

## Open questions or contradictions found

1. The brief's downstream pin lines (~128, 130) are actually at 130 and 132 in this tree. Both are updated.
2. The baseline `core-test.clean` also has failures outside the brief's list: `adaptation.test.ts` (1), plus `refuted-result-port`, `proposals` and `representation` outside the subset. `adaptation.test.ts` passed this run, so nothing new is attributable to this work.
3. The negative check temporarily edited `progress-trace.ts`. It was restored and re-verified: the `testRefused:` key is present and the subset passed afterwards.
