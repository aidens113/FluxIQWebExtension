# t264-s2-w3: completion check, check card, run ending (lane C w76/w80/w81/w84)

## Outcome

**Partial.** w76 (Core part), w81 and most of w80 are ported onto `task/t264-core-integration-chain`. They sit on top of W1's F6 and W2's A5, and no deleted module was restored. Every named check exits 0.

Three things are not finished, each because it needs a file this brief does not own:

1. **w84 wiring.** The answer folder for refused decisions is written, but its `feedback` and `steps` stay empty. That needs two lines in `R/llm/evidence-loop.ts`, which I do not own. As a result, 2 of the 3 tests in `answer-feedback.test.ts` fail.
2. **w80 R3c in traced runs.** In a run with `FLUXIQ_BUILD_PROGRESS_TRACE=1`, the observer's `testRefused` hook is never reached. The fix is in `progress-trace.ts`, which I do not own. Also unported is the `steps` count from `dry-run-gate.ts`.
3. **w80 U7 refusal wording.** I held the "tried, not ran" words for `refusal-words.ts`. Porting them breaks 5 assertions in two test files I do not own.

The exact patches for all three are under Open questions.

R = `packages/fluxiq/src/programs/automation-studio/runtime/`, U = `packages/fluxiq/src/ui/`, X = `apps/extension/src/`.

## What changed and why: hunk by hunk

### Taken whole from the lane, with CR stripped

Each of these files was identical to the lane base on t264 (checked with `git diff --ignore-cr-at-eol 6beae684`), and every lane hunk in it belonged to these units.

- **`R/llm/evidence-loop/completion-attempt.ts`** (w80 R3c): `dryRun` may carry `steps`, and the new `testRefused()` tells a listening check about a test refusal. **Ported.**
- **`R/llm/evidence-loop/trace.ts`** (w84): `CORE_ANSWER_TOOL_IDS`, the `evidence` thunk parameter, `decisionStarts()`, and the answer handles completed with `shown`. **Ported, with one merge:** the step-log call is now `automationStudioLlmStepLogAnswer(row, env, undefined, coreAnswers)`, because A5's `told` keeps the third parameter (see `answer-step.ts`).
- **`R/activity/wording/completion-refusal.ts`** (w80 R3c): `TEST_BECAUSE`, `steps` counting, and "N steps need fixing". **Ported.**
- **`R/activity/run.ts`** (w76 U3): `readRecord`, `failedRunEnding`, and "Run failed: <sentence>" in both the label and `detail.text`. **Ported.**
- **`R/activity/wording/run-ending.ts`** and **`tests/run-ending.test.ts`** (new, w76). **Ported.** The `resultReauthor.attempts[].ending` shape it reads exists on t264 (`service/runtime-adaptation/reauthor-build.ts:178`).
- **`R/result-verification/check-words.ts`** (new, w81). **Ported.** It is imported directly by `check-activity.ts`, as the lane did. The barrel `result-verification/index.ts` is not mine, so the helper is not exported from it.
- **`R/llm/step-log/index.ts`** (w84): a comment on the folder contract. **Ported.**
- **`R/llm/evidence-loop/tests/completion-attempt.test.ts`** (w80). **Ported.**
- **`R/llm/step-log/tests/answer-feedback.test.ts`** (new, w84). **Ported**, with one change: the direct call passes `undefined` as the third argument, which is the merged signature.

### Merged by hand

