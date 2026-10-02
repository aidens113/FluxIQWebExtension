# t195-w26d: the judge of a build's test, its packet and screening (W4)

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing committed.

## Outcome

Done. I implemented section 4.5 of `t195-w25-completion-judge-design.md`. The new tests and the brief's three checks
pass, except for 2 failures in W2's `bootstrap-completion.test.ts`. That file is not mine; it is matched by the
`llm/harness` path prefix.

## What changed and why

- **`R/result-verification/contracts.ts`**
  - Adds `buildTest?: AutomationStudioBuildTestAccount` to `AutomationStudioRunResultSummary`.
  - Adds the `AutomationStudioBuildTestStep` and `AutomationStudioBuildTestAccount` types, exactly as section 4.5
    gives them.
  - Imports `JsonValue`.
- **`R/result-verification/build-test/summary.ts`** (new)
  - `automationStudioBuildTestResultSummary({ steps, report?, nodes, instructionText?, result?, startLocation?, deniedEvidenceKeys? })`
    returns an `AutomationStudioRunResultSummary`:
    - `recordSets: []` and `recordSetCount: 0`, so `core-observation` returns undefined;
    - `flowShape` taken from `summarizeAutomationStudioRunResult`;
    - `buildTest`.
  - It also exports `automationStudioBuildTestUntestedCarried(account)`, which returns the positions of carried steps
    whose outcome is `not_run`. The judge derives `untestedCarried` with it, so the lead's snippet in section 4.6
    works unchanged: it passes the builder's return as `summary`.
  - `report` is declared locally as `AutomationStudioBuildTestReportInput`. It is structurally W1's
    `AutomationStudioFlowDraftTestReport`, and only the fields this builder reads are named.
  - `target`:
    - strings from `ranWith`, then from `input`, without duplicates and with no count cap;
    - drops keys the domain denies, Core's executable-target keys (`automationStudioExecutableTargetKey`), the
      `consequences` and `node` keys, the step's own `actionId`, locator-shaped strings and credential-shaped strings.
    - Dropping the target keys is needed. The web domain's `ranWith.parameters.target` holds
      `body > div > header > div > form > button`, which the locator screen does not catch, and `input.parameters.target`
      holds the handle `e<n>`.
  - `outcome`:
    - comes from the report's outcome for the step (matched by `stepId`, else by position), then `step.replayed`,
      read through `automationStudioFlowDraftReplayOutcomeWord`;
    - is `not_run` for every step when there is no report. A stale `step.replayed` is not taken as this round's test.
  - Step fields:
    - `withheld` is set when `mode === "verify"`;
    - `withheldBy` comes from the outcome;
    - `runs` is the routing, with positions in place of ids;
    - `carried` is set for an `f<n>` id;
    - `explored` (`changed`, `resultCode`, `stateChanged`) is set on withheld steps;
    - `claims` are `step.acts` plus the `result.acts` claims that name the step by id or by position.
  - `observed`:
    - is kept only for steps with `effect !== "mutate"` and for verify-mode steps; when a step has several
      observations, they become a list;
    - denied keys and locator-shaped keys are removed, and `automationStudioWithoutLocators` is applied;
    - a credential-shaped observation is dropped whole;
    - any change sets the summary's `withheld`.
  - With no declared keys, no `target` and no `observed` are carried, and `withheld` is true.
  - `checklist` is `automationStudioInstructedActsChecklistValue(...)`.
  - `missingActs` is `checkAutomationStudioInstructedActs(...).missingActs` when the check is not ok.
  - Both are passed through `automationStudioWithoutLocators`, and both are imported from
    `flow-bootstrap/instructed-acts/index.ts`.
