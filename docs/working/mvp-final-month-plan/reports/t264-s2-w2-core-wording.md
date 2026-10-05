# t264-s2-w2: Core wording (lane A A5)

## Outcome

**Done.** Every A5 item listed below is now in `task/t264-core-integration-chain` (Core worktree `fxwork/t264/!FluxIQ`, uncommitted) as ported, adapted, or superseded by F6. F6's structure is kept and no deleted module was restored.

- All owned tests pass.
- The only failures in the brief's directory set are 10 that are already in the dev sweep, with the same test name and message.
- Every named check exits 0.
- `service.ts` is 4400 lines (net 0). Every changed or new file is LF, checked with node.

## Per-item table

R = `packages/fluxiq/src/programs/automation-studio/runtime/`, U = `packages/fluxiq/src/ui/`.

| Item | Result | Where / how |
| --- | --- | --- |
| w108 D2: navigate named by its site | **Ported** | `R/activity/wording/action.ts` was taken whole from the lane: `pageName` gives the host without `www.`, "the start page" for localhost, an IP or `~`, and the verb alone otherwise. The card side (w116 D2) is in `U/activity-action/action-of.ts` (`SITE_NAME`, `START_PAGE`), hand-merged onto W1's F6 version. |
| w108 D5: element `label` first | **Ported** | `elementName` in `action.ts` reads `label` before `accessibleName` and `visibleText`. |
| w108 D9: "Your Flow is ready" | **Ported** | `R/activity/build.ts`. The detail title stays "Build finished". |
| w108 D4: refused edit is a neutral line, one reason, no summary | **Superseded by F6** | `draft-edit-refused.ts` is gone. F6's card never carries the model's summary (C14), and its reasons come from Core's own words (`refusal-words.ts`). F6 deliberately lists every known reason. W1's observer test pins "that step already does that; and that step has no such value to make vary", so the "one reason only" part was not applied. See Open questions. |
| w116 D3: decision reason screen | **Ported** | `R/activity/wording/reason-text.ts` (taken whole): `{ decision: true }` drops sentences that name an act id or the draft's mechanics. `R/activity/observer.ts` applies the screen to the decision reason (hand-merged onto F6's observer). |
| w116 D15: code-only line shows nothing | **Ported** | `onlyCodes` in `reason-text.ts`, applied in every use. |
| w116 D17: older-view handle reason | **Ported** | `U/activity-action/failure-reason.ts` (taken whole). |
| w116 D21: replay reasons per code | **Ported** | `failure-reason.ts` `REPLAY_REASONS`. The observer status row now reads "didn't work when tried again". `activityActionFailureReason` is exported from `U/activity-action/index.ts`. |
| w116 D18: tool-call title | **Ported** | `R/activity/wording/tool-call.ts`: "Changing the Flow". The amend_draft decision heading therefore reads "Changing the Flow" too. |
| w116 D18: landed edit says "Changed the Flow"; bare row with no reason; identical repeat said once | **Superseded by F6** | F6 answers every edit with its own card ("Editing the Flow — done / partly done / not done"), so a landed edit is never silent and an identical repeat never reads as the same line with no result. Porting "Changed the Flow" would have added a second result line beside F6's card. `decision-answer/draft-edit.ts` is unchanged. The D18 tests in `decision-words.test.ts` were rewritten to pin the F6 behaviour (see below). |
| w116 R3 / w108 R3: `told` | **Ported**, with the `amendment.ts` merge done by hand | `R/llm/step-log/answer-step.ts` was taken whole: `amendmentCheck?`, the `told` WeakMap rewrite, and `applied` from `draftChange.appliedCount`. See the merge section for `amendment.ts`. |
| w116 item 7: build trace | **Ported** | New `R/llm/evidence-progress/build-trace.ts` plus its test. `progress-trace.ts` now writes through it, and `evidence-progress/index.ts` re-exports it. `R/llm/index.ts` gets one export (plus the lane's 2-line comment). `build-judge.ts` and `service.ts` were hand-merged; see below. |

No docs hunk was ported. The lane's `flow-authoring.md` and `llm-flow-bootstrap.md` hunks describe other units: instruction read, toggles, choice order and optional-only. None describes these items.

## The hand merges

### `R/llm/decision-handlers/amendment.ts`

t262 changed this file: `rerun-arguments`, `tellRetained`, and `held` now built whenever `rerunReplaces` is set. Only the lane's three R3 hunks were applied; the lane file was not copied.

1. `import { automationStudioLlmStepLogAnswer } from "../step-log/index.ts";` goes after the evidence-loop import.
2. The main-path `tell(...)` now passes `amended.applied + (rerun.request ? 1 : 0)`, with the lane's comment. It still runs only when `!split.held.length`, so with t262's `held` change it is unchanged in when it fires. The settle path's count is unchanged, as in the lane.
3. `tell()`'s doc comment gains the `told` paragraph. Its tail finds the latest `amend_draft` row of that iteration in `context.trace` and calls `automationStudioLlmStepLogAnswer(row, process.env, amendmentFeedback)`.

t262's `tellRetained` and `core.rerun_check` code is untouched.

### `R/service.ts`

Three lines were edited in place, with no lines added: 4400 before and 4400 after.

- Line 91: `automationStudioLlmBuildTrace` is added to the second `./llm/index.ts` import.
- Line 1471: the call is wrapped as `withAutomationStudioBuildActivity(input, () => automationStudioLlmBuildTrace.timed("build", () => this.generateFlowBootstrapAdaptationInternal(input), (built) => \`status=${built.status}\`))`. The lane's trailing comment is kept on the same line.
- Line 1821: `apply` is wrapped as `automationStudioLlmBuildTrace.timed("apply", …, (applied) => \`status=${applied.status}\`)`.

The lane's `buildJudged` and finishing-verdict lines (w118) and its flow-bootstrap import change were **not** taken.

### `R/service/flow-bootstrap-commands/build-judge.ts`

The type-only `llm` import becomes a value import of `automationStudioLlmBuildTrace` plus the same types. `ask(...)` is wrapped in `timed("judge", …, (judged) => verdict/calls/tested)`. t262's `arrival` line and import are kept. The lane test's added `describe` was taken with the test file; that file was the base version on t264.

## Other files

- **Taken whole from the lane, CR stripped.** The t264 copy equalled the lane base and every lane hunk was A5:
  - Source: `build.ts`, `wording/{action,tool-call,reason-text}.ts`, `U/failure-reason.ts`, `answer-step.ts`, `evidence-progress/{progress-trace,index}.ts`, `llm/index.ts`.
  - Tests: `activity/tests/{scope,wording}.test.ts`, `wording/tests/wording.test.ts`, `answer-step.test.ts`, `build-judge.test.ts`, `U/tests/{action-of,failure-reason}.test.ts`.
  - New files: `build-trace.ts`, `decision-words.test.ts`, `reason-screen.test.ts`, `amendment-told.test.ts`, `build-trace.test.ts`.
- **Hand-merged onto W1's F6 versions:**
  - `U/activity-action/action-of.ts`: 3 hunks.
  - `U/activity-action/index.ts`: 1 line.
  - `activity/observer.ts`: 4 hunks. These are the D3 import and call, plus the D21 doc and phrase.
- **`activity/tests/observer.test.ts` (F6 version):**
  - "Updating the draft Flow" becomes "Changing the Flow" in six expectations.
  - The test reason "Because the draft now covers…" becomes "Because the Flow now covers…", because D3 now screens "draft".
  - The rerun case's model reason "Rerunning the request listing…" is mechanics, so D3 drops it. That case now expects `thoughts()` to be `[]`, with a comment, and its card assertions are unchanged.
- **`wording/tests/reasons.test.ts`:** the two decision-title expectations now read "Changing the Flow". The lane's D4 tests are not ported, because they target the deleted `draft-edit-refused.ts`.
- **`activity/tests/decision-words.test.ts`:** taken from the lane with the D18 `describe` rewritten for F6. The three tests are:
  - a landed edit gives "Changing the Flow" with its reason plus the card "Editing the Flow — done";
  - a screened reason gives no thought, but the card still appears;
  - two identical landed edits each give heading plus card.

  The D15, D3 and D21 tests are the lane's.

## Commands run and observed results

**Core vitest, from `packages/fluxiq`**

- `npx vitest run <activity> src/ui/activity-action <llm/step-log> <llm/decision-handlers> <llm/evidence-progress> --maxWorkers=3`
  - exit 1, `RangeError: options.minThreads and options.maxThreads must not conflict` (a config clash). No tests ran, so I re-ran at the default worker count.
- `npx vitest run` on the same five directories
  - exit 0, `Test Files 43 passed (43)`, `Tests 432 passed (432)`.
- `npx vitest run` on the brief's full set: `activity`, `src/ui/activity-action`, `llm/step-log`, `llm/decision-handlers`, `llm/evidence-progress`, `llm/evidence-loop`, `service/flow-bootstrap-commands`, `result-verification`, `tests/service-bootstrap/tests`, `tests/deepseek-bootstrap`
  - exit 1, `Test Files 4 failed | 125 passed (129)`, `Tests 10 failed | 1158 passed (1168)`. Log: `<scratchpad>/t264-w2/vitest-all.log`.
  - All 10 are in the dev sweep `sweep-2026-10-05/core-test.clean` with the same test name and the same message:
    - `accounting.test.ts` (6);
    - `generation.test.ts` (1), `flow_bootstrap.provider_transport_unknown`;
    - `judged-build.test.ts` (2), including `expected [ false, false ] to deeply equal [ false, true, true ]`;
    - `llm/evidence-loop/tests/repeat-guard.test.ts` "t227's list read rerun eight times…" (1). This one is not in the brief's list of three, but the sweep has it at line 1733 with the identical message `expected '{"ok":false,"code":"llm_evidence_loop…' to contain 'running it again changes nothing'`. It is pre-existing.

**Core root**

- `node scripts/build-cache/cli.mjs fluxiq:check`
  - exit 0, `"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq…","source":"command"`.
- `node scripts/build-cache/cli.mjs structure-audit:check`
  - exit 0, `structure-audit: passed (245 warning(s), 349 baselined).` This is the same count W1 saw.
- `pnpm.cmd build`
  - exit 0, with `web:build` last. Log: `<scratchpad>/t264-w2/core-build.log`.

**Downstream root**

- `pnpm.cmd --filter @fluxiq-web-extension/extension check`
  - exit 0, `core-build: … is current with its source`, `extension:check` built.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`
  - exit 0, `domain:check` built.

**Extra check, downstream tests that pin Core wording (not required by the brief)**

- `node <scratchpad>/t262-gate/run-subset.mjs <ext> t264-w2` on `card-words.test.ts`, `action-card-view.test.ts` and `shared/activity/tests/wording.test.ts`, then `node --test` on the 3 bundles
  - `# tests 34`, `# pass 32`, `# fail 2`. Both failures are expected consequences of D21 in extension files I may not touch:
    - `card-words.test.ts:108` expects "Didn't work: it didn't work the same way again"; actual "Didn't work: it couldn't run when the test tried it again".
    - `action-card-view.test.ts:76` expects the same; actual "Didn't work: it didn't do the same when the test tried it again".

**Tree state**

- `git status --porcelain -uall` (Core) shows only W1's files and my owned files.
- The downstream tree shows only W1's files, the pre-existing `t264-core-chain.md`, and this report. `.test-build-scratch/t264-w2` is ignored.
- A node scan of every changed or new Core file found no CR.
- `service.ts` is 4400 lines (`wc -l`).

## Not verified

- No live run, Lab, browser or provider call.
- I did not check how a "the start page" navigate card or the D3-screened headings render in the extension.
- Not run:
  - the whole Core vitest suite;
  - `apps/web` tests;
  - the full extension and domain test suites (only the three pinned-wording bundles above were run).
- The `told` rewrite was checked only by the unit tests (`answer-step.test.ts`, `amendment-told.test.ts`), not against a real step log.

## Open questions or contradictions found

1. **Downstream pins to update in the extension stage.**
   - `apps/extension/src/panel/chat/stream/step/tests/card-words.test.ts:108` and `apps/extension/src/panel/chat/view/tests/action-card-view.test.ts:76` pin the old D21 reason and now fail.
   - `apps/extension/src/shared/activity/wording.ts:63` (`OUTCOME_NOT_REPEATED`) still says "it didn't work the same way again". w116 left this to the extension.
   - Several extension tests feed "Build finished: a Flow is proposed" as synthetic input only. They still pass, but are now stale.
2. **D4's "one reason" rule vs F6.** F6 deliberately says every known reason, joined with "; and", and W1's tests pin that. If lane A's contradiction case (`act_already_named` with `no_such_step`) should read as one reason, that is a change to F6's `U/activity-action/refusal.ts`, which is not in this brief.
3. **D3 also silences F6's decision line for reruns.** A rerun's model reason ("Rerunning …") is now always screened as mechanics, so a rerun edit is said by its card alone. This is intended under D3, but it is a visible change: the observer test now pins `thoughts()` as `[]`.
4. **Stale comment.** The doc comment in `R/activity/wording/decision.ts:11` still says "Updating the draft Flow". That file is W1's and not owned here, and the stale text is in a comment only.
5. **`told` and `applied` change model-facing text.** As the lane noted, the main-path amendment feedback's `applied` now counts a held rerun. A decision with a rerun and refused amendments is told `applied: 1` where it was told 0, and no pinned test changed.