**`R/llm/step-log/answer-step.ts`** (w84 onto A5's `told`). The signature is now `(row, env, told?, feedback = () => [])` and returns `AutomationStudioLlmStepLogAnswerStep | undefined`. A5's caller (`decision-handlers/amendment.ts`, `told` as the third argument) is unchanged.

- Ported from C:
  - the `unusable` folder, provider-unanswered rows excluded;
  - answered-from-memory `tool_call` rows;
  - the `steps` and `feedback` fields, and the `refused <code>: steps …` summary;
  - the `shown()` handle;
  - `AutomationStudioLlmStepLogCoreEntry` and `AutomationStudioLlmStepLogAnswerStep`.
- Kept from A5: `told`, the `amendmentCheck` row field, and `applied` taken from `draftChange.appliedCount`.
- How the two fit together: the `written` WeakMap now holds a `tell(told)` closure over the same folder. Both a later `told` and a later `shown` therefore rebuild `result.json` from one builder, so neither one drops the other's field. `told` rewrites only `result.json`, as before. `shown` rewrites `result.json` and then `meta.json`.

**`R/activity/observer.ts`** (w80 R3c onto F6/A5):

- `sentBack()` is added.
- `checkCompletion` is wrapped with `Object.assign(…, { testRefused })`: it emits "The proposed Flow was sent back to be fixed" with the refusal's words, then passes the refusal on to the inner check.
- The doc comment is extended.

**Ported.**

**`R/activity/decision-answer/draft-edit.ts`** (w80 U8; the lane's edit was to the old `activity/draft-edit.ts`):

- `DECISION_CHECK` is added, plus a local `Answered = Answer | { kind: "unusable" }`.
- `answeredIn` returns `unusable` for a `core.decision_check.<iteration>` entry.
- `answeredInTrace` returns it for an `unusable` row that was not refused as a repeat.
- `say` emits only "Deciding the next step — didn't work" (a failed thought, the same row `decisionFailed` emits). There is no reason and no "Edit the Flow" card.

**Ported**, adapted to F6's card.

**`R/activity/wording/reason-text.ts`** (w80 U4 onto A5's D3/D15):

- Ported: C's `HANDLE`, `NODE_ID`, `SNAKE`, `STEP_REF`, `EMPTY_PARENS` and `screened()`, copied verbatim from the lane.
- Merged: the order of operations. A5's mechanics screen and `onlyCodes` test run on the model's words as written, and `screened()` runs after them. Otherwise "tool_call core.run_node" would become "tool call run node" and stop counting as codes-only (A5's D15).
- One difference from the lane: token runs are hidden before `screened()` rather than after. Lane C's U4 test passes, and so does A5's `reason-screen.test.ts`.

**Merged.**

**`R/activity/wording/index.ts`**: one line, `export { automationStudioActivityRunEnding } from "./run-ending.ts";`. **Ported.** C's `draft-edit-refused` export line was already removed by F6.

**`R/result-verification/check-activity.ts`** (w81 onto F6's D10):

- The text is now `bounded(automationStudioResultCheckWords({ ...outcome, reason: saidHere(outcome) }))`, so the build sentence (D10) is kept as the verdict sentence.
- The header and doc comments follow the lane.

**Merged.**

**`U/activity-action/failure-reason.ts`** (w80 U7): the handle-refusal words now read "FluxIQ didn't send it, since it named no control from the page", with the lane's comment, beside A5's older-view entry and `REPLAY_REASONS`. **Ported.**

**`R/service.ts`** (w76): line 2749 now passes `{ readRecord: async (ended) => (input.projectId ? (await this.getFlowRunDetail(input.projectId, ended.runId))?.metadata : undefined) … }`. It is edited in place and is still 4400 lines. **Ported.**

### Not ported

- **`R/llm/evidence-loop/decision-refusal.ts`**: the only lane hunk is a comment about the "amend_draft left with nothing because its rerun carried no input" refusal, which belongs to **w78** (a later stage). **Not ported.**
- **`draft-edit-refused.ts` U7, title** ("Didn't run the step again" to "Didn't run the step") and its prose fallback ("It was not run"): **superseded by F6.** The card's title says what was asked ("Running the step again — not done"), and the card carries no prose.
- **`draft-edit-refused.ts` U7, words** (`changes_nothing` and the four `REPEATED` outcomes, "tried" rather than "ran"): their F6 home is `U/activity-action/refusal-words.ts`. **Held, not applied.** These words are pinned by tests I do not own: `R/activity/tests/refused-call.test.ts:51,90` and `U/activity-action/tests/refusal.test.ts:50,57,95`. See Open questions, item 3.

### Tests (Core)

- **`activity/tests/scope.test.ts`**: C's two U3 tests, inserted before "runs unobserved without a project".
- **`activity/tests/observer.test.ts`**:
  - C's R3c `describe` (two tests), with its `automationStudioLlmEvidenceCompletionAttempt` import.
  - C's U8 test rewritten for F6. It asserts there is no "Changing the Flow", no model reason and no card, and that there are two "Deciding the next step — didn't work" rows.
  - C's U7 regex change at line 281 was not ported; it is held with the words.
- **`activity/wording/tests/reasons.test.ts`**:
  - C's U4 test and C's R3c completion-refusal test.
  - C's U7 `DraftEditRefused` tests (the `describe` and the `title` change) are **superseded**, because the module was deleted by F6.
- **`result-verification/tests/check-activity.test.ts`**:
  - All of C's w81 hunks: "3 rows came back." on the pass, the advice no longer shown, the musp39u8 refusal test, and the no-rows and one-row test.
  - F6's D10 test now expects `^3 rows came back\. This result was checked twice…`, because w81 puts the row count first.
- **`U/activity-action/tests/{failure-reason,action-of}.test.ts`**: C's U7 lines and comment.

### Downstream (X)

- **`panel/chat/stream/step/card-words.ts`**: t194's `lowerFirst` hunk, so a first word with an inner capital ("FluxIQ") is not lowered. **Ported.**
- **`panel/chat/view/tests/action-card-view.test.ts`**:
  - line 211: t194's refusal line ("…Didn't work: FluxIQ didn't send it, since it named no control from the page");
  - line 76: t174's replay-reason line ("it didn't do the same when the test tried it again", with its comment).
- **`panel/chat/stream/step/tests/card-words.test.ts`**: line 108 is now t174's line ("Didn't work: it couldn't run when the test tried it again", with its comment).
  - With the line 76 change above, this fixes the two A5 failures W2 reported.
  - t194 had no hunk in this file.
- `messages.test.ts` was not touched, as the brief said.

### Docs

The t194 Core tree has no change under `docs/`, so there is no architecture-doc hunk for these units.

## Commands run and observed results

**Core vitest, from `packages/fluxiq`**

- `npx vitest run` on `activity`, `src/ui/activity-action`, `llm/step-log`, `llm/evidence-loop`, `llm/decision-handlers`, `result-verification`, `tests/service-bootstrap/tests` and `tests/service-flows`.
- **First run:** exit 1, `Test Files 9 failed | 123 passed (132)`.
  - Cause 1: `automationStudioActivityRunEnding is not a function`. I had missed the `wording/index.ts` export, and that one omission also broke the `service-flows` failed-run tests.
  - Cause 2: F6's D10 check-activity test, which needed the row-count prefix.
  - I fixed both.
- **Final run:** exit 1, `Test Files 5 failed | 127 passed (132)`, `Tests 12 failed | 1157 passed (1169)`. Log: `<scratchpad>/t264-w3-vitest2.log`.
  - 10 failures are pre-existing: `accounting.test.ts` (6), `generation.test.ts` (1), `judged-build.test.ts` (2), `evidence-loop/tests/repeat-guard.test.ts` (1).
  - Their error lines match the sweep `sweep-2026-10-05/core-test.clean` exactly (same 8 distinct messages, compared with grep, sort and uniq).
  - The other 2 failures are mine: `llm/step-log/tests/answer-feedback.test.ts`, "is written for a shape-invalid decision…" (`TypeError: Cannot read properties of undefined (reading 'map')`, because `feedback` is absent) and "is written for a completion refused full_run_required…" (`steps: [2, 3]` is missing). The folder itself is written. Both need the `evidence-loop.ts` wiring (Open questions, item 1).
  - `representation.test.ts` "rejects graph saves…" fails in the sweep but passes here.

**Core root**

- `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0, with `"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq…","source":"command"`.
- `node scripts/build-cache/cli.mjs structure-audit:check`: exit 0, with `structure-audit: passed (245 warning(s), 349 baselined).` These are the same counts as W1 and W2.
- `pnpm.cmd build`: exit 0, with `web:build` last. Log: `<scratchpad>/t264-w3-core-build.log`.

**Downstream root**

- `node <scratchpad>/t262-gate/run-subset.mjs <abs apps/extension> t264-w3 <13 test files>`: exit 0, 13 bundles. The 13 files are every `*.test.ts` under `src/panel/chat/stream/step/tests`, `src/panel/chat/view/tests`, `src/shared/activity/tests` and `src/background/activity/tests`.
- `node --test` on the 13 bundles: exit 0, `# tests 135`, `# pass 135`, `# fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0 (`core-build: … is current with its source`, `extension:check` built).
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0.
- `node scripts/structure-audit.mjs`: exit 0, with `structure-audit: passed (165 warning(s), 118 baselined).`

**Tree state**

- `service.ts` is 4400 lines (`wc -l`).
- A node scan of every modified or untracked file in both trees found no CR: 62 Core files and 8 downstream files.
- `git status --porcelain -uall` shows:
  - **Core:** only W1's and W2's files plus mine. Mine are:
    - `activity/{observer,run}.ts`, `activity/tests/{observer,scope}.test.ts`;
    - `activity/wording/{completion-refusal,index,reason-text,run-ending}.ts`, `activity/wording/tests/{reasons,run-ending}.test.ts`;
    - `activity/decision-answer/draft-edit.ts`;
    - `llm/evidence-loop/{completion-attempt,trace}.ts`, `llm/evidence-loop/tests/completion-attempt.test.ts`;
    - `llm/step-log/{answer-step,index}.ts`, `llm/step-log/tests/answer-feedback.test.ts`;
    - `result-verification/{check-activity,check-words}.ts`, `result-verification/tests/check-activity.test.ts`;
    - `service.ts`;
    - `U/failure-reason.ts`, `U/tests/{failure-reason,action-of}.test.ts`.
  - **Downstream:** W1's files, the pre-existing `t264-core-chain.md`, the W1 and W2 reports, and my `card-words.ts`, `card-words.test.ts` and `action-card-view.test.ts`.

## Not verified

- No live run, Lab, browser or provider call. In particular, I have not seen the "Run failed: …" sentence, the "sent back" row after a test refusal, or the check card's row count rendered.
- The `service.ts` `readRecord` wiring has no test of its own. This is unchanged from the lane.
- The `evidence-loop.ts` two-line patch below is the lane's, and I did not apply it. I have not shown that it makes `answer-feedback.test.ts` pass on t264.
- I did not run the full Core suite, `apps/web` tests, or the full extension and domain suites.

## Open questions or contradictions found

### 1. w84 needs `R/llm/evidence-loop.ts`, which the brief does not list

These are the lane's two lines, at t264 lines 183 and about 607. They do not change the line count, and the file is 798 lines on t264.

- Line 183: `const rows = automationStudioLlmEvidenceLoopTraceRecorder(trace);` becomes:

  ```ts
  const rows = automationStudioLlmEvidenceLoopTraceRecorder(trace, process.env, () => evidence); // `evidence` is declared below; read only once rows are recorded.
  ```

- Iteration start: `rows.draftShown = undefined;` becomes:

  ```ts
  rows.decisionStarts(); // Clears what the last decision was shown, and completes Core's answers to it in the step log.
  ```

Until these are applied:

- answer folders for `unusable` and answered-from-memory rows are written without `feedback` or `steps`;
- `heldBefore` stays empty;
- `decisionStarts()` is never called, which is harmless because the loop still clears `draftShown` itself;
- 2 tests in `answer-feedback.test.ts` fail.

### 2. w80 R3c is incomplete outside my files

- **`R/llm/evidence-progress/progress-trace.ts`** (W2 edited it last). Its `checkCompletion` wrapper must also carry the lane's `testRefused`: log `completion refused by=test issues=<codes> steps=<n,n>`, then pass the refusal to the inner check.
  - This matters because, with `FLUXIQ_BUILD_PROGRESS_TRACE=1`, the trace wraps the observer's input. Without the hook, the observer's `testRefused` is never reached, so the chat's "sent back" row never appears in traced (Lab) builds.
  - The lane hunk is the `Object.assign(async (...args) => {…}, { testRefused })` block in t194's `progress-trace.ts`.
  - The same lane diff also adds `automationStudioReauthorTryTrace`, which is a different unit and must not come with it.
- **`R/llm/node-tools/dry-run-gate.ts`** must give its refusals a non-enumerable `steps`: the lane's `refusal()` and `refusedSteps()` helpers and its three `return refusal(...)` sites.
  - Without it, the chat says "One thing needs fixing." rather than "N steps need fixing."
  - That lane diff is interleaved with w72 (carried-step) hunks, which are superseded. Take only the `steps` hunks.
- Their tests are `node-tools/tests/dry-run-gate.test.ts` and `evidence-progress/tests/progress-trace.test.ts`.

### 3. U7 "tried, not ran" words, held

To port them, set these values in `U/activity-action/refusal-words.ts`:

- `amendment.changes_nothing`: "that step was already tried exactly this way on this same page, and trying it again would end the same way"
- `repeated.failed`: "it was already tried exactly this way and did not work"
- `repeated.changed_nothing`: "it was already tried exactly this way and changed nothing"
- `repeated.same_result` and `repeated.same_answer`: "it was already tried exactly this way, and trying it again would end the same way"

Then update the pins that still say "already ran exactly this way":

- `R/activity/tests/refused-call.test.ts:51,90` (W1, not mine);
- `U/activity-action/tests/refusal.test.ts:50,57,95` (W1, not mine);
- `R/activity/tests/observer.test.ts:281` (mine; change the regex to `/already tried exactly this way/`);
- downstream `X/panel/chat/stream/step/tests/card-words.test.ts:128,130` (mine).

I held the change rather than leave 5 assertions failing in files I may not edit.

### 4. Smaller notes

- **The reason screen now applies to more text.** U4 screens the check card's verdict and observations too, and the not-performed reason, because `check-activity.ts` bounds them through `automationStudioActivityReasonText`. This matches the lane.
- **Barrel export.** `result-verification/index.ts` does not export `check-words.ts`, which lane w81 also noted. Add `export * from "./check-words.ts";` if another module needs it.
- **Generated reference.** `framework-reference.md` (generated) does not list `automationStudioActivityRunEnding` or the new step-log types. This is out of scope.
