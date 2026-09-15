# `w2-scope-context-recovery`: what exists and what is missing for MVP Phases 2.1-2.4

Read-only scoping across this repository and FluxIQ Core (`F:\!FluxIQ`). Paths
starting `packages/fluxiq/`, `packages/contracts/`, `apps/web/` or `docs/architecture/automation-studio.md`
are Core. Paths starting `domain/`, `apps/extension/`, `apps/scenario-lab/`, `packages/test-*`
are this repository. `AS` abbreviates Core's `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. None of the four phases' exit criteria is met today. Each phase has real, tested
building blocks, but the runtime path never puts them together into one loop.

- **2.1 context:** Core's harness packet already has slots for most of the MVP capture list.
  The single runtime caller fills only instructions, the recent-action list, a 3,000-byte
  web failure snapshot, and policy. Expected state, the state diff, subflow and router
  context, prior adaptations and recording context never reach the model.
- **2.2 diagnosis:** a deterministic failure classifier exists with an "is AI eligible"
  verdict, but it only decorates run summaries; nothing gates on it. The LLM
  "diagnosis" is a free-text summary. The patch request runs whether or not the diagnosis
  succeeded. There is no plan stage, and the web UI's trace stages are "LLM / Patch Test /
  Adaptation / Retry", not Diagnosis → Recovery Plan → Exploration → Resolution.
- **2.3 exploration:** at run time **there is no exploration loop at all**. The bounded
  evidence loop is wired only into Flow creation. Runtime "recovery" is one LLM patch,
  either replayed on a patched graph (not reachable in the shipped app) or saved as a
  proposal without running. Many individual bounds exist; none of the five required
  completion states exists as a closed vocabulary.
- **2.4 success detection:** Core compares an attempt with its expected transition and
  asks the web host to evaluate expected state. But the only "did recovery work" check,
  `runtimePatchRestoredExpectedState`, returns `true` when there is no comparison. When
  there is one, it accepts any attempt's route match or an empty expected-output list.
  By reading (not running) it, a patched run that merely succeeds counts as recovered.
  That breaks the phase's own principle.

Recommended order: take four decisions first (E2 target shape, E54 option, the grant
purpose for exploration, and the contract name). Then do one serial Core extraction out of
`service.ts`, because its baseline cannot grow. After that, the four phases split into
parallel new-file work in Core and here, followed by serial integration and Lab proof.

## Required reading done

`AGENTS.md` (both repositories); `MVP_AGENT_INSTRUCTIONS.md`; MVP plan lines 363-524
(Week 2 Objective, 2.0 sequencing, 2.1-2.4); Week 1 plan Current State (lines 14-91); Week 1
`open-questions.md`; `cb-blocker-ranking-final.md`; extraction plan D1-D10 (lines 94-129) and
its phase table (255-268); LLM plan Current State (lines 14-66); then the code below.

`open-questions.md` entries carry no E-numbers. I matched them by content to the archive
ledger's list (`archive/2026-09-12-finish-week1-ledger.md:3839-3851`):
- **E2** is OQ:54-69.
- **E54** is OQ:1285-1322, the D13 `destructive` rung entry.
- **E55** is OQ:1323-1364.
- **E56** is OQ:1365-1412, the corroboration predicate entry.

---

## Phase 2.1 — Standardize Adaptation Context

MVP exit criterion (MVP:429-431): the harness gets enough context to reason about the
failure without a developer stepping in.

### What exists

**Core harness packet.** `AS/runtime/llm/harness/context-packet.ts:20-50` defines these fields:
- `taskKind`, `projectId`, `flowId`, `runId`, `subflowId`, `nodeId`;
- `instructions`, `stateDiffs`, `routeHistory`, `recentActions`, `failureEvidence`;
- `relevantRuns`, `relevantAdaptations`, `reusableContext`;
- `subflows`, `availableActions`, `policyGates`.

`packAutomationStudioLlmContext` (`:64-102`) bounds them:
- stateDiffs 50, routeHistory the last 25, relevantRuns and relevantAdaptations 25 each,
  subflows and availableActions 100 each (`:88-96`);
- recentActions the last 12 (`:52`, `:90`). Each keeps only ids, status, route, duration,
  comparison status and failure *category* (`:139-153`);
- the reusable packet is capped at 5 items and 8,192 bytes, and cached executable targets are
  rejected (`:104-137`).

**Failure evidence.**
- `AS/runtime/llm/harness/failure-evidence.ts:6` caps it at 3,000 bytes.
- `:17-25` exposes it only to `runtime_diagnosis` and `runtime_patch`, and `:28` rejects
  html, snapshot, cookie and header keys.
- The intervention stores only its provenance: digest and byte count (`:47-55`;
  `harness/intervention.ts:30-38`).

**The runtime caller.** `AS/runtime/service.ts:2865-3169` (`maybeAnnotateRunDetailWithRuntimeLlm`):
- It picks the last failed attempt (`:2891`).
- It asks the domain for a fresh sanitized snapshot (`:2940-2985`). Downstream this is
  `domain/src/runtime/llm-evidence/tools.ts:172-203`, a `web.dom.capture_snapshot`
  sanitized under the `failure` budget, which equals Core's 3,000 (`llm-evidence/limits.ts:22-26`).
- The diagnosis call (`:3015-3038`) passes only instructions, `runDetail`, `failureEvidence`,
  `reusableContext`, `policy` and `nodeId`.
