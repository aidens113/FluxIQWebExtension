# t195-w28a: answerability and start location become information; a lean judge request

Worker report. Repository: Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`. Nothing committed.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

**Partial.** Both tasks are done and validated inside the files I own. One integration step falls outside them: the service still has to pass the two new inputs to the build judge (see Open questions, item 1). Until that one line in `R/service.ts` changes, a live build gets neither the notes nor the smaller request. The completion check already accepts the Flow either way.

## What changed and why

### Task 1: answerability and start location are information, not refusals

- `R/llm/harness-options/bootstrap-completion.ts`
  - `cannot_answer_instruction` and `cannot_reach_start_location` no longer add a refusal. When either check finds something, the completion is accepted and the finding is recorded in the new `notes?: AutomationStudioBuildTestNote[]` on the accepted verdict.
  - That field sits beside `check`, as `warnings` does, because the loop reads a check by its exact keys.
  - A note holds the check's issue code, Core's own sentence, and one more field: the instruction's named `columns` for answerability, or `starts` for the start location. I left out the old `quote` and `steps`: the judge already gets the instruction and every step.
  - On an accepted check, `answerability` no longer carries `issueCode`, because the contract says that field is present only when a refusal was issued. The same applies to a refusal made for other reasons.
  - `flow_bootstrap.evidence_completion_cannot_reach_start` is gone from `AutomationStudioFlowBootstrapCompletionFailureCode`, since nothing produces it now.
  - `evidence_completion_cannot_answer` stays, because the permission rule (`act_consequence_undeclared`) still files under it.
  - The `cannotAnswer` and `cannotReach` refusal-detail keys are removed.
  - Plans that cannot be built still refuse: parse, profile limits, parameter resolution and registry validation. The header comment now says this.
- `R/result-verification/contracts.ts`: adds the `AutomationStudioBuildTestNote` type and `AutomationStudioBuildTestAccount.notes?`.
- `R/result-verification/build-test/summary.ts`: takes `notes` and puts them into `buildTest.notes`, passed through `automationStudioWithoutLocators`.
- `R/service/flow-bootstrap-commands/build-judge.ts`: takes optional `notes?: () => notes | undefined` and `observedStateKeys?` and passes both to the summary.
- `R/llm/diagnosis-instructions.ts` (build-test sentence only) gains two sentences:
  - `buildTest.notes` is what Core's checks found; the judge should confirm each against the steps and, when one holds, answer no and name the step to add.
  - `as step N` inside `observed` means the same text that step's `observed` gave.
- With this, the repair hears a note through the judge's `observed`/`changed` reasons.

### Task 2: the judge's request carries what a verdict needs

**Fixture.** `R/result-verification/build-test/tests/run-36-test.json` (77,837 bytes) is built from live run 36's decision dump `build-2026-10-01T22-30-40-711Z-38848.jsonl`.

- It holds the 11-step Flow from the run's last completion: navigate, 3 optional dismissals, the Friends link, the conditional read, 4 Confirms treated as checked/`present`, and the accepted-requests read.
- Each step's draft is the run's `result.draft`.
- Each step's observation is the run's recorded tool-result `evidence`, page view included.
- The generator script was `scratchpad/w28a-gen-fixture.cjs`; it is not committed.

**Measured.** I measured `JSON.stringify` of the `AutomationStudioLlmTaskRequest` that the scripted provider captured. That is the whole request the provider gets; the system prompt and schema are added later inside the provider.

| | Before | After |
|---|---|---|
| Whole request | **28,214** | **8,113** (−71%) |
| `context.resultSummary.buildTest` | 26,666 | 6,565 |

**Biggest parts before:**
- Page views: 17,816 in total, six of them at 2,845–3,019 each (`observed.page` on steps 6–11).
- Read accounts: 1,438 and 1,808 (steps 6 and 11).
- Click read accounts: about 433 each, times 4.
- Instructions: 398.

**What was cut** (`R/result-verification/build-test/observation.ts`, new, exported through the build-test barrel):
1. **The domain's declared view keys** (`observedStateKeys`), at the top level of each observation, the same way `llm/context-window.ts` removes them. Core still names no page key; the web domain declares `elements`, `dialogs`, `blockedBy` and `page`.
2. **Core bookkeeping outside any list:**
   - `schemaVersion`;
   - an `…Id` key holding a UUID (`commandId`);
   - an `…At` key holding an epoch-milliseconds integer (`startedAt`, `finishedAt`);
   - any string equal to the step's action (`node`).
3. **Text of 40 characters or more that an earlier step's observation already sent**, outside any list. It is written as `as step N`, so nothing is lost. In this fixture that covered location and url on steps 7–11, the click `expected` sentence on steps 8–10, and `rejectedRowsNote` and the read's `expected` on step 11.
4. **In a step's `target` words** (`summary.ts`):
   - strings under Core's handle key (`handle`, e.g. `extraction.1`);
   - machine-minted keys: 24 or more word characters with at least 3 underscores and at least 3 digits, such as run 36's `div_x0531l50_x1r2vv8_…` field keys (228 characters per request).

**What is kept.** Nothing inside a list is touched, so every read's rows, `rejectedRows` and `fieldNames` stay whole. Validation, counts, conditions, status and control also stay. Screening (denied keys, locators, secret shapes) still runs after the cuts. `withheld` now means only what screening took out.

**Tests pinning the cut.** `R/result-verification/build-test/tests/request-size.test.ts` checks that:
- the request stays under **10,000**. Why 10,000: the cut request is 8,113, and one page view of this Flow is 2,845–3,019, so a single view coming back in any observation goes over;
- the same request with no view keys declared is above 20,000 (measured 23,036);
- no observation carries a view key, `schemaVersion`, `commandId`, `startedAt`, `finishedAt`, or the step's own action;
- the rows are intact: step 6 has Amara Osei and step 11 has all 4 names, with its "returned unfiltered" validation;
- the `as step 6` references are in place, and the rows inside `rejectedRows` are untouched;
- the `target` words are clean (step 6 is `["(?:[5-9]|[1-9][0-9]+) mutual"]`, step 11 is `["Request accepted"]`).

### Tests added or updated

- **`R/llm/harness-options/tests/bootstrap-completion.test.ts`**, three tests updated to the new behaviour:
  - "is accepted with no record producer for a requested table, what the check found carried as a note". This is the required new case: accepted, `notes` with `columns: ["name","price"]`, answerability without `issueCode`.
  - "is accepted, with where the Flow starts carried as a note" (`starts`).
  - The every-check test, now "refuses a plan that cannot be built for that alone": only `parameters_unresolved`, with no `cannotAnswer` or `cannotReach` feedback.
  - Also adds `notes` undefined assertions on the reaching and no-records cases.
- **`R/service/flow-bootstrap-commands/tests/build-judge.test.ts`** (new). This is the required "its note reaches buildTest" case. A real completion check accepts a single-value read against a table instruction. Its `verdict.notes` go through `automationStudioFlowBootstrapBuildJudge` to a scripted provider, and `context.resultSummary.buildTest.notes` equals the note. The same test shows that `observedStateKeys: ["page"]` removes `page` from the observation. A second case checks that no `notes` key appears when there are none.
- No test under `R/tests/service-bootstrap/tests/**` needed changing.

## Commands run and observed results

All run in `packages/fluxiq` unless noted.

1. **Baseline before any edit** (`npx vitest run src/programs/automation-studio/runtime/llm/harness-options src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/service`): `Test Files 98 passed (98)`, `Tests 776 passed | 1 skipped (777)`.
2. **The same command after the changes**: `Test Files 1 failed | 99 passed (100)`, `Tests 1 failed | 782 passed | 1 skipped (784)`.
   - The one failure: `service/summaries/tests/run-detail-preservation.test.ts > keeps a repaired run's recovery annotation…` with `Error: Test timed out in 15000ms`.
   - Run alone it timed out again (15,831 ms).
   - Run alone with `--testTimeout=90000` it passed in 12,509 ms (`3 passed`).
   - The CPU was at 100% with 11 node processes running.
   - I read this as load, not a regression: the test builds a full service and does not touch the build-test packet or the completion check. A rerun on a quiet machine would confirm it.
3. **Targeted**: `npx vitest run src/.../result-verification/build-test src/.../service/flow-bootstrap-commands/tests/build-judge.test.ts` gave `4 passed (4)`, `31 passed`. `bootstrap-completion.test.ts` gave 31 passed.
4. **Typecheck**: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w28a tsc" npx tsc --noEmit -p .` printed only `[heavy] t195-w28a tsc holds b2` and exited 0. I re-ran it after the last source edit.
5. **Structure audit** (`node scripts/structure-audit.mjs`, Core root):
   - First run: `FAIL [imports] … bootstrap-completion.ts … "../../result-verification/contracts.ts"`. Fixed by importing from the `result-verification/index.ts` barrel.
   - Second run: `structure-audit: passed (215 warning(s), 349 baselined)`, exit 0.
   - It also printed "1 baseline entries can be lowered". `--json` shows that entry is `apps/web/src/features/programs/live-views/shared.tsx::values` (24 recorded, 23 now), which is not mine, so I did not run `pnpm structure:baseline`.
6. **Measurement**: a throwaway scripted-provider test (since deleted) printed the per-key sizes quoted above. Its before and after requests are saved as `scratchpad/w28a-request-before.json` and `w28a-request-after.json`.

## Not verified

- **Live behaviour.** There were no Lab runs, browser or model calls, as the brief requires. I have not seen what a real judge answers given `notes` or `as step N`.
- **Checked-step observations.** In the fixture, a checked Confirm's observation is the exploration click's tool result. A real test's verify answer may be shaped differently, though the same cuts apply.
- **The service wiring** (Open questions, item 1). It is not in place and not tested end to end through `R/service.ts`.
- **No full suite was run**, per the brief.

## Open questions or contradictions found

1. **`R/service.ts` needs one change** that I do not own. At about line 1564, the `automationStudioFlowBootstrapBuildJudge({...})` call should also pass:
   ```ts
   notes: () => accepted.verdict?.notes, observedStateKeys: harnessOptions.observedStateKeys
   ```
   - `accepted.verdict` is already the accepted completion verdict.
   - `harnessOptions.observedStateKeys` is already passed to the loop two lines below.
   - Without this change, live builds get no notes and still send page views to the judge.
   - Both inputs are optional, so the current code compiles and behaves as it did before.
2. **Leftovers I do not own**:
   - `R/flow-bootstrap/generation-failure/codes.ts` and `evidence-failure.ts` still list `evidence_completion_cannot_reach_start`.
   - `R/activity/wording/completion-refusal.ts` still words `cannot_answer` and `cannot_reach_start`.
   - `R/flow-bootstrap/answerability/check.ts` and `reachability/check.ts` still write refusal instructions such as "Nothing was created…".
   - Those are now dead or misleading only for these two checks. The permission refusal still uses the `cannot_answer` code.
3. **Docs**: `docs/architecture/automation-studio/llm-flow-bootstrap.md` (Core) describes these codes and probably the old refusal. It needs an update by whoever owns the docs.
4. **A design choice to confirm**: on a completion refused for some other reason, I do not add the notes to the model's refusal feedback. The model sees them only through the judge, after a later accepted completion.
