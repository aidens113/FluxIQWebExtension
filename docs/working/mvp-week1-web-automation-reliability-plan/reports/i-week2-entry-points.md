# i-week2-entry-points — where each Week 2 phase starts in today's code

Read-only investigation, 2026-09-13. No tests, builds, Lab commands or edits other than this file.

Path shorthand: **Core `as/`** = `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`;
**web UI** = `F:\!FluxIQ\apps\web\src\features\automation-studio\`; **here** = `F:\!FluxIQWebExtension\`.
Week 1 criteria are named as in the plan's Current State: Actions reliable, Evidence useful, Deterministic
fallback, Failures classified, Bench repeatable, Blockers ranked.

## Outcome

Done. Every phase from 2.1 to 2.9, plus the Week 2 exit criterion, is mapped below to its owning code, what exists, what is missing, and its Week 1 dependency. The plain-English answer is in its own section.

## What changed and why

Only this report was written. Nothing tracked was touched.

## Commands run and observed results

No shell commands were run. The reads and searches, with what they confirmed:
- The 30-day plan, lines 365-654 ("Week 2 Objective" to "Week 2 Exit Criteria").
- Core `docs/architecture/automation-studio.md`, lines 191-577 ("LLM-Assisted Deterministic Automation", including Router Runtime).
- The Current State of `docs/working/llm-production-automation-plan.md` (lines 14-68, dated 2026-09-10).
- Code excerpts, each cited at its point of use below.

## Task 1 — phase by phase

### 2.1 Standardize adaptation context
- **Owner:**
  - Core `as/runtime/llm/harness/context-packet.ts:20-50` (packet type) and `:64-102` (`packAutomationStudioLlmContext`).
  - The failure-evidence cap is `as/runtime/llm/harness/failure-evidence.ts:6` (3,000 bytes), sanitised at `:17`.
  - Capture is called from `as/runtime/service.ts:2939-2961`.
  - The web producer is here, `domain/src/runtime/llm-evidence/tools.ts:172-203` (one `web.dom.capture_snapshot`, sanitised).
  - Reuse: Core `as/runtime/reusable-llm-context.ts`; here, `domain/src/runtime/reusable-evidence.ts` and `reusable-evidence-coordinator.ts`.
- **Exists:**
  - Project, Flow, run, Subflow and node IDs.
  - Resolved instructions.
  - State diffs (up to 50) and route history (last 25).
  - The last 12 attempts, carrying failure *category only* (`context-packet.ts:52-62`, `:90`).
  - One sanitised snapshot of the current page.
  - The Subflow inventory and policy gates.
  - Empty slots for `relevantRuns`, `relevantAdaptations` and `reusableContext` (`:34-36`).
- **Missing:**
  - The packet has no field for expected state, previous browser state, failed target, current URL, or recording context (`:20-50`).
  - The failure record's code and texts are deliberately withheld (`:60`).
  - Nothing retrieves or ranks. Per the LLM plan's Current State, no production caller fills the relevant-runs, relevant-adaptations or reusable-context slots, and reuse is disabled.
- **Depends on Week 1:**
  - Evidence useful: the packet budget and leak rows are still unproven, and W17's file name is still in a saved attempt.
  - Failures classified: category is the only failure signal the model receives.

### 2.2 Separate diagnosis from exploration
- **Owner:**
  - Core `as/runtime/adaptive-orchestrator.ts:65` (`classifyAutomationStudioAdaptiveFailure`), with eligibility at `:209`.
  - `as/runtime/executor/recovery-ladder.ts:5-73`.
  - `as/runtime/service.ts:2865` (`maybeAnnotateRunDetailWithRuntimeLlm`).
  - Record types: `as/model/flow-adaptation.ts:248-255` (intervention kinds) and `:294-322` (recovery records, run detail).
- **Exists:**
  - Deterministic candidates are ranked before an LLM step: failed-route edge, approved patch, reroute, then LLM (`recovery-ladder.ts:31-61`).
  - Diagnosis and patch are separate intervention records (`service.ts:3148`).
  - A `diagnosis_only` lane exists (web UI `runtime/FlowRunView.tsx:264`).
  - `auth_required` and `user_intervention_required` are ineligible for AI (`adaptive-orchestrator.ts:209`).
- **Missing:**
  - There is no Plan stage and no Exploration stage in a runtime trace.
  - Runtime diagnosis never explores the browser; the evidence loop is used only for Flow creation (`service.ts:1914`).
  - When the ladder picks LLM, it stops the run (`recovery-ladder.ts:76`). Diagnosis runs only after the run has failed (`service.ts:2877`).
  - I did not read the diagnosis response schema, so whether it answers "still achievable?" and "is AI needed?" is unchecked.
- **Depends on Week 1:**
  - Failures classified: this gates eligibility.
  - Deterministic fallback: this is the ladder's first rungs.

### 2.3 Bounded harness exploration
- **Owner:**
  - Core `as/runtime/llm/evidence-loop.ts:4-8`: 16 iterations, 16 tool calls, 1 MB.
  - Its failure codes, `:47-57`: duplicate call, repeat without progress, iteration or evidence limit, cancelled.
  - `as/runtime/llm/run-budget.ts:3-28`.
  - Grant ceilings, `as/runtime/llm/execution-grants.ts:517-524`.
  - `as/runtime/executor/recovery-budget.ts:17`.
  - Tool safety is here, in `domain/src/runtime/llm-evidence/tools.ts`: same origin only at `:142`, reveal only a safe disclosure at `:160`, and no fill, select or submit per the description at `:119`.
- **Exists:**
  - Call, token, cost and timeout ceilings (Flow Settings: at most 50,000 tokens, 25 s and USD 0.25).
  - Iteration, tool-call and byte caps.
  - No cross-origin navigation and no form entry.
  - Budget exhaustion ends in failure, not a loop (`recovery-ladder.ts:77`).
- **Missing:**
  - The five named end states (RECOVERED, FAILED, USER_INTERVENTION_REQUIRED, BUDGET_EXHAUSTED, UNSAFE_ACTION_BLOCKED) do not exist. The only near match is the failure category `user_intervention_required` (`F:\!FluxIQ\packages\contracts\src\failure\adaptive-class.ts:42`).
  - There is no runtime exploration that acts: no clicks or typing to recover.
  - There is no destructive-action classifier for exploration steps.
  - There is no detection of a repeated unsuccessful pattern across attempts.
- **Depends on Week 1:**
  - Actions reliable: the tools drive the same extension actions, `web.browser.navigate` (here, `apps/extension/src/runtime/action-runner.ts:59`) and `web.dom.capture_snapshot` (`apps/extension/src/content/actions/execute.ts:128`).
  - Evidence useful: redaction of what the model sees.

### 2.4 Recovery success detection
- **Owner:**
  - Core `as/runtime/live-patch.ts:174-200`: runs the patch on a copy from the failed node, then `runtimePatchRestoredExpectedState` at `:185`.
  - Transition comparison, `as/runtime/executor/transition-comparison.ts`.
  - The host expectation evaluator (architecture page, lines 468-491).
  - Here, `domain/src/runtime/llm-evidence/target-override.ts` via `tools.ts:204-207`.
- **Exists:**
  - A tested patch is judged by whether the expected transition was restored.
  - An expected-state rejection fails an attempt (Week 1's C1).
  - A target override is checked against page evidence: a unique exact selector compatible with the action.
- **Missing:**
  - The only lane with a production provider, `diagnose_and_adapt`, never runs the patch; it is proposal only (`service.ts:3110-3113`).
  - There are no separate checks against expected output, URL or router continuation.
  - Nothing emits a "safe to resume" verdict.
- **Depends on Week 1:**
  - Failures classified (`expected_state_missing`).
  - The W19 landing claim and expectation work (C1, C2, D1, D1b).
  - Deterministic fallback.

### 2.5 Convert exploration into reusable automation
- **Owner:**
  - Core `as/runtime/live-patch.ts:202-239` (`adaptationFromRuntimePatch`).
  - The record type, `as/model/flow-adaptation.ts:336-360`; change proposals, `:139-188`.
  - Flow creation, `as/runtime/service.ts:1808` (`generateFlowBootstrapAdaptation`).
- **Exists:**
  - A patch becomes an adaptation carrying source run, trigger, failed action, diagnosis, validation results, risk and author. Patch kinds: target override, action sequence, wait or retry, reroute.
  - Creation from instructions yields a bootstrap-plan adaptation.
- **Missing:**
  - No code analyses or trims an exploration path: a search for trajectory or path minimisation in Core `as/` found nothing.
  - At runtime in production, the only output is one target override (`service.ts:3070-3075`).
  - I found no code that writes input or output expectations for a repair.
- **Depends on Week 1:**
  - The recorder's target identity and fingerprints (the Core target gate).
  - The mapper's `expectedState` and wait proposals (W19 D1, W25 wait mapper).

### 2.6 Validate proposed adaptations
- **Owner:**
  - Core `as/runtime/training-modes.ts:306-318` (promotion gate) and `:284-304` (proposal gate).
  - `as/runtime/service.ts:3171-3245` (`maybePromoteRuntimeAdaptation`).
  - Lab provider-free check, here, `packages/test-runner/src/demo-workspace/exploration-adaptation.ts:223-241`.
- **Exists:**
  - Statuses proposed, testing, validated, applied, rejected, disabled, reverted, superseded (`flow-adaptation.ts:326-334`).
  - Auto-apply only when validated, low risk, non-structural, with no side effects, and past the first manual review.
  - PIN approve and apply (here, `packages/test-runner/src/demo-llm-adaptation-control.ts:47-64`).
- **Missing:**
  - There is no high, medium or low confidence value.
  - There is no "use now, keep provisionally, confirm over later runs" tier.
  - Nothing restores the input state and replays the repair before promotion. The target override is only checked against captured evidence.
- **Depends on Week 1:**
  - Bench repeatable: validation needs trustworthy replays.
  - Actions reliable.

### 2.7 Persist adaptations
- **Owner:**
  - Core `as/storage/project/adaptation-store.ts:50` (`putAdaptation`), `:159` (`applyApprovedAdaptation`), `:221` (`rollbackAdaptation`).
  - `as/runtime/service/adaptations/durable.ts:31`, `:92`.
  - `as/runtime/service/adaptations/patches.ts:33` (node), `:108` (router), `:174` (Subflow), `:207` (create Subflow).
  - `as/runtime/service.ts:4276` (`reviewFlowAdaptation`).
- **Exists:**
  - Revision-bound, audited, reversible apply for node, router and Subflow patches.
  - Certified live once. Per the LLM plan, run `5be70f05…` was applied, and validation run `80414559…` ran six actions with zero provider calls.
- **Missing:**
  - No persisted confidence.
  - No accumulated validation history driving promotion.
  - The repair stores a literal selector, not Week 1's target identity. The LLM plan: "Literal selectors still travel … no provider-neutral Core seam for opaque `target.N`".
- **Depends on Week 1:**
  - Target identity and fingerprint.
  - Withholding at rest (Core `6621d66`), so persisted records carry no secrets.

### 2.8 Resume current execution
- **Owner:**
  - Core `as/runtime/service.ts:3260-3290` (`retryRuntimeSessionAfterAutoAppliedPatch`), called at `:3540` and `:3594`.
  - Start selection, `as/runtime/executor/graph-run.ts:151-152`.
  - `as/runtime/live-patch.ts:178`.
- **Exists:** after an automatically applied patch, the same session reruns the updated Flow once.
- **Missing:**
  - The rerun starts from the Flow's start, not the failed node: `service.ts:3287` passes graph options with no `startNodeId`.
  - The rerun is skipped for every explicit LLM run (`:3540` `!input.llmExecution`, `:3594`).
  - The production provider resolver returns no provider without an explicit grant (`F:\!FluxIQ\packages\fluxiq\src\programs\_shared\runtime.ts:74-83`). The auto-apply-and-retry path is therefore unreachable in the shipped app.
  - The Lab's "continue" is approve plus apply, not a resume (`demo-llm-adaptation-control.ts:55-64`).
- **Depends on Week 1:**
  - Every Flow run starts on the start page (F1).
  - The start-node fix in flight (`g-core-start-node`).
  - Actions reliable.

### 2.9 Prove deterministic reuse
- **Owner:**
  - The bench, here, `packages/test-runner/src/bench/corpus/`. Only `smoke.ts` and `week1.ts` exist (`week1.ts:26`).
  - The provider-free check, `demo-workspace/exploration-adaptation.ts:223-241`.
  - Core `as/runtime/training-modes.ts:200` (stability metrics) and `:271` (LLM invocation gate).
- **Exists:**
  - A one-off provider-free replay after applying, which checks that the source run made exactly two provider calls.
  - The run detail records whether the LLM was invoked (`service.ts:3153-3161`).
- **Missing:**
  - No FluxBench corpus or rows for adaptation.
  - No row showing that the same novelty recurs, the learned path is chosen, and the LLM stays off.
  - Reusable context is disabled.
- **Depends on Week 1:**
  - Bench repeatable (`--repeat 3` twice).
  - Blockers ranked.

### Week 2 exit criterion — Fail → Diagnose → Explore → Recover → Repair → Validate → Persist → Resume → Re-run
- **Owner:** Core `as/runtime/service.ts:3345` (`runRuntimeSession`), then the adaptation store (2.7), then the Lab scripts (2.9).
- **Exists:**
  - The shipped path is: fail, one diagnosis, one proposed target override, manual approval and apply, then a new deterministic run.
  - It was certified live once, on one fixture, for one selector drift.
- **Missing:** runtime Explore, in-run Validate and Resume, repeat measurement, and any other repair kind.
- **Depends on Week 1:** all six criteria, chiefly Actions reliable, Failures classified and Bench repeatable.

## Task 2 — in plain words

**The question:** can a person type what they want, run it, have the AI explore a website and build an automation, and have the automation fix itself while it runs?

**Typing instructions: works.** Core's web app has a text box on a new, empty automation. Saving it stores the instruction.
- `BlankFlowAuthoringPanel.tsx:43`, `:89`
- `authoring-commands.ts:10-12`

It only works on an empty automation; Core refuses otherwise (`service.ts:1845`).

**The AI exploring a site: partly works.** In explore mode, Core lets the AI take several turns: at most 8 model calls and 7 page tools.
- `BlankFlowAuthoringPanel.tsx:105`
- `authoring-commands.ts:14-20`
- `service.ts:1914-1922`

With those turns it can do three things in the browser tab the extension controls (`domain/src/runtime/llm-evidence/tools.ts:97-122`):
- look at the page;
- go to another page on the same site (`:142`);
- open a menu, tab or collapsed section (`:160`).

It cannot type, pick options, submit forms, or leave the site. It starts from whatever page the tab already shows; I found no step that opens a starting address for it.

**Building the automation: works, with a person in the loop.** The AI's result is saved as a proposed change, not applied (`service.ts:1808`). A person reviews and applies it (`service.ts:2134`, `:4402`). After that it runs with no AI at all. This has been shown live on two practice pages: the LLM plan's instruction-only form and `basic-form`.

**Running it: works.** A normal run is fully scripted (`service.ts:3345`). The run page also offers "LLM diagnosis" and "Diagnose and propose adaptation" (`FlowRunView.tsx:264-265`). How reliable the underlying clicking, typing and recording are is still being proven in this week's testing.

**Changing the automation while it runs: missing.**

What happens today:
- The AI is asked only after a run has already failed (`service.ts:2877`).
- It gets one snapshot of the page (`tools.ts:172-203`).
- It may suggest one replacement for an element a step could not find. Nothing else is allowed (`service.ts:3070-3075`; the shipped wiring in `_shared/runtime.ts:79-80`).
- That suggestion is not tried, not applied, and the run does not continue (`service.ts:3110-3113`, `:3540`, `:3594`; the UI text at `FlowRunView.tsx:234`).
- A person approves and applies it with a PIN, then starts a new run (`demo-llm-adaptation-control.ts:47-64`).

What exists but cannot run in the shipped app:
- trying a fix on a copy of the automation (`live-patch.ts:174-200`);
- applying safe fixes automatically (`service.ts:3171-3245`);
- running again afterwards (`service.ts:3260-3290`).

The shipped app gives that path no AI connection (`_shared/runtime.ts:74-83`). Even if it had one, the rerun starts from the beginning rather than where it failed (`service.ts:3287`).

While running, the AI cannot add steps, change branching, or create sub-automations. Memory of past runs is built but switched off, per the LLM plan.

## Not verified

- **No behaviour ran.** Every statement comes from reading code. A Lab run would have to show the runtime lane making exactly two provider calls, saving a proposal with no retry, and a rerun after apply running from the Flow's start.
- **Line numbers may shift.** Core line numbers come from `F:\!FluxIQ`'s working tree, which holds another worker's uncommitted edits. Those edits probably touch start-node selection, so `executor/graph-run.ts` and `compiled-plan.ts` are most exposed.
- **Not read:**
  - the diagnosis response schema;
  - `transition-comparison.ts` beyond the category search;
  - the Flow-lane evidence packet's 16 items, and whether they feed the harness packet;
  - the web UI's adaptation review screens.
- **Possibly stale:** the LLM plan's Current State is dated 2026-09-10. Its live certifications are quoted, not re-observed.

## Open questions or contradictions found

1. Core `docs/architecture/automation-studio.md:311-314` says production allows the build grant only for `flow_bootstrap`. The code also allows `evidence_tool_decision` (`_shared/runtime.ts:77-78`). This is a small documentation gap.
2. The same page, at `:552-559` and `:569-572`, describes live patch testing, automatic promotion and training modes as current. It does not say that the production resolver gives them no provider without an explicit grant, or that explicit grants skip them (`_shared/runtime.ts:74-83`; `service.ts:3110`, `:3540`, `:3594`).
3. The 30-day plan's Phase 2.8 asks for resuming "from the most appropriate continuation point". Core's only retry reruns from the start (`service.ts:3287`), so Week 2 needs a resume design, not only enabling existing code.
4. `execution-grants.ts:504-510` lets a build grant reach runtime and structural patch tasks, but the shipped resolver narrows it. Whether that breadth is intended for the live adaptation phase is not recorded in what I read.