- A grep of Core `src` outside tests found `relevantRuns:`, `relevantAdaptations:`,
  `stateDiffs:`, `routeHistory:` and `availableActions:` **only** in `context-packet.ts`.
  No caller fills them. This matches LLM plan :42.

**State around each web action.**
- `domain/src/runtime/host-runtime.ts:82-119` captures sanitized before/after snapshot
  summaries per web node, and `:134-161` computes `web-state-diff.v1`.
- Core stores both on the attempt as `stateRefs` (`AS/runtime/executor/contracts.ts:131-135`)
  and copies them into run detail metadata (`AS/runtime/service/summaries/conversions.ts:168`).
- They are not put into the packet.

**Expected vs actual per attempt.**
- `AS/runtime/executor/transition-comparison.ts:38-87` and `expected-transition.ts:5-36`
  build it; it is stored on the trace.
- Run detail keeps only `comparisonStatus` and `diffSummary` (`conversions.ts:160,165`).

**Structured failure record.** `packages/contracts/src/failure/record.ts:27-40` holds
category, code, retryable, stage, and short `expected` and `actual` strings with a digest.
Only the category reaches the model (`context-packet.ts:141`).

**Security properties to preserve.**
- Saved traces carry `[withheld]` markers (`AS/runtime/live-patch.ts:46-51`;
  `executor/trace-withholding.ts`).
- Reusable context is off by default and not usable in production (LLM plan :36, :42).

**Name collision.** `AutomationStudioRuntimeAdaptationContext` (`service.ts:546-559`) is
training mode, policy and budget. It is not the MVP's "adaptation context".

**Tests.**
- Core: `AS/runtime/llm/tests/harness.test.ts:50` (packing), `:124` (category only), `:170`
  (failure evidence bounds and task restriction); `AS/runtime/tests/service.test.ts:713`
  (evidence captured once and reused, contents not persisted), `:801`, `:825`, `:851`.
- Downstream: `domain/src/runtime/llm-evidence/tests/{tools,limits,page-evidence,target-override}.test.ts`,
  `domain/src/runtime/tests/host-runtime.test.ts`.