- **`R/result-verification/build-test/judge.ts`** (new)
  - Signature: `automationStudioBuildTestJudge({ verify?, provider?, instructions, deniedEvidenceKeys?, projectId, flowId, signal?, now?, deadlineMs? })`
    returns `(input: { summary, budget?: { maxCostUsd? } }) => Promise<AutomationStudioBuildTestVerdict>`.
  - Its call:
    - runs inside `automationStudioResultVerificationWithinDeadline`;
    - uses `runId: build-test.<randomUUID>` and `maxEstimatedCostUsd = budget.maxCostUsd`.
  - Mapping:
    - `answers` -> `yes`.
    - `does_not_answer` that `automationStudioResultVerificationFailsRun` -> `no`, with `repair.judgement.{expected,observed,advice}`
      and `findings` taken from the `repair.findings` codes.
    - Any other performed outcome (unsure, `model_disagreed`, `model_unconfirmed`) -> `unknown`, with `why` set to the
      outcome's reason.
    - `performed: false`, the deadline, or a throw -> `not_judged`.
    - A `maxCostUsd` of 0 or less makes no call and returns `not_judged`.
  - `untestedCarried` is attached to `unknown` and `not_judged` when it is not empty.
  - `spent` is the sum of `interventions[*].tokenUsage`.
  - `AutomationStudioBuildTestVerdict` and `AutomationStudioBuildTestJudgeSpend` are declared locally. They are
    structurally identical to section 4.1's `AutomationStudioFlowBootstrapTestVerdict`, with a `TODO(t195 lead)` to
    unify them.
- **`R/result-verification/build-test/index.ts`** (new barrel), and one export line in **`R/result-verification/index.ts`**.
- **`R/llm/diagnosis-instructions.ts`**
  - "every run you are shown finished without a failed step" now reads "every finished run you are shown ... (a
    build's test, below, is not a finished run)".
  - A new private constant, `AUTOMATION_STUDIO_BUILD_TEST_VERIFICATION_INSTRUCTION`, is appended to the
    `loop_verification` prompt. It holds the build-test sentences:
    - judge from `buildTest.steps`, not from record sets;
    - what `target`, `outcome` and `observed` are;
    - a withheld step was only checked: `verified` means it could act now, `present` means its effect is in place,
      and it is judged from `explored` and its target;
    - claims, checklist and `missingActs` are information, not proof;
    - a carried `not_run` step is no evidence;
    - what `runs` means;
    - answer no by naming the clause and the step number to change or add.
- **`R/llm/harness/request-evidence-check.ts`**: `sendableResultSummary` also refuses a `buildTest` in two cases:
  - any step's `observed` carries a denied key (`screenAutomationStudioLlmEvidence`);
  - any string or key anywhere in `buildTest` is locator-shaped (`locatorShapedAnywhere`).
- **Tests**
  - `build-test/tests/summary.test.ts` and `build-test/tests/judge.test.ts` cover every item in the section 4.5 list:
    - the run 36 packet;
    - the run 40 packet;
    - the run 41 shape;
    - the lane B shape;
    - the mapping: answers, two unsure, a no then yes, no model, the deadline, no cost, the budget and run id passed
      on, carried steps, and cancellation;
    - the screening.
  - The fixtures are in `build-test/tests/draft-steps.ts` and `live-run-drafts.ts`. They are split in two because one
    file had 19 exported values, over the audit's limit of 15.
  - `R/llm/harness/tests/request-evidence-check.test.ts` (new) tests the pre-flight against literal packets.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/llm/tests`
  (in `packages/fluxiq`):
  - Result: **62 files passed and 1 failed; 704 tests passed and 2 failed**.
  - Both failures are in `llm/harness-options/tests/bootstrap-completion.test.ts`, which W2 owns. The
    `llm/harness` filter also matches `harness-options`.
    - "is refused act_consequence_undeclared when the withdraw press declares only modify_existing": received the
      extra code `flow_bootstrap.evidence_completion_parameters_unresolved`.
    - "is accepted once the press declares delete, optional or not": expected `ok` to be true, got false.
  - Neither failure involves a file I own.
- `npx vitest run .../result-verification/build-test .../llm/harness/tests/request-evidence-check.test.ts`, after the
  fixture split: **3 files and 29 tests passed**.
- Revert check:
  - With the new `buildTest` line in `request-evidence-check.ts` disabled, 4 tests failed:
    - 3 in `request-evidence-check.test.ts` (denied key in observed; locator in target; locator in observed or
      findings);
    - 1 in `summary.test.ts` ("is refused by the pre-flight when a denied key or a selector reaches it anyway").
  - The file was then restored from a copy, and the line was confirmed present.
  - The summary and judge modules are new, so their tests cannot pass without them.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w26d tsc" npx tsc --noEmit -p tsconfig.json`: printed
  nothing but the slot line, **exit 0**. It was run twice, the second time after the split.
