# t195-w25: how a completion reaches test, judge and repair, and the design to change it

Worker t195-w25, 2026-10-01. Read-only on Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch
`task/t195-live-control-flow`, with w24b's and w24c's uncommitted round-4 edits in the tree. `R` =
`packages/fluxiq/src/programs/automation-studio/runtime/`. No Lab, browser or model call was made.

## Outcome

Done. Part 1 maps today's path with file:line. Part 2 covers the judge. Part 3 walks the three cases through the new
design. Part 4 splits the design into four worker briefs with no shared file, plus two service.ts hunks that the
lead integrates.

## 1. Today's path

### 1.1 From `complete` to a proposal

1. The loop gets a `complete` decision: `R/llm/evidence-loop.ts:564-567` calls
   `automationStudioLlmEvidenceHandleCompletion`.
2. `R/llm/decision-handlers/completion.ts:26-77`:
   - `:34`: under `minToolCalls`, the loop ends `invalid_decision`.
   - `:40-41`: earlier completion feedback, dry-run entries and dry-run pages are superseded.
   - `:44`: calls `automationStudioLlmEvidenceCompletionAttempt`.
3. `R/llm/evidence-loop/completion-attempt.ts:48-78`:
   - the caller's `checkCompletion` runs first (`:57-64`);
   - the dry run runs only when that check returned ok (`:73-77`);
   - a check refusal never replays anything.
4. The `checkCompletion` that Flow Bootstrap passes is at `R/service.ts:1569-1574`. It calls
   `checkAutomationStudioFlowBootstrapCompletion` and stores `accepted.verdict`, which holds the `buildPlan` that is
   later persisted.
5. `R/llm/harness-options/bootstrap-completion.ts:149-308` runs every check every time, in this order:
   1. empty wrapper (`:190-192`);
   2. the start step is restored into the draft (`:203-211`);
   3. the plan is assembled from the draft (`fromDraft` `:347-373`), or read from the reply (`fromReply`), at
      `:212-216`; a failure here is `evidence_completion_plan_invalid` (`:230-231`);
   4. the plan is parsed (`:233-235`);
   5. profile limits (`:240-247`);
   6. the domain resolves node parameters (`:248-258`);
   7. registry validation (`:261-271`), which yields `buildPlan`;
   8. answerability (`:279-284`, `flow-bootstrap/answerability/`), as `evidence_completion_cannot_answer`;
   9. start location / reachability (`:285-288`), as `evidence_completion_cannot_reach_start`;
   10. **instructed acts** (`:294-301`):
       - calls `checkAutomationStudioInstructedActs` (`R/flow-bootstrap/instructed-acts/check.ts:150-249`);
       - the result is filed under `evidence_completion_cannot_answer` with issue `bootstrap.instructed_act_missing`;
       - it carries `missingActs` and, for repeat faults, `repeatWith` from `repeat-suggestion.ts` (`:299`);
       - it covers every reason: `no_step_named`, `step_changed_nothing`, `step_only_arrives`, `step_is_optional`,
         `act_needs_repeat`, `span_stops_short`, `act_consequence_undeclared`, `choice_is_the_act_step`,
         `step_claimed_twice`, `step_acts_on_another_object`, `quantity_is_a_repeat` and `quantity_presses_differ`
         (`contracts.ts:150-189`). The per-step rule is `step-fault.ts:28-47`, and the loop over every named step is
         `standing.ts:60-127`.
   11. The verdict is assembled at `:303-307`, and a refusal's feedback at `:402-440`.
6. The dry run comes after the check accepts:
   - the gate is built at `R/llm/evidence-loop.ts:385-395`;
   - its body is `R/llm/node-tools/dry-run-gate.ts:102-176`, and the replay is
     `R/llm/node-tools/replay-draft.ts:98-170`;
   - it applies only when `automationStudioFlowDraftReplayable` (`R/flow-draft/dry-run.ts:186-191`): every proposed
     step carries `ranWith` and `replay`, and the first step has `replay.from`;
   - a clean replay of an unchanged signature is reused (`dry-run-gate.ts:105-108`);
   - an unchanged draft replayed twice is judged from its stored outcomes, not replayed again (`:109-127`);
   - a step proved only sometimes present is made optional (`:158-161`);
   - each outcome is written onto its step as `step.replayed` (`:145-148`).
7. Acceptance: `completion.ts:61-63` returns `{ ok: true, result, steps }`, and `round-ending.ts:480` marks the round
   finished.
   - `phases.ts:203` returns `finished`, with no judgement of any kind.
   - `service.ts:1623-1640` follows: permission outcome, `accepted.verdict`, `buildPlan`.
   - The proposal is `createFlowBootstrapAdaptation` at `service.ts:1673`.