**Lab coverage: none.**
- Week 1 runs provider-free (`packages/test-contracts/src/evaluation.ts:78-85`).
- `harnessActivations` is `interventions.length`, and "this must stay 0"
  (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:132-133,297`).
- The Week 2 metric keys must be null (`test-contracts/src/evaluation-validation.ts:11`;
  `test-runner/src/bench/comparison-details.ts:30`).
- `run`/`matrix` refuse live LLM (`test-runner/src/cli.ts:85`).
- Provider-backed adaptation exists only as manual `demo:llm:*` scripts (`package.json:25-41`).

### MVP capture list against what reaches the harness

| MVP item (MVP:406-421) | Where it exists | Reaches the model? |
| --- | --- | --- |
| Current browser state | domain failure snapshot, `tools.ts:172-203` | Yes, 3,000 B max |
| Expected state | `transitionComparison.expected`, `contracts.ts:25-40` | **No** |
| Previous browser state | `stateRefs.beforeAction` and `stateDiff`, `conversions.ts:168` | **No** |
| Current node | `nodeId`, `service.ts:3020` | Yes |
| Previous successful nodes | `recentActions`, last 12 with status | Partly |
| Current subflow | `subflowId` slot, `context-packet.ts:27` | **No**: the runtime call does not pass it |
| Router context | `routeDecisions` in run detail | **No** |
| Current URL | `location` inside the failure snapshot | Yes |
| Recent browser events | nothing found | **No** |
| Relevant DOM evidence | failure snapshot, 40 elements max (`limits.ts:30`) | Yes |
| Failed target | `attempt.targetResolution` (`contracts.ts:137`), metadata only | **No**; the snapshot does not mark which element was the target |
| Failed action | failed-action ids | Yes, ids only |
| Previous attempts | `recentActions`; `recoveryDecision` candidates not sent | Partly |
| Existing adaptations | `relevantAdaptations` slot unfilled; classifier matches computed without adaptations (`conversions.ts:142-149`) | **No** |
| Relevant recording context | nothing in the packet | **No** |
| Current automation objective | Flow instruction set, `service.ts:2926` | Yes |
| "Most relevant first" | reusable-context ranking, gated off | **No** in production |

Evidence it can be enough for one class: the certified selector-drift lane succeeded from the
failure snapshot alone (LLM plan :31-32). For W13's overlay, W24's interstitial or a
navigation failure, the missing expected state and state diff are the information needed.

### Recommended steps (partitioned by file)

1. **Core, new file** `AS/runtime/recovery/recovery-context.ts` (plus `index.ts`).
   - Use a new directory: `AS/runtime/` already holds 23 source files against the 25-file
     budget (Core `AGENTS.md:187`).
   - Name the contract to avoid `AutomationStudioRuntimeAdaptationContext`.
   - It builds one domain-neutral, bounded `recoveryContext` from the failed trace attempt,
     run detail (withheld copy), Flow, route decision, subflow, adaptations and recording ids.
   - Sections, in fixed priority: expected transition shape (route, output ids, expectedState
     conditions); actual status, route and the failure record's category, code, stage,
     `expected` and `actual`; `stateDiff`; failed-target resolution summary; last succeeded
     nodes; subflow and route decision; recovery-ladder candidates; matching adaptations
     (ids, status, risk); recording ids.
   - It drops the lowest-priority sections to fit a byte budget and records the dropped names.
   - Tests: `AS/runtime/recovery/tests/recovery-context.test.ts`.
   - Mutation targets: omit the expected section; reverse the priority order; remove the
     byte cap; read `failedAttempt.inputs` (live values) instead of run detail's withheld copy.
2. **Core** `AS/runtime/llm/harness/context-packet.ts` and `task-request.ts`.
   - Add a `recoveryContext` slot, restricted to runtime tasks like `failureEvidence` (`:91`).
   - Add section names and byte counts, never contents, to the intervention's
     `contextSummary` (`harness/intervention.ts:30-38`) so the Lab can assert them counts-only.
   - Tests: `AS/runtime/llm/tests/harness.test.ts`.
   - Mutation: expose `recoveryContext` to `flow_bootstrap`.
3. **Core** `AS/runtime/service.ts`. Do this after step R0 below.
   - Pass `recoveryContext` and `subflowId` into both harness calls (`:3015-3065`).
   - Test: extend `service.test.ts:713`.
4. **Downstream** `domain/src/runtime/llm-evidence/tools.ts:172-203`, `page-evidence.ts`
   and `sanitize.ts`.
   - Mark the failed target inside the failure snapshot as an opaque handle (`target.N`,
     already used by reveal, `tools.ts:41`), decided with E2.
   - Tests: `llm-evidence/tests/tools.test.ts`, `page-evidence.test.ts`.
   - Mutation: the packet exceeds 3,000 B; the marker leaks a literal selector when E2
     rules handles-only.
5. **Recent browser events: decide from the Lab.** Nothing captures them today. Adding an
   event log touches `apps/extension`. Recommend deferring it unless the W13/W24 diagnoses
   below show the state diff is not enough.

**Lab proof for 2.1.**
- In `deterministic-dry` mode, Core's dry run records an intervention without calling a
  provider (`harness/run.ts:96-107`).
- Run W13 `banner-absent` and W24 `unannounced` on the Flow lane and assert that each
  required section's name and byte count is present and the total is under the cap.
- Keep W20-W23 at zero interventions as the deterministic-first guard.

Files:
- `packages/test-contracts/src/evaluation.ts` and `evaluation-validation.ts`: new counts-only field;
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`: read `contextSummary`;
- `packages/test-runner/src/bench/evaluate-run.ts`.

**Ownership.** Core: steps 1-3. Here: steps 4-5 and the Lab.

---

## Phase 2.2 — Separate Diagnosis From Exploration

MVP exit criterion (MVP:460-464): traces clearly distinguish Diagnosis → Recovery Plan →
Exploration → Resolution.

### What exists

**Deterministic Stage A, built but unused as a gate.**
`AS/runtime/adaptive-orchestrator.ts:65-101` computes:
- the failure class (`:121-139`);
- the candidate kind (`:141-169`), exhaustive;
- deterministic recovery candidates (`:177-179`);
- known adaptation matches (`:181-199`);
- `llmEligibility` (`:201-212`): no LLM when a deterministic path or a validated or applied
  adaptation exists, and no LLM for policy, auth, user-intervention or graph failures.

It is tested in `AS/runtime/tests/adaptive-orchestrator.test.ts:133-144`.

Its only non-test call site is `AS/runtime/service/summaries/conversions.ts:142-149`. That
call passes no adaptations or recovery attempts, so `knownAdaptationMatches` is always empty
there. `service.ts:91` imports the classifier, but grep found no call in `service.ts`.

**What gates the LLM instead.** `service.ts:2876-2890` checks run failed,
`behavior.invokeLlm`, and budget.

**The ladder.** `AS/runtime/executor/recovery-ladder.ts:5-73` ranks candidates: deterministic
edge 1, approved patch 2, reroute 3, `llm_diagnosis` 4. `executor/graph-run.ts:206-219`
records the decision on the attempt and stops the run unless the deterministic edge was
chosen. There is no "known persisted adaptation" rung, although MVP instructions §9
(`MVP_AGENT_INSTRUCTIONS.md:393-398`) put it second.
- Tests: `executor/tests/recovery-ladder.test.ts:53-96`.

**LLM Stage A output.** `harness/structured-response.ts:9` is
`{ kind: "diagnosis"; summary; confidence? }`. None of MVP:445-450's questions (expected,
happened, changed, still achievable, deterministic possible, AI needed) is a structured field.

**No Stage B.** The patch call (`service.ts:3039-3065`) runs whenever a provider, the runtime
Flow, a failed trace attempt and `createAdaptations` are present. It does **not** depend on
`result.ok` or on the diagnosis content. Both calls share one budget (`service.test.ts:1170`).

**Stage C at run time is not exploration.**
- `executeAutomationStudioRuntimePatch` replays a patched graph for at most 50 steps
  (`live-patch.ts:174-200`).
- The shipped `diagnose_and_adapt` lane saves one target override as a proposal and never
  runs it (`service.ts:3070-3113`; Core `docs/architecture/automation-studio.md:619-631`).

**Trace today.**
- Interventions have kind `diagnosis | runtime_patch | …` (`AS/model/flow-adaptation.ts:248-255`).
- Run detail metadata carries `llmGate` and `runtimePatchAttempts` (`service.ts:3151-3162`).
- The web UI maps them to stages "LLM", "Patch Test", "Adaptation" and "Retry"
  (`apps/web/src/features/automation-studio/runtime/run-detail-model.ts:115,127,135,144`).
- Nothing records a plan, exploration steps, or a resolution.