- `node scripts/structure-audit.mjs` (Core root):
  - The first run failed with `[exported-values] build-test/tests/build-test-drafts.ts: 19 exported values`. I fixed
    this by splitting the file.
  - Final run: `structure-audit: passed (213 warning(s), 349 baselined)`.
  - The audit accepts the new `build-test/` directory.
  - The note "1 baseline entries can be lowered" was already there before my change.
  - New warning: `result-verification/contracts.ts` is 436 lines, past the 400-line advisory threshold.

## Not verified

- The real web domain's per-step `evidence` shape. W1 captures it, and my tests use hand-made `{ rows: [...] }` and
  `{ answer: "present" }`.
- The token size and cost of a real packet.
- Whether DeepSeek serialises `resultSummary.buildTest` whole.
- No test asserts the wording of the new instruction sentences. The design's test list has none, and I own no test
  file under `llm/` other than the harness one.
- Integration with W3's phases and the lead's `service.ts` closure. The judge was only called directly.
- Whether `amend_draft rerun` on an `f<n>` step yields `replay` (design, open item).

## Open questions or contradictions found

1. **The carried-step predicate is local** (`carriedStep` in `build-test/summary.ts`, with a `TODO(t195 lead)`). It
   should be replaced with the one-line export the lead adds in `llm/node-tools/draft-from-flow.ts`.
2. **The verdict type is local** (`AutomationStudioBuildTestVerdict` in `build-test/judge.ts`). The lead should unify
   it with W3's `AutomationStudioFlowBootstrapTestVerdict`.
3. **`untestedCarried` is derived from the summary, not returned beside it.** The design says summary.ts "returns
   untestedCarried", but the lead's section 4.6 snippet passes the builder's return as `summary`. Instead, the builder
   returns the summary, and `automationStudioBuildTestUntestedCarried(summary.buildTest)` gives the list. The judge
   uses it.
4. **The finding `result.no_record_set` is dropped from `findings` in a `no`.** Every build test keeps no record set,
   so `automationStudioResultRepairFindings` would always report "The run kept no record set at all", which would
   mislead the repair. As a result, the run 36 and run 40 `no` verdicts carry `findings: []`.
5. **Cancellation is thrown, not returned.** When `signal` is aborted, the judge throws `signal.reason` (an
   `AbortError`), because W3's design says "the judge throws a cancellation: ended cancelled". The 4.1 verdict type
   has no cancelled member.
6. **The cost cap applies per call, not to the pair.** `maxEstimatedCostUsd = budget.maxCostUsd` is used as the
   design says, but `verify` may make two calls, each capped at that amount. The judge could therefore spend up to
   twice what the build has left.
7. **A timed-out call's spend is lost.** On a deadline, the abandoned call's spend is unknown, and `spent` is
   returned as zero.
8. **The outcome falls back to `step.replayed`** when a report is present but has no outcome for the step, as the
   design says. With no report at all, every outcome is `not_run`.
9. **Two Core-level keys are dropped from target words:** `consequences` (a declaration Core reads in
   `verify-only.ts`) and `node` (the run-node envelope).