8. On refusal: `completion.ts:65-76` pushes the feedback as `core.completion_check` and counts it in
   `context.unusable`.
   - The no-progress guard counts a refusal of the same draft again
     (`evidence-loop.ts:311-319`, `evidence-progress/no-progress.ts`).
   - At `maxConsecutive` unusable decisions, `unusableDecisions.stalled` (`service.ts:1567`) throws
     `AutomationStudioFlowBootstrapUnfinishedStall`.
   - The repeat guard can end the round `repeat_without_progress` instead.
   - Either way, `round-ending.ts:476-484` reads the round as `unfinished`.

### 1.2 Where phase 2 and phase 3 run today, and what "judgement" means

- They run **only for a round that stopped short**, at `phases.ts:208-272`. A finished round is returned untouched at
  `:203`.
- Phase 2 is `judgement.ts:383-424`, `automationStudioFlowBootstrapJudgeUnfinished`:
  - it builds a repair seed (`:367-376`), which deletes `replayed` and `callId`;
  - it runs the caller's `test`, which `service.ts:1614` builds as a fresh `automationStudioFlowDraftDryRunGate` with
    no-op evidence callbacks;
  - it records `tested`, `testIssueCodes` and `failedSteps`;
  - **the judgement is the checklist's**: `done` and `todo` come from `automationStudioInstructedActsChecklist` and
    `automationStudioInstructedActsNotDone` (`:406-408`). No model judges anything.
- Phase 3 (`phases.ts:259-271`) is a new live round seeded with the Flow:
  - it receives the judgement through `resume` (`automationStudioFlowBootstrapJudgementValue`, `judgement.ts:427-438`);
  - the repair instruction is `R/llm/evidence-loop/resume.ts:66-71`, which says "complete only when every act and
    choice on the checklist is done".
- Endings:
  - "not doable" when a repair is not `JudgementAdvanced` over the one before (`judgement.ts:445-449`, `phases.ts:260`);
  - `repair_rounds` at `phases.ts:262`, `rounds` at `:263`, and the budget endings at `:242-246` and `:264-265`.

## 2. The judge

### 2.1 What exists

There is one results judge: `R/result-verification/verify.ts:121-151`, `verifyAutomationStudioRunResult`.

- It asks yes, no or unknown, asks again on anything but yes (`:137-150`), and reconciles the two answers in
  `agreement.ts`.
- It is the `loop_verification` task kind through `runAutomationStudioLlmHarness` (`:169-188`).
- The diagnosis-envelope instruction is `R/llm/diagnosis-instructions.ts:43`.
- Core's free arithmetic runs first (`core-observation.ts:60-73`): every row refused, or a required value missing.
- Nothing else judges results inside a build.
- The unrelated recovery `diagnosis` asks only "still achievable?".

The request it needs (`verify.ts:83-104`):

| Field | What it is |
| --- | --- |
| `projectId`, `flowId`, `runId` | `runId` is a string label; there is no run in a build, so use `build-test.<uuid>` |
| `summary` | `AutomationStudioRunResultSummary` (`contracts.ts:196-235`): record sets, `reads`, `flowShape`, `withheld` |
| `instructions` | `AutomationStudioFlowInstruction[]`; in a build, `resolvedInstructions.instructions` |
| `runDetail` | optional; it feeds `recentActions` (`context-packet.ts:270`); a build has none |
| `deniedEvidenceKeys` | required once anything is sent: `this.llmEvidenceRuntime.deniedEvidenceKeys` |
| `provider` | the build's `unresolvedProvider.provider`; the build's own key pays, so no result-check authorization is needed |
| `tokenLimits`, `timeoutMs`, `maxEstimatedCostUsd`, `runBudget` | all optional |
| `signal`, `now` | all optional |

It returns the outcome and the interventions:

- `outcome.verdict` is `answers`, `does_not_answer` or `unsure`;
- `basis` and `repair.judgement` (`{ expected, observed, advice }`) are filled from the diagnosis fields;
- `findings` and `fix` are Core's;
- `interventions[*].tokenUsage.{inputTokens, outputTokens, totalTokens, estimatedCostUsd}` is how the build counts its
  spend (`R/llm/harness/intervention.ts:60`).

The summary reaches the model whole:

- `context-packet.ts:281` puts `resultSummary` on the packet for `loop_verification`;
- `request-evidence-check.ts:42,115-122` refuses a summary that holds credentials or has a denied key in its sample
  rows.

So a new optional field on the summary travels as it is, but nothing screens it until the check is extended.

**Bound:** wrap the call in `automationStudioResultVerificationWithinDeadline` (`deadline.ts:56`, default 120 s).

Two mismatches with a build test:

- the instruction says "every run you are shown finished without a failed step" (`diagnosis-instructions.ts:43`);
- it has no notion of a step that was checked rather than run.

Both are fixed by one block of sentences keyed on the new field (W4).

### 2.2 How it is called from the build