**Week 1 carry-over.** W2-3, W13 `banner-absent`, fails 6/6 as `runtime.behavior`. Its owner
is "Core failure-route and node-policy owner, plus downstream mapping"
(`cb-blocker-ranking-final.md:105`). A blocking overlay is exactly the case where Stage A
must say "page changed; deterministic recovery cannot; exploration needed".

### Recommended steps

- **R0, Core, serial prerequisite:** move `maybeAnnotateRunDetailWithRuntimeLlm`
  (`service.ts:2865-3169`) into `AS/runtime/recovery/runtime-recovery-coordinator.ts`.
  - The baseline freezes `service.ts` at 6,807 lines and `AutomationStudioService` at 223
    methods (`F:\!FluxIQ\.structure-baseline.json:21,87`). Entries "may shrink but never
    grow" (Core `AGENTS.md:199-201`), so every later edit there must be offset.
  - The move gives 2.1-2.4 one home and lowers both baselines.
  - No behavior change. Existing `service.test.ts:659-1431` must pass unchanged.
- **Core, new file** `AS/runtime/recovery/diagnosis.ts`: deterministic Stage A.
  - Calls `classifyAutomationStudioAdaptiveFailure` with the run's real adaptations and
    recovery attempts.
  - Returns a diagnosis record: failure class, candidate kind, deterministic recovery
    available, known adaptation available, still achievable (`false` for `auth_required`
    and `user_intervention_required`), and whether the LLM is needed.
  - The coordinator calls no provider when the LLM is not needed.
  - Tests: `AS/runtime/recovery/tests/diagnosis.test.ts`.
  - Mutation: ignore `knownAdaptationAvailable`; mark `auth_required` achievable.
- **Core** `AS/runtime/llm/harness/structured-response.ts:9`, `harness/provider-result.ts`,
  and the diagnosis schema in `runtime/llm/deepseek-provider.ts`.
  - Structured diagnosis: `expected`, `observed`, `changed` (bounded strings);
    `stillAchievable` and `deterministicRecoveryPossible` as yes/no/unknown;
    `explorationNeeded` (boolean); `confidence`.
  - Tests: `llm/tests/harness.test.ts`, `deepseek-provider.test.ts`.
  - Mutation: accept a diagnosis without `explorationNeeded`.
- **Core, new file** `AS/runtime/recovery/recovery-plan.ts`: Stage B.
  - A bounded plan made from the diagnosis and the policy: candidate kind, allowed tool or
    patch kinds, the budget slice (2.3), and success checks (2.4).
  - Deterministic by default. An LLM refinement stays optional and inside the same budget.
  - Tests plus mutation: a plan that allows a patch kind the policy forbids
    (`live-patch.ts:70-75` is today's policy list).
- **Core, new file** `AS/runtime/recovery/recovery-trace.ts`.
  - Closed stage vocabulary `diagnosis | recovery_plan | exploration | resolution`, as
    ordered, content-free events stored additively as run detail `metadata.recoveryTrace`.
  - Rejects an `exploration` event with no earlier `recovery_plan`.
  - Mutation: allow that out-of-order event; drop `resolution` on a failed exploration.
- **Core** coordinator (from R0). Order: diagnosis → plan → patch or exploration only when
  the plan allows it. Remove the unconditional patch call.
  - Test: a failed diagnosis sends no patch request, counted with the existing fake provider.
- **Core web UI** `apps/web/src/features/automation-studio/runtime/run-detail-model.ts:108-151`
  and `RunDetailPanels.tsx`.
  - Render the four stages from `recoveryTrace`.
  - Tests: `runtime/tests/runtime-views.test.tsx`.
- **Downstream, read-only investigation first.** Why W13 `banner-absent` and W24
  `unannounced` report `runtime.behavior` rather than a classified failure. Candidates:
  - `domain/src/runtime/failure/classify.ts`, `codes.ts`;
  - `domain/src/runtime/expectation/evaluate.ts`;
  - `domain/src/recording/reducers.ts`, where the mapper turns `web.dom.assert` into expected state.

  Stage A cannot diagnose a failure the domain does not classify.

**Lab proof for 2.2.**
- Flow-lane observation reads the `recoveryTrace` stage order.
- In `deterministic-dry`, W13 and W24 show `diagnosis → recovery_plan` and stop cleanly.
- W20-W23 show no recovery trace (fallback, harness 0).
- W14/W19/W27 required negatives stay classified 15/15.

Files: `test-contracts/src/evaluation.ts` (+ validation), `test-runner/src/flow-lane/persisted-flow-run.ts`,
`test-runner/src/bench/evaluate-run.ts`.

**Ownership.** Core: R0, diagnosis, plan, trace, schema, UI. Here: the classification
investigation and fixes, and the Lab.

---

## Phase 2.3 — Bounded Harness Exploration

MVP exit criterion (MVP:496-498): the harness cannot enter indefinite reasoning or execution loops.

### What exists, bound by bound (MVP:476-484)

| Limit | Existing mechanism | Runtime path uses it? |
| --- | --- | --- |
| Max exploration actions | Evidence loop `maxToolCalls` ≤16, `maxIterations` ≤16 (`runtime/llm/evidence-loop.ts:4-8,269-283`). Patch replay `maxSteps` ≤50 (`live-patch.ts:183`). | Loop: creation only (`service.ts:1914`). Replay: yes, but unreachable in the shipped app |
| Max LLM turns | `AutomationStudioLlmRunBudgetLedger.maxCallsPerRun` (`runtime/llm/run-budget.ts:77-79`). Grant `diagnose_and_adapt` is exactly 2 calls (`llm/execution-grants.ts:105-108`). Run-level cap at `service.ts:2930-2937`. Ladder `maxAdaptationOrLlmAttemptsPerRun` (`executor/recovery-budget.ts:21`). | Yes |
| Token / cost budget | Ledger total, output and cost (`run-budget.ts:80-86`). Request ceiling (`harness/run.ts:80-86`). Per-run cost default 0.25 (`service.ts:2995-2997`). Training budgets (`runtime/training-modes.ts:42-46,260-263`). | Yes |
| Max execution duration | Per provider call: 20 s default, 45 s maximum (`llm/provider-contract.ts:34-35`; `harness/run.ts:179-195`). Nested-flow `deadlineAt` (`executor/contracts.ts:161-162`). | Per call only. **No whole-recovery wall-clock bound found** |
| Allowed domains / cross-domain navigation | Downstream navigate tool refuses cross-origin and no-progress (`domain/src/runtime/llm-evidence/tools.ts:141-143`). Explicit-grant runs force `authorizedDomainIds` empty (`service.ts:3367,3430`). | Authoring tools only. No allowlist configuration |
| Destructive actions | No fill, select or submit tools (`tools.ts:7-9`). Reveal only through `safeRevealElement` (`:155-161`). Policy `allowExternalSideEffects` and approval flags (`AS/model/flow-adaptation.ts:383-385`; `live-patch.ts:70-72,340-342`). Node `metadata.destructive` (`executor/node-execution.ts:179-180`). | Policy preflight only. E54 open |
| Retry count | `maxRetriesPerAction` (`recovery-budget.ts:18`) | Yes, ladder |
| Repeated unsuccessful patterns | Loop `duplicate_tool_request` and `repeat_without_progress` (`evidence-loop.ts:150-155,170-185`). Domain `no_progress` (`tools.ts:143,162`). | Creation only |
| One adaptive run at a time | `service.ts:3403-3415` | Yes |

**Completion states (MVP:488-494): none exists as a closed vocabulary.** Today's endings are:
- evidence-loop failure codes (`evidence-loop.ts:47-57`);
- run-budget diagnostics (`run-budget.ts:19`);
- a free-text ladder message (`recovery-budget.ts:33`; `recovery-ladder.ts:75-79`);
- `llmGate.invoked` and `llmGate.ok` (`service.ts:3153-3161`).

`user_intervention_required` exists only as a failure category
(`packages/contracts/src/failure/record.ts:28`; `executor/transition-comparison.ts:30`).

**Tests.** `llm/tests/evidence-loop.test.ts:21,43,54`, `run-budget.test.ts`,
`execution-grants.test.ts:191-203`, `harness.test.ts:332`; downstream
`llm-evidence/tests/tools.test.ts`.

**Lab coverage: none.** `deterministic-dry` cannot drive a loop, because a dry run returns
before any provider decision (`harness/run.ts:96-107`), and live is refused (`cli.ts:85`).

### Carry-overs

- **E54** (OQ:1285-1322). D13 lets a candidate missing only an identifier clear Core's
  `destructive` fingerprint rung (0.9). It is ruled out of Week 1 only because Core's
  element-target floor is inert for web. Exploration that clicks makes that gate live.
  Recommendation, to record as a decision: option 3, requiring a second agreeing signal.
  Separately, exploration's destructive refusal should be semantic (control role and type,
  submit, delete-like), not a similarity score.
- **E56** (OQ:1365-1412). The corroboration predicate (`apps/extension/src/content/identity/corroboration.ts:46,67`)
  refuses matches that no distinguishing recorded signal agrees with. A harness-proposed
  target must pass through the same resolver path, not around it. The user has still not
  explicitly accepted design A.
- **LLM plan :47.** Generic submit is deliberately blocked because nothing distinguishes a
  local fixture submit from a real side effect. That still holds at run time.

### Recommended steps

1. **Core, new file** `AS/runtime/recovery/exploration-outcome.ts`.
   - Closed `RECOVERED | FAILED | USER_INTERVENTION_REQUIRED | BUDGET_EXHAUSTED | UNSAFE_ACTION_BLOCKED`.
   - An exhaustive typed `Record` from every loop failure code, run-budget code,
     recovery-budget exhaustion, provider timeout or abort, and failure category to one outcome,
     in the style of `transition-comparison.ts:14-31`, so an unmapped code fails the type check.
   - Tests plus mutation: map `llm_evidence_loop.iteration_limit` to `FAILED`; map
     `auth_required` to `FAILED`.
2. **Core, new file** `AS/runtime/recovery/exploration-budget.ts`. It composes, rather than
   duplicates, the ledger (`run-budget.ts`), loop limits and recovery budget, and adds:
   - a wall-clock `maxDurationMs`, enforced by an `AbortController` that ends in `BUDGET_EXHAUSTED`;
   - `maxActions`;
   - a domain-neutral navigation scope policy (for example `same_scope | allowlist` plus opaque
     scope strings), enforced by the domain because origins are a browser concept (MVP
     instructions §1, `MVP_AGENT_INSTRUCTIONS.md:46-48`);
   - `allowDestructive: false` by default;
   - a repeated-pattern window.

   Tests plus mutation: remove the deadline; let `maxActions` count only successful actions.