The call goes in a `judge` closure that `service.ts` passes to `runAutomationStudioFlowBootstrapBuildPhases`, the same
way `test` is passed today (`service.ts:1614`). Phases call it when a round ends `finished`. This keeps the decision
in `phases.ts`, keeps `R/llm/evidence-loop.ts` (lane B's) at one line, and needs no call through `flow-bootstrap`
into `result-verification`.

The closure does five things:

1. builds the packet (W4's `automationStudioBuildTestResultSummary`) from:
   - `loop.steps`;
   - the last test report (W1's `observeTest`);
   - `accepted.verdict.buildPlan.plan.nodes`;
   - the checklist and the check's `missingActs`;
   - denied keys;
2. calls `verifyAutomationStudioRunResult` within the deadline, with `maxEstimatedCostUsd` set to what the build has
   left;
3. maps the outcome to `yes`, `no`, `unknown` or `not_judged`;
4. returns the reasons;
5. returns its spend.

### 2.3 What the test yields per step today

From `replay-draft.ts:139-147` and `flow-draft/dry-run.ts:119-162`, each step's outcome carries:

- `step`, `stepId`, `actionId`;
- `status`: `replayed`, `failed`, `changed` or `unreproducible`;
- `resultCode`, which gives the word `verified`, `present` or `remembered` (`verify-only.ts`, read by
  `automationStudioFlowDraftReplayOutcomeWord`);
- `mode: "verify"` for a lasting step that was checked and not repeated (D1, `dry-run.ts:80-84`);
- `withheldBy`, `reanchored` and `madeOptional` where they apply.

What it does not carry:

- **No records and no observed values.** The domain's answer to each replay call (`ran.result.evidence`, which holds
  the rows of a list read) is thrown away, except the first failing step's evidence (`replay-draft.ts:163-168`).
- No cart contents or confirmations, unless the Flow itself has a step that reads them.

For a withheld (verified) step, the judge can be shown what exploration already recorded on the draft step itself:

- the target the step acted on (`ranWith` and `input` string values, which `object-binding.ts:99-117` already reads);
- `resultCode`;
- `effectApplied`, shown as `changed: yes/no/unknown` (`flow-draft/entry.ts` `stepLine`);
- `stateBefore !== stateAfter`;
- `replay.from` and `replay.produced`, which are opaque and domain-owned;
- the test's own verify answer (`verified`: it could act now; `present`: its effect is already in place).

Nothing else from exploration is kept on the step. The page view after the step lives only in the loop's evidence
history.

## 3. How each case reaches the test and the judge (new design)

### 3.1 Lane B: `choice_is_the_act_step`, refused six times

**Today.** The model names `aN.size` (or `aN.quantity`) on the Add press. `standing.ts:124` gives
`choice_is_the_act_step`, `check.ts:186-198` refuses, and the round stalls on refusals.

**New design.**

1. The completion is not refused, because only `act_consequence_undeclared` blocks.
2. The test replays from the start. The Add is verified (D1). The steps that open the item page and choose the size
   are replayed, and their observations are captured by W1.
3. The judge sees:
   - every step with its own words: "12 Double Rolls" on a swatch step, or no such step;
   - the Add marked `withheld` with `explored.changed: yes`;
   - the checklist row `aN.size todo choice_is_the_act_step @k` as information.
4. If no step chose the size and the item page did not open with it chosen, the judge answers no, along the lines of
   "size X never chosen; add a step that selects it before step k".
5. The repair round is told exactly that, so one judged repair replaces six blind refusals.

### 3.2 Lane D run 36 (`run-muq3uozx-3153564b`): an act claimed on a listing

**Today.** 24 refusals, while the checklist showed done.

**New design: E20's completion, with no claims in the result, is not refused.** The test replays:

- navigate, dismissals (optional), the Friends link;
- the listing (step 11), with `where` matching `/(?:[5-9]|[1-9][0-9]+) mutual/`;
- the Confirms (steps 15-17, each `present` because "Request accepted" is already shown), repeated over step 11.

The judge sees:

- the instruction;
- step 11's **test records**: one row, Amara Osei "23 mutual friends", from a list of 4 on the Friends home;
- the Confirms' own words: Amara Osei's card, Priya Nair's card, Jonas Weber's card;
- the explored evidence: changed yes.

It answers no. Its observed and changed would say, in effect:

- Priya Nair (4 mutual) is confirmed by step 16, against "at least five";
- Jonas Weber (5, "Aisha Khan and 4 other") is excluded by step 11's condition;
- only 4 of the requests were listed ("See all" was never pressed);
- no step reads the accepted requests into the asked-for table.

Each of these is visible in the packet. Phase 3 starts with those reasons instead of
`a1 step_changed_nothing @11`. The `a1` claim on the listing stays a checklist detail.

### 3.3 Lane A run 40 (`run-muq6lqnw-fdfa7aac`): the napkins claimed on a towels click

**Today.** Accepted. W24b's object binding now refuses it as `step_acts_on_another_object`. In the new design that
reason is information only.

**What the judge sees.** The Flow's 9 steps, each with its own words:

1. navigate
2. Reject all
3. merge
4. Set as my store
5. type Search with the towels query
6. Search
7. the towels link "6 Double Rolls"
8. the "12 Double Rolls $16.47" swatch
9. Add to cart (withheld, explored changed yes, on the towels product page per `replay.from`)

How that shows the napkins were not added:

- no step's words or typed text name the napkins;
- there is one search and one Add to cart, on the towels;
- there is no quantity step;
- the result's claim `a3 -> 26` names the towels link;
- the checklist says `a3 todo step_acts_on_another_object actsOn a2` and `a2.quantity todo`.

The judge answers no: "napkins never searched or added; two packs not set".

The cart itself is not observed. The test does not read it and the Flow has no step that does, so the evidence is the
Flow's shape plus each step's words. That is enough for this case.

Note: this run's other defect, step 4 verified `present` while the chooser was closed (downstream
`node-run/verify.ts`), is not something the judge can see. It stays t196's.

### 3.4 Lane A run 41 (`run-muq70foz-74caa189`): re-author handling

- The re-author seeds the earlier Flow as steps with ids `f<n>` (`R/llm/node-tools/draft-from-flow.ts:69,109-127`).
  They are `effect: "mutate"`, `kept`, `proposes: true`, and have **no `replay`**.
- So:
  - the checklist counts a claim on them as done;
  - the draft is not `Replayable`, so **no test ran at all**;
  - that is how "claimed steps 5-9 of the existing Flow" was accepted.
- New design:
  - the packet marks every seeded step `carried: true, outcome: "not_run"`, and the whole test `not_run` when the gate
    did not apply;
  - the judge instruction says a carried step that was not run in this test is no evidence that its act is done;
  - phases map `unknown` and `not_judged` to repair when any proposed step is carried and untested
    (`untestedCarried`), never to acceptance;
  - the repair is told "steps 5-9 were carried from the earlier Flow and not run in this build: rerun them live
    (amend_draft rerun)", so they gain `replay` and the next completion is tested.
- Not verified: that `rerun` on a seeded step yields a step with `replay` (`R/llm/evidence-loop/rerun-replacement.ts`).
  The lead should check this before relying on it.

## 4. The design, partitioned by file

### 4.1 Cross-worker contracts

Fix these exactly in the briefs so the four workers can run in parallel.

```ts
// W1, R/llm/node-tools/dry-run-gate.ts (exported via node-tools/index.ts)
export type AutomationStudioFlowDraftTestObservation = { step: number; stepId?: string; resultCode?: string; evidence: JsonValue };
export type AutomationStudioFlowDraftTestReport = {
  verdict: AutomationStudioFlowDraftDryRun;            // the replay it passed on
  observations: AutomationStudioFlowDraftTestObservation[];
  reused: boolean;                                      // answered from an earlier clean replay of the same signature
};
// gate input gains:  observed?(report: AutomationStudioFlowDraftTestReport): void   -- called only when the gate passes
// R/llm/loop-configuration.ts AutomationStudioLlmEvidenceLoopInput gains:  observeTest?(report: AutomationStudioFlowDraftTestReport): void

// W3, R/flow-bootstrap/unfinished-build/contracts.ts
export type AutomationStudioFlowBootstrapJudgeSpend = { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number };
export type AutomationStudioFlowBootstrapTestVerdict =
  | { verdict: "yes"; spent: AutomationStudioFlowBootstrapJudgeSpend }
  | { verdict: "unknown" | "not_judged"; why: string; untestedCarried?: number[]; spent: AutomationStudioFlowBootstrapJudgeSpend }
  | { verdict: "no"; expected?: string; observed?: string; advice?: string; findings: string[]; spent: AutomationStudioFlowBootstrapJudgeSpend };
// phases input gains:
//   judge?(input: { round: number; loop: Extract<AutomationStudioLlmEvidenceLoopResult, { ok: true }>; budget: AutomationStudioLlmEvidenceLoopBudget }): Promise<AutomationStudioFlowBootstrapTestVerdict>;
// finished outcome gains:  judged?: AutomationStudioFlowBootstrapTestVerdict  (without spent is fine)
// AutomationStudioFlowBootstrapJudgement gains:  judge?: { verdict: "no"; expected?; observed?; advice?; findings: string[]; untestedCarried?: number[] }

// W4, R/result-verification/contracts.ts, on AutomationStudioRunResultSummary:
//   buildTest?: AutomationStudioBuildTestAccount   (see W4)
// W4, R/result-verification/build-test/judge.ts:
//   automationStudioBuildTestJudge(deps): (input) => Promise<AutomationStudioFlowBootstrapTestVerdict-shaped value>
//   (W4 declares a structurally identical local type and does not import W3's; the lead unifies it at integration)
```

### 4.2 W1: capture what the test observed (`worker`, medium)

Owns:

- `R/llm/node-tools/replay-draft.ts`
- `R/llm/node-tools/dry-run-gate.ts`
- `R/llm/node-tools/index.ts`
- `R/llm/loop-configuration.ts`
- `R/llm/evidence-loop.ts` (**lane B's file**: one line only)
- `R/llm/node-tools/tests/{replay-draft.test.ts, dry-run-gate.test.ts}`

Changes:

- **`replay-draft.ts`**
  - `AutomationStudioFlowDraftReplayResult` gains
    `observations: { step, stepId?, resultCode?, evidence }[]`.
  - It holds one entry per readable step answer, taken from `ran.result.evidence` and pushed beside each outcome
    (`:139-147`).
  - The reset is excluded.
  - Leave `evidence` (the first failure) as it is.
- **`dry-run-gate.ts`**
  - Keep `cleanObservations` beside `cleanSignature`, and set it at `:151` and at `madeOptional` `:158-160`.
  - On the path that passes judging from stored outcomes (`:116-121`), keep the `refused` replay's observations with
    `refused`.
  - Call `input.observed?.({ verdict, observations, reused })` on every pass: `:106`, `:121`, `:152` and `:160`.
  - Never call it on a refusal.
- **`loop-configuration.ts`**: add the optional `observeTest`.
- **`evidence-loop.ts:385-395`**: add `...(input.observeTest ? { observed: input.observeTest } : {})` to the gate
  input. That is the only edit in this file.
- **Tests (provider-free)**:
  - a clean replay reports one observation per step, verify-mode steps included, with the evidence the scripted
    `executeTool` returned;
  - a second completion on the same signature reports `reused: true` with the first replay's observations;
  - a refused replay reports nothing;
  - a pass after the twice-replayed draft is judged from its stored outcomes reports the stored observations.
- **Validation**:
  `npx vitest run src/programs/automation-studio/runtime/llm/node-tools src/programs/automation-studio/runtime/llm/tests`
  and the evidence-loop tests.

### 4.3 W2: the completion stops refusing on instructed acts, except the permission rule (`worker`, medium)

Owns:

- `R/flow-bootstrap/instructed-acts/{step-fault.ts, check.ts, index.ts, permission.ts (new)}`
- `R/flow-bootstrap/instructed-acts/tests/permission.test.ts` (new)
- `R/llm/harness-options/bootstrap-completion.ts`
- `R/llm/harness-options/tests/bootstrap-completion.test.ts`

Changes:

- **`step-fault.ts`**: export `automationStudioInstructedActConsequenceUndeclared(act, step, steps): boolean`,
  extracted from `:39-46`; `automationStudioInstructedActStepFault` calls it.
- **`check.ts`**: export the claim reading only (`readClaims` and `assign`, renamed
  `automationStudioInstructedActClaims({ acts, choices, result })`). No behaviour change. `check.test.ts` stays green
  and the check remains the information verdict that W4 reads.
- **`permission.ts` (new)**: `checkAutomationStudioInstructedActPermissions({ instructionText, result, draftSteps })`.
  - For each act with `consequence`, take every step named for it: the step's own `acts`, plus result claims.
  - Keep those that are kept, mutating and proposable.
  - Refuse when any such step, together with its repeat span, has no step declaring the class. This holds whatever
    other fault the step has (optional, unrepeated, and so on).
  - Return `{ ok: false, issue: { code: "bootstrap.instructed_act_missing", ... }, missingActs: { acts: [{ id, kind,
    verb, quote, consequence, reason: "act_consequence_undeclared", step }] }, instruction }`.
  - Reuse `INSTRUCTION` and `CONSEQUENCE_INSTRUCTION`, exported from `check.ts`.
  - An act named on no step is left to the judge.
- **`bootstrap-completion.ts:294-301`**: replace the instructed-acts failure with the permission check, under the
  same code `evidence_completion_cannot_answer` and the detail key `missingActs`. Remove the `repeat-suggestion`
  call (see the open questions) and rewrite the header paragraph at `:53-56`.
- **Tests that must change** (`bootstrap-completion.test.ts` `:443-560`, the describes "a completed draft that does
  not do what the instruction asks" and "... named for arriving where it starts"):
  - each refusal becomes an acceptance: no steps named; a read named for the act (the run 36 shape: listing with
    `a1` plus a repeated Confirm with `a1`); arrival only; `choice_is_the_act_step` (lane B); the towels Add named
    for the napkins (the run 40 shape);
  - new: a withdraw act on a kept press that declares only `modify_existing` is refused `act_consequence_undeclared`;
  - new: the same press marked optional is still refused for the declaration;
  - new: once it declares `delete`, it is accepted.
  - `repeat-suggestion.test.ts`, `check.test.ts`, `checklist.test.ts` and `object-binding.test.ts` are unchanged.
- **Validation**:
  `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts src/programs/automation-studio/runtime/llm/harness-options`.

### 4.4 W3: phase 2/3 wiring, verdicts, budget and re-author (`worker-high`)

Owns:

- `R/flow-bootstrap/unfinished-build/{phases.ts, judgement.ts, contracts.ts, not-doable.ts}`
- `R/llm/evidence-loop/resume.ts`
- `R/flow-bootstrap/unfinished-build/tests/phases.test.ts`
- `R/flow-bootstrap/unfinished-build/tests/judged.test.ts` (new)
- `R/llm/evidence-loop/tests/resume.test.ts`

Changes:

- **`phases.ts:203`**: on `finished`, if `input.judge` is given, call it with `remaining(input, spent, elapsed)` as
  the budget, then `addAccounting(spent, { ...spend, iterations: 0, toolCalls: 0, evidenceBytes: 0 })`.
  - `yes`: return `finished` with `judged`.
  - `unknown` or `not_judged` without `untestedCarried`: return `finished` with `judged`, recorded as unverified.
    Justification:
    - a second ask has already failed to settle it (`verify.ts:137-150`);
    - an unsure verdict carries no repair directive (`contracts.ts`, `repair` doc), so a repair would have nothing to
      act on;
    - the person reviews the proposal;
    - the Flow's first real run is judged by the same verifier.
  - `not_judged` covers: no cost left, the deadline passed, or the judge was cancelled.
  - `no`, or `unknown`/`not_judged` with `untestedCarried`: build the judgement with
    `automationStudioFlowBootstrapJudgeFinished`, below. The seed is `automationStudioFlowBootstrapRepairSeed(loop.steps)`.
    Then take the same repair path as an unfinished round:
    - the `previous` / `JudgementAdvanced` check, then `not_doable`;
    - `maxRepairRounds`, `maxRounds` and `exhaustedBound`;
    - announce `"Repairing the Flow"`, with text naming the judge's reason;
    - `resume()` carries the judgement.
  - A cancelled judge (the signal aborted) is the `ended` cancelled outcome, as at `:218-220`.
- **`judgement.ts`**
  - New `automationStudioFlowBootstrapJudgeFinished({ round, steps, verdict, checklist })`:
    - `tested: "replayed_clean"`, or `"not_tested"` when `untestedCarried`;
    - `stopped: "judged_wrong"` (a new member of `AutomationStudioFlowBootstrapUnfinishedStop`; check `not-done.ts` and
      `keep`, which take a `stopped`);
    - `judge: {...}`;
    - `done` and `todo` from the checklist, as today.
  - `JudgementValue` adds `judge` (its strings are the model's own, already screened by `verdict.ts`).
  - `JudgementAdvanced`: when `before.judge` is set, a repair has advanced if the proposed steps' replay signature
    changed (`automationStudioFlowDraftReplaySignature`; store a `flowSignature` on the judgement), or if checklist
    `done` rose. A repair that hands back the same Flow is the evidence for not doable.
- **`not-doable.ts`**: when the last judgement has `judge`, say its expected and observed (the person's
  "why"), then the checklist clauses as today.
- **`resume.ts`**:
  - new `JUDGED_INSTRUCTION` when `judgement.judge` is present: "The Flow you said was ready was tested from its start
    and judged against the instruction: judgement.judge says what it did not do (observed), what was asked
    (expected) and what to change (advice). The page is where the test left it: look first. Work live on exactly
    that ... The acts checklist is the build's own reading and is information, not the bar: the Flow is judged on
    what its test does."
  - with `untestedCarried`, add "steps <list> were carried from the earlier Flow and not run in this build: rerun
    them live (amend_draft rerun)".
  - in `REPAIR_INSTRUCTION`, replace "complete only when every act and choice on the checklist is done" with "complete
    when the Flow does what the instruction asks".
- **Budget**
  - The judge's spend counts against the build's $0.25 through `spent`, so later rounds get less (`remaining`).
  - No reserve is taken. A judge with `maxCostUsd <= 0` left returns `not_judged`, and the Flow is proposed
    unverified, never thrown away.
- **Tests (provider-free, judge scripted)**:
  - a finished round judged `yes` is finished, and the judge's cost is in `accounting`;
  - judged `no`: a repair round follows, seeded with the Flow, with `resume.judgement.judge.observed` and
    `findings` carried; a repair finished and judged `yes` ends finished; the trace is numbered across rounds;
  - judged `no` twice on an unchanged Flow: not doable, with the judge's reason in the ending;
  - judged `no` with `maxRepairRounds` reached: `repair_rounds`;
  - `unknown`: finished, with `judged.verdict === "unknown"`;
  - `unknown` with `untestedCarried: [5, 6, 7, 8, 9]` (the run 41 shape): a repair, told to rerun those steps;
  - a judge called with no cost left returns `not_judged`: finished, unverified;
  - the judge throws a cancellation: `ended` cancelled;
  - existing tests stay green: without `judge`, behaviour is unchanged.
  - `resume.test.ts`: the judged instruction and the carried-steps sentence.
- **Validation**:
  `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/llm/evidence-loop`.

### 4.5 W4: the judge, its packet and screening (`worker-high`)

Owns:

- `R/result-verification/build-test/{summary.ts, judge.ts, index.ts}` (new)
- `R/result-verification/build-test/tests/{summary.test.ts, judge.test.ts}` (new)
- `R/result-verification/index.ts` (one export line)
- `R/result-verification/contracts.ts` (the `buildTest` type)
- `R/llm/diagnosis-instructions.ts`
- `R/llm/harness/request-evidence-check.ts`
- the matching harness test (`R/llm/harness/tests/request-evidence-check*.test.ts`, or the nearest existing one)

Changes:

- **`contracts.ts`**: add `buildTest?: AutomationStudioBuildTestAccount` to `AutomationStudioRunResultSummary`:

  ```ts
  type AutomationStudioBuildTestAccount = {
    kind: "build_test";
    test: "ran" | "reused" | "not_run";
    steps: Array<{
      step: number; action: string;
      target?: string[];            // the step's own words from ranWith/input (target name/text, row/card, option, typed text)
      claims?: string[];            // acts the step or the result names it for -- claims, not proof
      outcome: "replayed" | "verified" | "present" | "remembered" | "failed" | "changed" | "unreproducible" | "not_run";
      withheld?: true; withheldBy?: number; runs?: JsonValue; carried?: true;
      observed?: JsonValue;          // the test's evidence for this step: reads (non-mutating proposed steps) and verify answers only
      explored?: { changed: "yes" | "no" | "unknown"; resultCode?: string; stateChanged?: boolean };  // for withheld steps
    }>;
    checklist?: JsonObject[];         // automationStudioInstructedActsChecklistValue
    missingActs?: JsonObject;         // checkAutomationStudioInstructedActs(...).missingActs when not ok -- information
  };
  ```

- **`build-test/summary.ts`**:
  `automationStudioBuildTestResultSummary({ steps, report, nodes, instructionText, result, startLocation, deniedEvidenceKeys })`.
  - It returns the summary with `recordSets: []`, `recordSetCount: 0` (so `core-observation` returns undefined) and
    `flowShape` from `summarizeAutomationStudioRunResult({ recordSets: [], flowNodes: nodes, deniedEvidenceKeys }).flowShape`.
  - `buildTest`:
    - every proposed step, in order;
    - `target`: strings from `ranWith` then `input`, dropping keys in the denied list and every
      `automationStudioLocatorShapedText` string, without duplicates. No count cap; each string bounded only as the
      packet's JSON bounds already do;
    - `carried` for an id with the `f` prefix (`draft-from-flow.ts:69`; export the prefix or a predicate there; that
      file's owner is unassigned, so the lead adds the export);
    - `outcome` from `step.replayed` via `automationStudioFlowDraftReplayOutcomeWord`, or `not_run`;
    - `observed` from the report, keyed by step, kept only for `effect !== "mutate"` steps and verify-mode steps, and
      put through `screenAutomationStudioLlmEvidence`;
    - `explored` from `effectApplied`, `resultCode` and the state digests.
  - It returns `untestedCarried`: the positions of carried steps whose outcome is `not_run`.
- **`build-test/judge.ts`**: `automationStudioBuildTestJudge({ verify = verifyAutomationStudioRunResult, provider,
  instructions, deniedEvidenceKeys, projectId, flowId, signal, now })` returns `(input) => Promise<verdict>`.
  - It calls `verify` within `automationStudioResultVerificationWithinDeadline`, with
    `maxEstimatedCostUsd = budget.maxCostUsd`.
  - Mapping:
    - `answers` -> `yes`;
    - `does_not_answer` with a failing basis (`automationStudioResultVerificationFailsRun`) -> `no`, with
      `repair.judgement.{expected, observed, advice}` and `repair.findings[*].code`;
    - `unsure`, `model_disagreed` or `model_unconfirmed` -> `unknown`;
    - `performed: false`, or the deadline -> `not_judged`.
  - `spent` is the sum of `interventions[*].tokenUsage`.
  - `untestedCarried` is passed through from the summary.
  - No cost left skips the call and returns `not_judged`.
- **`diagnosis-instructions.ts:43`**
  - Add the build-test sentences: buildTest is a build's test before proposal; withheld steps were only checked,
    `verified` meaning it could act now and `present` meaning its effect is in place, so judge them from `explored`
    and their target; the checklist and claims are information, not proof; carried steps are no evidence; answer no
    naming the clause not done and the step to change or add.
  - Change "every run you are shown finished without a failed step" to exclude a build test.
- **`request-evidence-check.ts:115-122`**: also refuse when `summary.buildTest` has a denied key
  (`screenAutomationStudioLlmEvidence`) or any locator-shaped string (reuse `locatorShapedAnywhere`). The builder
  drops both first, so a refusal means drift.
- **Tests (provider-free, `verify` injected or the provider scripted)**:
  - **run 36 packet**:
    - steps 15-17 carry Amara/Priya/Jonas words, `present` and `withheld`;
    - the listing's `observed` holds the one-row read;
    - the scripted `no` maps to `no` with observed and findings;
  - **run 40 packet**:
    - no step's target holds "napkins";
    - `missingActs` shows `a3 step_acts_on_another_object actsOn a2`;
    - the scripted `no` maps to `no`;
  - **run 41 shape**: seeded `f5`-`f9` steps give `test: "not_run"`, `carried` on each, and
    `untestedCarried: [5..9]`;
  - **lane B shape**: the Add claimed for `a2.size` shows checklist `choice_is_the_act_step` as information, and the
    swatch step's words are carried;
  - **mapping**: `answers` -> `yes`; two `unsure` -> `unknown`; deadline -> `not_judged`; spend summed; no cost ->
    no call.
  - **screening**: a denied key in `observed` or a selector in `target` is dropped by the builder and refused by the
    request check.
- **Validation**:
  `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/llm/tests`.

### 4.6 Lead integration (two `service.ts` hunks; no worker owns `service.ts`)

1. Round config (`service.ts:1565-1594`): add `observeTest: (report) => { lastTest = report; }`.
2. The phases call (`service.ts:1611-1620`): add the judge closure:

   ```ts
   judge: async ({ round, loop, budget }) =>
     automationStudioBuildTestJudge({
       provider: unresolvedProvider.provider, instructions: resolvedInstructions.instructions,
       deniedEvidenceKeys: this.llmEvidenceRuntime?.deniedEvidenceKeys, projectId, flowId, signal
     })({
       summary: automationStudioBuildTestResultSummary({
         steps: loop.steps, report: lastTest, nodes: accepted.verdict?.buildPlan.plan.nodes ?? [],
         instructionText: bootstrapInstructionText, result: loop.result, startLocation, deniedEvidenceKeys
       }),
       budget
     })
   ```

   Reset `lastTest` at each round's start.
3. Re-author awareness comes from the `f` prefix, which needs no `extend` flag.
4. Add the `f`-prefix predicate export in `R/llm/node-tools/draft-from-flow.ts` (one line).

Then run `pnpm check` and the vitest groups above.

## Commands run and observed results

- `npx vitest run .../llm/harness-options/tests/bootstrap-completion.test.ts .../flow-bootstrap/unfinished-build/tests/phases.test.ts .../llm/harness-options/tests/repeat-suggestion.test.ts`
  in `packages/fluxiq`, on the tree with w24b's and w24c's edits: **3 files passed, 49 tests passed** (26, 19 and 4),
  in 25.3 s. This confirms that today's behaviour is the baseline the changes in W2 and W3 alter.
- Everything else was read: `rg`, `sed` and `cat` over the files cited, and the three debug reports.

## Not verified

- Whether `amend_draft rerun` on a seeded `f<n>` step yields a step with `replay`, which W3's carried-step repair
  relies on.
- The web domain's per-step replay evidence shape and size (`ran.result.evidence` for clicks and verifies), which
  W1 captures and W4 filters.
- Whether the DeepSeek adapter serialises `context.resultSummary` whole. `context-packet.ts:281` passes it whole; the
  adapter was not read.
- Whether the structure audit accepts a new `result-verification/build-test/` directory imported by `service.ts`.
- Token size and cost of a judge packet with full read rows. Not measured.

## Open questions or contradictions found

1. **`repeat-suggestion.ts` loses its only caller** (`bootstrap-completion.ts:299`). Options:
   - (a) W2 or the lead adds `repeatWith` to the checklist items whose todo is `act_needs_repeat` or
     `span_stops_short` (in `harness-options/draft-acts.ts`; needs the registry and resolution from `service.ts:1583`);
   - (b) delete it.
   Recommend (a) as information, or this becomes an unused export.
2. **Answerability (`:279-284`) and the start location (`:285-288`) still block.** The brief names only the
   instructed acts. Answerability is the same kind of judgement ("records requested, no producer") and could move to
   the judge as well. That is the lead's call.
3. **The in-round dry-run refusal stays** (`completion-attempt.ts:74-77`). A test that fails to replay is answered
   live in the same round, from where the test left the page; only a clean or passed test reaches the judge. This
   matches the current header (user, 2026-09-30) and keeps the replay-feedback loop. If the lead wants every test
   failure to go to phase 3 instead, that is a W3 change to round-ending and phases.
4. **`checklist.ts:14-17` promises "the checklist never shows done what a completion then refuses".** That stops
   being a contract once the check no longer refuses. Its header should be reworded (W2 owns that directory).
5. **The test does not observe the cart or confirmations unless a Flow step reads them.** The judge infers them from
   step words and explored evidence. A Core-owned "end-state look" after the test (the domain's initial observation
   tool) would give it the page the test ended on. Not proposed here, because of cost.