3. **Core, new file** `AS/runtime/recovery/runtime-exploration.ts`.
   - Runs `runAutomationStudioLlmEvidenceLoop` (`evidence-loop.ts:109`) under the budget.
   - Its `complete` result is accepted only when the 2.4 verdict says resumable; otherwise
     it continues or ends with an outcome.
   - It always returns exactly one outcome and emits `exploration` and `resolution` trace events.
   - Tests use a scripted fake provider: a loop that repeats the same tool, a loop exceeding
     `maxActions`, a hung provider hitting the deadline, a destructive tool request, and a
     cross-scope navigation.
   - Mutation: skip the terminal outcome on abort.
4. **Core** `AS/runtime/llm/harness/task-kind.ts:4-27` and `deepseek-provider.ts`: a runtime
   exploration decision task kind and prompt version. The existing
   `evidence_tool_decision` is tied to `flowBootstrap` context (`harness/run.ts:38-43,71`).
   Share this file with the 2.2 schema work in one serial worker.
5. **Core** `AS/runtime/llm/execution-grants.ts:23,105-108,478,500`: a grant purpose, or call
   count, that permits exploration. **Decision needed**: this is an authorization boundary,
   so Core docs `docs/architecture/automation-studio.md:606-650` must be updated with it.
6. **Downstream, new file** `domain/src/runtime/llm-evidence/recovery-tools.ts`, plus
   `vocabulary.ts` for tool ids and result codes. Keep `tools.ts` for authoring.
   - Runtime tools: inspect and reveal (reuse); `dismiss_overlay` or `click_safe` limited to
     non-submit, non-destructive, corroborated controls (reuse `safeRevealElement` and
     `actionableEvidenceElement`); a bounded `wait_for_change`; navigation within the Core
     scope policy.
   - A refusal returns `unsafe_action_blocked`, which step 1 maps.
   - Tests: `llm-evidence/tests/recovery-tools.test.ts`.
   - Mutation: allow `type=submit`; allow cross-origin; skip corroboration.
7. **Here, Lab.**
   - A scripted provider profile: a new mode in `test-contracts/src/evaluation.ts:78`, and a
     loopback provider in `test-runner/src/` (a new directory), that replays fixed decision
     scripts provider-free.
   - A new fixture in `apps/scenario-lab/src/scenarios/<exploration-traps>/manifest.ts`: a
     cross-origin link, a destructive "Delete" beside the correct control, a reappearing
     modal, and a slow page.
   - Assert each script ends in its expected outcome within the wall-clock bound, with action
     and call counts at or under the budget.
   - **Not verified:** how the downstream web-panel host supplies Core's provider resolver
     for Lab runs (`automation-studio.md:608-612`). Read that seam before briefing.

**Lab proof for 2.3.** Every trap script terminates with the named outcome in all
repeats. The comparator gets tolerance rows for the loop counts.

**Ownership.** Core: steps 1-5. Here: steps 6-7.

---

## Phase 2.4 — Recovery Success Detection

MVP exit criterion (MVP:522-524): FluxIQ can confidently tell whether normal deterministic
execution can resume.

### What exists

**Per-attempt comparison.** `executor/transition-comparison.ts:38-87` checks outputs,
effects, route, status and host-evaluated expected state. For a succeeded attempt with
expectedState, `:99-137` asks the host and fails the attempt on rejection.
- The downstream evaluator is bound through `domain/src/runtime/host-runtime.ts:117`, with
  logic in `domain/src/runtime/expectation/{evaluate,conditions,click-landing}.ts`.
- Tests: `executor/tests/transition-comparison.test.ts`; `domain/src/runtime/expectation/tests/*`.

**The "recovered" check.** `live-patch.ts:324-330` `runtimePatchRestoredExpectedState`:
- returns false unless `trace.status === "succeeded"`;
- returns **true when there is no comparison**;
- returns true when **any** attempt's route equals `expected.expectedRoute`;
- otherwise returns true when every expected output id appears. An empty list passes.

**Suspected defect, found by reading, not executed.**
- The comparison passed in is the failed attempt's own (`service.ts:3098`).
- `expected-transition.ts:11-19` sets `expectedRoute` to `"failed"` for a failed ordinary
  action node with no declared route.
- So `restoredExpectedState` is true for a succeeded patched trace that contains any attempt
  routed `failed`.
- Otherwise it falls through to an expected-output list that is usually empty, and passes.

In effect, any succeeded patched run counts as recovered. Expected state is still enforced
inside the replay when a node declares it, because `live-patch.ts:180` forwards the host
runtime.

**Continuation.**
- The retry runs only after an **auto-applied** patch (`service.ts:3260-3271`). The shipped
  app never produces one (`automation-studio.md:632-635`).
- It reruns the Flow from its start, not from the failure point (`service.ts:3287`;
  `automation-studio.md:646-650`).
- `startNodeId` exists as an option (`executor/contracts.ts:154`).

**Adaptation status.** `live-patch.ts:228` marks an adaptation `validated` straight from
`restoredExpectedState`. The defect therefore also reaches Phase 2.6, the other brief.

**Tests.** `AS/runtime/tests/live-patch.test.ts` exists; it was not read, so whether it pins
the no-comparison case is unknown.

**Lab coverage: none.** `harnessRecovery` is a reserved null
(`test-contracts/src/evaluation.ts:139`; `evaluation-validation.ts:11`).

### Against "Validate Against" (MVP:514-520)

| Check | Exists | Used to decide recovery? |
| --- | --- | --- |
| Expected browser state | Host evaluator, `transition-comparison.ts:99-137` | Only indirectly, through the patched trace's status |
| Expected output | `expectedOutputs` ids | Yes, but an empty list passes |
| Expected URL/navigation | Web conditions (the condition list in `conditions.ts` was not read) | No |
| Required evidence | Nothing distinct from expected state | No |
| Router continuation requirements | Route decisions exist; no "next node can start" check | No |
| Extracted-record completeness | Extraction D4 (`minItems` defaults to 1; zero fails as `output_not_observed`), D5 (`timed_out` with counts), D9 (`records` port) | Not yet: lands with X4 |

### Carry-overs and interactions

- **W2-1**, W24 `unannounced` (`cb-blocker-ranking-final.md:103`; Week 1 plan :389-390). It
  fails 6/6 as `runtime.behavior` instead of `output_not_observed`. This is the canonical
  "action succeeded, recovery did not" case, and it needs a correct classification first.
- **Extraction X4 before 2.4** (extraction plan D1 :96-98; MVP :386-388). The verdict's
  output check must read the records completeness signal. Build the verdict with a
  records-check interface and a synthetic test now, then wire the real signal after X4.
  X6 (:265) brings drift variants W04/W08 through adaptation later.
- **E2** (OQ:54-69). The target shape is a single `{selector}`:
  - `live-patch.ts:58-61`; `harness/structured-response.ts:14-16,25-28`;
  - downstream `tools.ts:91`, `target-override.ts:18-33`.

  Decide it before 2.1's context contract and 2.4's target identity check freeze. Extract
  item and field targets must be expressible (OQ:68-69).
- **E56's measurement caveat** (OQ:1394-1400). Every manifest fact resolves by `data-testid`.
  That is fine for the Lab's own oracle, but exploration evidence and the verdict must not
  depend on test ids.

### Recommended steps

1. **Core, new file** `AS/runtime/recovery/recovery-verdict.ts`:
   `decideAutomationStudioRecoveryVerdict`.
   - Inputs: the failed node's own expected transition, derived from the node definition and
     not the failed attempt; host evaluation after recovery; expected outputs including a
     records completeness result; required evidence conditions; the continuation (next node,
     route, subflow).
   - Output: `resumable`, `resumeFrom` (`{nodeId, route}` or null), and per-check status
     `passed | failed | not_applicable | unknown`.
   - An `unknown` required check means not resumable. Action success alone never passes.
   - Tests: `AS/runtime/recovery/tests/recovery-verdict.test.ts`.
   - Mutation targets: restore `if (!comparison) return true`; accept a route match from an
     unrelated attempt; treat `not_applicable` as passed for a required check; ignore records
     completeness.
2. **Core** `AS/runtime/live-patch.ts:185-187,324-330`. Replace
   `runtimePatchRestoredExpectedState` with the verdict. **First add a failing test** in
   `runtime/tests/live-patch.test.ts` reproducing the suspected defect: a succeeded patched
   trace with no expected outputs and a routed-`failed` attempt currently reports restored.
3. **Core** `AS/runtime/executor/expected-transition.ts:11-19`.
   - Give the verdict an expected transition that does not inherit `"failed"` from the
     failed attempt, through a node-definition-only variant.
   - Test in `executor/tests/`; mutation: pass the failed attempt again.
4. **Downstream** `domain/src/runtime/expectation/conditions.ts` and `evaluate.ts`.
   - Confirm or add URL/navigation and element-presence "required evidence" conditions the
     verdict can request.
   - Tests: `expectation/tests/conditions.test.ts`, `evaluate.test.ts`.
5. **Downstream W2-1 fix.** After the 2.2 investigation, make W24 `unannounced` report
   `output_not_observed`. Files are decided by that investigation.
6. **Continuation, shared with 2.8.** The verdict's `resumeFrom` feeds `startNodeId`. Resuming
   is 2.8's scope (`w2-scope-repair-reuse`); 2.4 only guarantees the verdict is correct.

**Lab proof for 2.4.**
- A counts-only verdict observation on the Flow lane.
- Negatives that must be **not resumable**:
  - W24 `unannounced`;
  - W13 `banner-absent` before dismissal;
  - W19 `expired` (click landing lost);
  - after X4, an extraction under-read: W05 `short-catalog`, or `admin-console`'s
    virtualised list (E55 defect 1).
- Positives: a scripted recovery on W13 (dismiss, then verdict resumable).
- Populate `harnessRecovery` from the verdict. Add comparator tolerance rows
  (`bench/comparison-details.ts:30`). Plan a new baseline pair, as extraction D7 does.

**Ownership.** Core: steps 1-3. Here: steps 4-5 and the Lab.

---

## Execution partition and sequencing

**Decisions before code** (supervisor, acting on recommendations):
- E2 target shape, recommended: fingerprint plus opaque `target.N` handles, covering extract targets;
- E54 option, recommended: option 3;
- the exploration grant purpose and its call count;
- the new contract name (`recoveryContext` / `runtime/recovery/`).

**Serial Core chain.** `AS/runtime/service.ts` is one file with a frozen baseline, so its
edits run one after another: R0 extraction → 2.1 step 3 → coordinator integration for
2.2, 2.3 and 2.4.

**Serial Core LLM-contract worker.** It owns `context-packet.ts`, `task-request.ts`,
`task-kind.ts`, `structured-response.ts`, `provider-result.ts`, `deepseek-provider.ts`,
`intervention.ts` and `execution-grants.ts`, covering the 2.1, 2.2 and 2.3 schema changes.

**Parallel after R0, one new file each:**
- Core `runtime/recovery/`: `recovery-context.ts`, `diagnosis.ts`, `recovery-plan.ts`,
  `recovery-trace.ts`, `exploration-outcome.ts`, `exploration-budget.ts`,
  `recovery-verdict.ts`. Only the directory `index.ts` is shared; the integrator should own it.
- Core `live-patch.ts` and `expected-transition.ts` (the 2.4 fix).
- Downstream `recovery-tools.ts`.
- Downstream expectation conditions.
- The downstream W13/W24 classification investigation (read-only).
- Core web UI `run-detail-model.ts`.

**Serial Lab chain.** It owns `packages/test-contracts/src/evaluation.ts` and its validation,
`test-runner/src/flow-lane/persisted-flow-run.ts`, `bench/evaluate-run.ts` and
`bench/comparison-details.ts`. The git status snapshot shows extraction work already
modifying `test-contracts/src/{scenario,validation}.ts` and `test-runner/src/flow-lane/*`,
and extraction X5 owns Lab measurement. Queue loop Lab edits behind X5's files or partition
them explicitly.

**Contention with extraction in Core.** X2 (Core datasets K2-K6: run detail, capture) runs
beside 2.1-2.3 (D1). If K work edits `service.ts` or run detail conversion, it conflicts with
R0. Check the K briefs' file lists before dispatching R0.

**A metric to change deliberately.** `harnessActivation` is lower-is-better
(`test-contracts/src/bench-report.ts:169`). Fallback recovery counts only runs with zero
harness activations (`test-runner/src/bench/aggregate-report.ts:106`). Week 2 loop lanes
activate the harness on purpose, so they must be a separate lane or variant class. Otherwise
Week 1's criteria read them as regressions.

## What changed and why

Only this report was written. No source, working document, build, test suite, Lab run or
web panel was touched.

## Commands run and observed results

- **PowerShell `Get-ChildItem` listings** (read-only) of:
  - Core `AS/` directories;
  - `AS/runtime/{llm,executor,service/adaptations,service/evidence,service/proposals}`, `AS/learning`;
  - `AS/runtime` top level and its `tests`;
  - downstream `domain/src/runtime` and `domain/src`.

  They printed the file lists used above.
- **Line counts were not used.** The `Measure-Object -Line` counts I took skip blank lines,
  so they understate files: `service.ts` reported 6,475, while lines past 6,700 were read.
  Line numbers above come from the Read and Grep tools.
- **Grep and Read** over the files cited. No command printed or read `.fluxiq` contents,
  tokens or recorded page data.

## Not verified

- **Nothing was executed.** The `runtimePatchRestoredExpectedState` defect is inferred from
  reading `live-patch.ts:324-330`, `expected-transition.ts:11-19` and `service.ts:3098`. It
  needs the failing test in 2.4 step 2.
- **Files not read:**
  - `AS/runtime/tests/live-patch.test.ts`;
  - `AS/runtime/executor/node-execution.ts` beyond `:179-180`;
  - the shape of `AutomationNodeTargetResolution`;
  - `conversions.ts` past `:169`, so where `adaptiveFailure` lands in the record is unknown;
  - `domain/src/runtime/expectation/conditions.ts`, so which URL and evidence conditions exist is unknown;
  - `domain/src/runtime/failure/*`;
  - the recording reducers.
- **Core structure methodology.** `docs/architecture/code-structure.md` was not read. The
  proposed `AS/runtime/recovery/` placement must be checked against it, and against
  whether an existing directory such as `runtime/service/adaptations/` is the correct owner.
- **The provider-resolver seam.** How the downstream web-panel host supplies Core's provider
  resolver, which the Lab's scripted provider needs.
- **Extraction Core footprint.** Whether extraction's Core K2-K6 work touches `service.ts`.
- **Why the classifier import exists.** Whether `service.ts:91` uses the classifier without
  a call expression; grep found no call.
- **E54's "B.3".** Referenced at OQ:1322; not defined in any document read.
- **Live behavior.** No live browser, Lab or provider behavior was observed.

## Open questions or contradictions found

1. **Two meanings of "adaptation context".** Core's `AutomationStudioRuntimeAdaptationContext`
   (`service.ts:546-559`) is policy, training mode and budget. The MVP's is the harness
   context package. A new contract needs a distinct name.
2. **The classifier is not a gate.** The deterministic "is AI eligible" classifier exists and
   is tested, yet the runtime LLM gate ignores it (`service.ts:2876-2890`). That contradicts
   the deterministic-first rule (`MVP_AGENT_INSTRUCTIONS.md:391-408`) today, whenever a
   training window enables the LLM.
3. **The shipped app never executes a runtime patch.** 2.4's verdict has no live consumer
   until Phases 2.6 and 2.8 change that. The two scoping reports must agree on who wires it.
4. **Browser concepts in a Core limit.** MVP 2.3's "allowed domains / cross-domain
   navigation" are browser concepts. To stay domain-neutral, Core should carry an opaque
   scope policy that the domain enforces.
5. **No Lab mode can prove 2.3.** `deterministic-dry` stops before any decision and live is
   fail-closed. A scripted provider is new Lab infrastructure, and an owner is needed.
6. **E56 design A is still not accepted.** The user has not accepted it, and exploration
   will rely on it.
7. **Week 1 metrics will misread loop lanes.** Harness activations are lower-is-better, and
   fallback requires zero activations. The Week 2 lanes need a distinct class before the
   first loop campaign.
