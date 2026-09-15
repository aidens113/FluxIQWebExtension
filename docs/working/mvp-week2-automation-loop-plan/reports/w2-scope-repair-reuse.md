# `w2-scope-repair-reuse`: what exists and what is missing for MVP Phases 2.5-2.9

Read-only scoping. Paths are shortened as follows:

- **Core AS** = `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`
- **Here** = `F:\!FluxIQWebExtension\`

## Outcome

Done. Every exit criterion of Phases 2.5-2.9 is mapped below to the code that exists and what is missing, with file:line references and recommended steps split by file.

### The short version

**What Core can already do.** Core can:

- take one LLM-proposed "runtime patch" and test it on a patched copy of the Flow, starting at the failed node;
- save the tested patch as an adaptation record;
- apply it automatically, but only when it is low-risk and changes no structure;
- write it into the Flow graph durably, with rollback;
- rerun the failed run once.

One Core unit test proves this whole chain on a toy node with a mock provider (`Core AS\runtime\tests\service.test.ts:1501-1596`). The second run in that test makes zero LLM calls.

**What the shipped app actually does.** Almost none of that chain runs. Core's own document says so (`F:\!FluxIQ\docs\architecture\automation-studio.md:606-650`):

- The only runtime lane that reaches a model is `diagnose_and_adapt`.
- That lane saves one never-executed, high-risk target-override proposal.
- A person applies the proposal through the PIN review.
- The run does not continue afterwards.

**What the Testing Lab measures.**

- Live DeepSeek demo commands prove a manual apply followed by a zero-LLM replay on `instruction-only-form`.
- FluxBench has no adaptation lane and no provider-free way to drive an adaptation.
- All five of its Week 2 metrics are typed `null`.

### The five largest gaps

1. **Nothing reduces an exploration into a minimal path (2.5).**
   - At runtime, "exploration" is a single LLM response containing patches.
   - No patch kind can create action nodes.
   - A persisted `edit_recovery` action sequence has no reader anywhere in Core, so it would be "applied" and never run.
2. **Confidence is not tiered (2.6).**
   - A never-executed proposal is recorded as a *successful* validation, and it passes the apply gate.
   - The `testing` status has no consumer.
3. **Resume is really a restart (2.8).** The run reruns from the graph's start, the retry is unreachable in the shipped app, and manual-review adaptations never continue.
4. **Nothing records that a learned adaptation was used on a later run (2.9), and FluxBench cannot measure adaptation.**
5. **The persisted target is selector-only (E2), and extract-list targets are rejected outright (X6).**

---

## Phase-by-phase mapping

### Phase 2.5 — Convert exploration into reusable automation

**Exit criterion:** "A successful AI recovery produces a meaningful automation modification rather than merely an execution transcript."

#### Exists

- **Runtime patch vocabulary.** Five temporary patch kinds (`Core AS\runtime\llm\harness\structured-response.ts:18-23`): action sequence, wait/retry, target override, recovery Subflow call, reroute.
- **Patch-to-durable-change conversion** (`Core AS\runtime\live-patch.ts:332-338`):

  | Temporary patch | Durable change |
  | --- | --- |
  | reroute | `edit_router` |
  | target override | `edit_action_target`, with `after: {selector}` |
  | wait/retry | `edit_expectation`, carrying `{timeoutMs, retryCount}` only |
  | action sequence | `edit_recovery`, carrying `{actionDefinitionIds}` |
  | recovery Subflow call | `edit_recovery`, with no `after` |

- **Adaptation record.** `Core AS\model\flow-adaptation.ts:336-360` declares provenance fields: `sourceRunId`, `trigger`, `observedState`, `expectedState`, `failedAction`, `diagnosis`, `patch`, `validationResults`, `appliedTo`, `status`, `author`, `riskLevel`, `proposalId`. `adaptationFromRuntimePatch` (`live-patch.ts:202-239`) fills `sourceRunId`, `trigger`, `failedAction`, `diagnosis`, `patch`, and `validationResults`.
- **Typed storage.** Migration 0009 (`Core AS\storage\project\schema\adaptations.ts:5-62`) adds base revisions, `patch_digest`, `evidence_digest`, an artifacts table, and audit events.
- **Creation-side analogue.** Evidence-tool exploration becomes a Flow Bootstrap plan (`Core AS\runtime\flow-bootstrap\adaptation.ts`; `llm-production-automation-plan.md` Current State, line 30). This path exists for Flow creation only.
- **Tests.**
  - `Core AS\runtime\tests\live-patch.test.ts:7-306`: 13 cases, including "turns successful structural patches into adaptation and change proposal candidates" at :306.
  - `service.test.ts:1209`, `:1383`.

#### Missing against the exit criterion

1. **Steps 1-5 (analyse the trajectory; remove failed and redundant actions; produce the minimum path).**
   - There is no runtime trajectory to reduce. The runtime lane asks for one `runtime_patch` response (`Core AS\runtime\service.ts:3041-3069`).
   - The multi-step evidence harness runs only for creation.
   - A search for trajectory or minimisation code in `F:\!FluxIQ\packages` found no files.
   - This depends on Phase 2.3's exploration trace (sibling report `w2-scope-context-recovery`).
2. **Step 6 (generate action nodes).** No patch kind inserts action nodes.
   - `temporary_action_sequence` becomes `edit_recovery {actionDefinitionIds}`, which is written into `node.parameterValues.recovery` (`Core AS\runtime\service\adaptations\patches.ts:52-55`, the only occurrence in Core `src`).
   - Nothing in Core reads `parameterValues.recovery`. The recovery ladder only considers `builtin.policy.recovery` nodes (`Core AS\runtime\executor\recovery-ladder.ts:41-53`).
   - `approvedRuntimePatchNodeIds` is declared (`executor\contracts.ts:184`) and read (`recovery-ladder.ts:27`), but nothing outside tests produces it.
   - `create_subflow` creates an empty Subflow with only a name (`patches.ts:207-248`).
3. **Steps 7-8 (input and output state expectations).**
   - `edit_expectation` carries only `timeoutMs` and `retryCount` (`live-patch.ts:336`).
   - `observedState` and `expectedState` are never filled for runtime patches (`live-patch.ts:205-238`). As a result, `adaptationEvidenceForStore` (`service.ts:5622-5625`) persists only `failedAction` and `diagnosis`.
4. **Step 9 (routing).** A reroute adds a `failed`-port edge (`patches.ts:113-146`), and a router object can be merged (`patches.ts:147-171`). Nothing generates route conditions.
5. **Step 10 (provenance).**
   - There is no failure signature. `adaptive-orchestrator.ts:191-198` matches on `metadata.failureSignature`, but `adaptationFromRuntimePatch`'s metadata (`live-patch.ts:233-237`) never writes it.
   - The classifier is called only from run summaries (`Core AS\runtime\service\summaries\conversions.ts:143`) and tests.
6. **The target is selector-only (E2).**
   - `isAutomationStudioRuntimeTargetOverrideTarget` requires exactly `{selector}` (`structured-response.ts:25-28`).
   - The domain validator is keyed by selector (`Here\domain\src\runtime\llm-evidence\tools.ts:91`, `target-override.ts:18-33`).
   - Apply writes `parameterValues.target = {selector}` (`patches.ts:49-51`; `Core AS\storage\project\adaptation-store.ts:381`).
   - The recorded fingerprint identity is therefore not what gets persisted.
7. **Extraction.**
   - `targetCompatibleWithFailedAction` accepts `web.output.dom-extract` but not `web.output.dom-extract_list` (`Here\domain\src\runtime\llm-evidence\target-override.ts:36-41`; the ID derivation is at `domain\src\output-nodes\definitions.ts:43`). An extract-list target failure always returns `absent`, so no proposal is made.
   - Item and field selectors are parameters, not a `target`. No patch kind edits them.

#### Recommended steps (partitioned by file)

- **C2.5a — Core** — `runtime\live-patch.ts` and `runtime\tests\live-patch.test.ts`.
  - Fill `observedState` and `expectedState` from `failedAttempt.transitionComparison`.
  - Write `metadata.failureSignature`, computed by the classifier's signature function. Export that function from its own file under `runtime\` (one export per file) and import it in `adaptive-orchestrator.ts`.
  - **Test:** the signature equals the classifier's.
  - **Mutation:** omit the signature, and the known-adaptation match test must fail.
- **C2.5b — Core, new domain-neutral directory `runtime\exploration-reduction\`.**
  - **Input:** ordered exploration steps, each with its outcome and state-before/after digests.
  - **Output:** the minimum action sequence, plus input and output state predicates.
  - **Method:** a backward slice from the success observation. Drop observation-only tools, failed actions, and action-plus-undo pairs.
  - **Test:** the MVP example `Observe → Scroll → Wrong Click → Back → Inspect → Correct Click → Wait` reduces to `Correct Click → Wait`.
  - **Mutations:** keep the observations; keep the wrong-click/back pair.
  - Blocked on 2.3's trace contract.
- **C2.5c — Core — a durable "deterministic path" patch** that inserts real action nodes (definition, parameters, target, expectation) into the owned Subflow graph and wires them from the failed node's `failed` port. This replaces the inert `parameterValues.recovery`.
  - **Files, serial because they share a union:** `model\flow-adaptation.ts` (kind union); `runtime\service\adaptations\patches.ts` (legacy applier); `storage\project\adaptation-store.ts:372-400` (graph operations and `supportsGraphTransaction`); `model\validation\adaptation.ts`.
  - **Tests:** `runtime\tests\service-adaptation-subflow.test.ts`, `storage\project\tests\adaptation-store.test.ts`.
  - **Mutation:** insert the node without its edge, and a next-run test must fail.
- **C2.5d — Core, then here (E2).**
  - **Core:** widen the target from `{selector}` to an opaque domain-owned target object that stays domain-neutral in Core (`structured-response.ts:14-28`, `live-patch.ts:57-61`, `service.ts:3101-3105`).
  - **Here:** `domain\src\runtime\llm-evidence\target-override.ts` and `tools.ts:91` return the evidence element's sanitized fingerprint together with the selector. Also accept `web.output.dom-extract_list`.
  - **Tests:** `domain\src\runtime\llm-evidence\tests\target-override.test.ts`, `tools.test.ts`.
  - **Mutations:** drop the fingerprint; drop the extract-list compatibility.
  - **Recommendation:** fingerprint-first. A selector-only persisted repair undoes Week 1's identity work (`MVP_AGENT_INSTRUCTIONS.md` §13).

### Phase 2.6 — Validate proposed adaptations

**Exit criterion:** "Successful exploration is not automatically treated as permanently correct."

#### Exists

- **Executed validation.**
  - `executeAutomationStudioRuntimePatch` reruns a patched clone from the failed node, or from the node the patch names, using the failed attempt's real inputs, capped at 50 steps (`live-patch.ts:174-200`).
  - The trace is compared with the expected route and outputs (`live-patch.ts:324-330`).
  - The result is recorded as `validationResults` succeeded or failed, with status `validated` or `rejected` (`live-patch.ts:222-228`).
- **Proposal-only validation on the `diagnose_and_adapt` lane.** A structural check plus a sanitized-evidence match; nothing is executed (`live-patch.ts:95-172, 262-306`; `service.ts:3070-3113`).
- **Gates.**
  - `decideAutomationStudioAdaptationPromotionGate` (`Core AS\runtime\training-modes.ts:306-318`): an adaptation must be validated. Destructive, high-risk, side-effecting, structural, or manual-mode adaptations, and a first review when one is required, all go to manual review. Only low-risk adaptations are applied automatically.
  - The apply-time gate `evaluateFlowAdaptationPromotionGates` (`service.ts:5632-5645`) runs on the legacy apply path (`service.ts:4332-4334`).
  - The typed store refuses to apply without a success or `validated` status, and refuses a stale base revision (`adaptation-store.ts:159-177`).
- **Score.** `adaptationConfidenceScore` (success ratio minus a risk penalty, `service.ts:5656-5661`) is only written into review metadata (`service.ts:4307`).
- **Statuses** include `testing` (`flow-adaptation.ts:326-334`). `request_validation` sets it (`service.ts:4325, 5124`).
- **Human review.** The PIN-authorized review endpoint (`automation-studio.md:627-631`).
- **Tests:** `live-patch.test.ts:7-306`; `training-modes.test.ts:132`; `service.test.ts:1438, 3194, 3249`.

#### Missing

1. **No High/Medium/Low model.** No code maps a confidence level to "persist", "use now and keep provisionally", or "ask". The numeric score drives no decision.
2. **No Medium tier.** `"testing"` appears only in the store's status mapping (`adaptation-store.ts:435-440`) and at the two places that set it. Nothing:
   - runs a provisional adaptation on later executions;
   - counts the successes of later runs;
   - uses a patch in the current run without persisting it (the in-run clone is evidence only).
3. **A never-executed proposal counts as a successful validation.**
   - `targetOverrideProposalAdaptation` writes `status: "succeeded"` with the detail "…not executed" (`live-patch.ts:285-290`).
   - `adaptationValidationCounts` counts it (`service.ts:5647-5654`), so it passes "at least one successful validation" (`service.ts:5635`) and scores 0.75.
   - The typed store treats any success as validated (`adaptation-store.ts:161`).
   - Only the high-risk rule (`training-modes.ts:310`) keeps such a proposal in manual review.
4. **No input-state reconstruction.** Validation runs on the live page immediately after the failure (`live-patch.ts:179-184`).
5. **A weak comparison.** When there is no comparison, a succeeded trace counts as restored (`live-patch.ts:326`). Outputs are checked for presence, not value (`live-patch.ts:328-329`).
6. **In the shipped app, live patch testing never runs** (`automation-studio.md:623-626`).

#### Recommended steps

- **C2.6a — Core** — `model\flow-adaptation.ts`, `model\validation\adaptation.ts`, a new migration under `storage\project\schema\`, and the row mapping in `adaptation-store.ts`.
  - Add `validationResults[].kind` (`executed` | `structural` | `replay`) and a persisted `confidence` tier.
- **C2.6b — Core, new `runtime\adaptation-confidence.ts`.** Decide the tier from executed and replay counts, risk, side effects, and patch kind, and feed the tier into the promotion gate (`training-modes.ts:306`).
  - **Tests:** one per tier boundary.
  - **Mutations:** allow a structural-only result to reach High, and a test must fail.
- **C2.6c — Core** — `live-patch.ts:285-290` marks the result `structural`; `service.ts:5647` and `adaptation-store.ts:161` count only `executed` and `replay`.
  - **Mutation:** count `structural`, and the gate-refusal test must fail.
- **C2.6d — Core, new `runtime\service\adaptations\provisional.ts`.** Do not grow `service.ts`, which is already 6,807 lines.
  - When a later run has a matching failure signature, run the `testing` adaptation as a temporary patch.
  - Append a `replay` result.
  - Promote after N successes (N = 2 recommended); reject on a failure.
  - **Tests:** in `service.test.ts`.
  - **Mutation:** skip the promotion.
- **Recommendation for the MVP.** Treat an in-run executed success as Medium, and reach High only after the zero-LLM replay passes. This matches what the Lab lanes already prove, and it avoids building web state restoration now. A domain-owned "restore input state" step (re-running from the start in a fresh tab) can come later, through `domain\src\runtime\host-runtime.ts` and a Core seam.
- **Lab proof.**
  - A variant whose patch "succeeds" once and fails on replay must not be promoted.
  - A proposal-only target override must never auto-apply.

### Phase 2.7 — Persist adaptations

**Exit criterion:** "The repaired behavior becomes part of normal future execution."

#### Exists

- **Durable apply and revert with rollback records.** `AutomationStudioDurableAdaptations` (`Core AS\runtime\service\adaptations\durable.ts:31-90`). Every patch applier validates before writing (`patches.ts:33-248`). The Flow is stamped with `appliedAdaptationIds` and `stabilityReset` (`durable.ts:107-144`).
- **Typed transactional apply** (`adaptation-store.ts:159-195`): stale-base check, graph patch, compiled revision, an inverse-patch rollback artifact, and an audit event.
  - Only `edit_expectation`, `edit_action_target`, `edit_recovery`, and `edit_router` with `toNodeId` are supported (`adaptation-store.ts:372-400`).
  - The service uses this path when supported (`service.ts:5108`) and re-syncs the canonical projection (`service.ts:5215-5236`).
- **The MVP persist list against what exists:**

  | MVP item | What exists |
  | --- | --- |
  | New deterministic path | Reroute edge only; action sequences are inert |
  | Changed routing | `edit_router` |
  | New state requirements | Timeout and retry only |
  | Updated target identity | `{selector}` only |
  | Relevant evidence | `evidence_digest` and artifacts (`schema\adaptations.ts:22, 27`) |
  | Confidence | **Not persisted** |
  | Provenance | `sourceRunId`, `author`, audit events |
  | Timestamp and version | `createdAt`/`updatedAt`, `base_*_revision`, `applied_revision` (`schema\adaptations.ts:12-16`) |

- **Next-run execution uses the change.** `service.test.ts:1501-1596`, and the live certification in `llm-production-automation-plan.md` Current State, line 31.
- **Tests:** `service-adaptation-subflow.test.ts:24, 106, 127, 189`; `service.test.ts:3249`; `adaptation-store.test.ts`.

#### Missing

1. **The persistable repair kinds cannot hold 2.5's output.**
   - A persisted action sequence has no reader (see 2.5, item 2).
   - It would show as `applied` and never run, which fails the exit criterion.
2. **The typed path does not support** `create_subflow`, `edit_subflow`, or router-rule edits (`adaptation-store.ts:399-400`). These fall back to the legacy JSON path.
3. **Confidence and the failure signature are not persisted.**
4. **The target is selector-only (E2).** A related open point: the gateway ranks `parameters.element` ahead of the adapted `parameters.target` unless `selectedCandidate` is set (`Here\domain\src\client\gateway-mapping.ts:227-231`). Whether a stale recorded fingerprint can therefore outrank a persisted repair was not verified.
5. **In the shipped app, automatic promotion never applies anything** (`automation-studio.md:627-631`). The High tier ("persist automatically") is unreachable until a grant lane may execute and auto-apply.

#### Recommended steps

- **C2.7a — Core.** Same files as C2.5c, same work.
  - **Test:** extend the `service.test.ts:1501` pattern with an action-path repair.
  - **Mutation:** a missing edge must make the second run fail, or make LLM calls exceed 2.
- **C2.7b — Core.** A new migration plus the row mapping in `adaptation-store.ts`: typed columns for the confidence tier, the failure signature, and the source evidence digest.
- **C2.7c — Core** — `service.ts:5632-5645`. Until C2.5c lands, the gate refuses `edit_recovery` with `actionDefinitionIds`, so an inert repair can never be "applied".
  - **Mutation:** remove the refusal.
- **D2.7a — Here** — `domain\src\client\gateway-mapping.ts` and its tests under `domain\src\client\tests\`. Decide and test the precedence between an adaptation-sourced target and the recorded element.
  - Add a content-harness spec (`apps\extension\e2e\content\tests\`) showing a persisted fingerprint target resolving on a drifted page.

### Phase 2.8 — Resume current execution

**Exit criterion:** "Successful adaptations allow the current workflow to continue."

#### Exists

- **`retryRuntimeSessionAfterAutoAppliedPatch`** (`service.ts:3260-3343`).
  - It triggers after an auto-applied patch that marked the original action retryable.
  - It reruns the updated Flow, or the routed Subflow graph, in the same session.
  - It appends attempts and effects and records `adaptiveRetry`.
  - Call sites: `service.ts:3540-3547` and `3594-3600`. Both skip explicit-grant runs.
- **Metric.** `deterministicSuccessAfterAdaptation` (`conversions.ts:24-37`, stored by `summaries\store.ts:97`).
- **Test.** `service.test.ts:1579-1580`.

#### Missing

1. **It restarts instead of resuming.** The retry starts from the graph's start (`automation-studio.md:646-650`; `service.ts:3287` passes no `startNodeId`). On the web this replays fills and clicks that already happened.
2. **It is unreachable in the shipped app and on every explicit-grant run** (`service.ts:3540, 3594`; `automation-studio.md:632-635`). Target overrides are high-risk (`live-patch.ts:293, 369`), so they are never auto-applied and never resumed.
3. **There is no continue-after-approval path.** The Lab's post-apply validations are new runs (`Here\packages\test-runner\src\demo-workspace\adaptation-lane.ts:112-113`).
4. **No continuation point is chosen, and there is no check that the page is still in the failed node's input state.**
5. **The in-run clone that starts at the failed node** (`live-patch.ts:178-184`) is never adopted as the continuation.

#### Recommended steps

- **C2.8a — Core, new `runtime\service\adaptations\resume.ts`.** Only the two call sites change in `service.ts`.
  - Resume at the failed node, or at the patch's start node, with the failed attempt's inputs and the run's accumulated values, merging attempts into the session. The executor already honours `startNodeId` (`live-patch.ts:181`).
  - Before resuming, require the node's expected input state through a host check. Restart only when no side-effecting node has run.
  - **Test** (`service.test.ts`): a node with a side-effect counter runs once in total.
  - **Mutation:** restart from the start, so the counter reads 2.
- **C2.8b — Core, a decision.** Should the explicit-grant lane execute a matched target override once, in the current run and without persisting it, and then resume? That is the Medium tier's "use during current execution".
  - Today this lane is proposal-only by design (`live-patch.ts:109-172`; `automation-studio.md:619-622`).
  - **Recommendation:** allow it only when the domain validator returns `matched` or `resolved` against sanitized evidence, and never for submit-like actions (`llm-production-automation-plan.md` Current State, line 47).
- **D2.8a — Here** — `domain\src\runtime\expectation\` (`conditions.ts`, `evaluate.ts`, and their tests). A web "input state still holds" predicate: page identity plus target presence.
- **Lab proof.** A multi-step fixture drifts step 2. The run completes, and the fixture's counter proves step 1's side effect happened exactly once.

### Phase 2.9 — Prove deterministic reuse

**Steps:** rerun; meet the same situation; confirm the learned behavior is selected; confirm the LLM does not activate; record the result in FluxBench.

#### Exists

- **Core proof with a mock provider.** `service.test.ts:1501-1596`: the second run has zero interventions, and `llmCalls` stays at 2.
- **Deterministic-first ordering.**
  - The recovery ladder puts the LLM last (`recovery-ladder.ts:54-61`).
  - `decideAutomationStudioLlmInvocationGate` (`training-modes.ts:271-282`).
  - The classifier's `llmEligibility` returns false when a known adaptation matches (`adaptive-orchestrator.ts:201-207`), but it is **not on the runtime path**. The service's LLM gate checks only `behavior.invokeLlm` and the budget (`service.ts:2879`).
- **Core run metrics.** `llmCallCount`, `durableBehaviorChanged`, `deterministicSuccessAfterAdaptation` (`conversions.ts:24-37`).
- **Live Lab lanes (DeepSeek, manual commands).**
  - `runDemoLlmAdaptation` (`adaptation-lane.ts:20-135`): drift, then exactly diagnosis plus `runtime_patch` with 2 provider calls (`:78`), a UI apply (`:104-107`), a changed execution digest (`:108-110`), and two zero-LLM runs (`:112-113`) checked by `runZeroLlmAdaptationValidation` (`demo-workspace\adaptation-ui.ts:167-174`: provider calls, interventions, and adaptations all 0).
  - The exploration variants block the LLM endpoints (`demo-workspace\exploration-adaptation.ts:188-194, 252-258`).
  - Fixture: `apps\scenario-lab\src\scenarios\instruction-only-form\scenario.ts`.
- **FluxBench.**
  - `harnessActivations` comes from the persisted run (`packages\test-runner\src\bench\evaluate-run.ts:35, 106`).
  - The Week 2 fields are reserved `null` (`packages\test-contracts\src\evaluation.ts:138-143`; `bench-report.ts:123-128`).
  - The lanes are `recording` and `flow` only (`evaluation.ts:68`). The corpora are `week1` and `smoke` only (`bench\corpus\find-bench-corpus.ts:7`).
  - Week 1 measured 0 harness activations in 378 runs (`cb-blocker-ranking-final.md:42`).

#### Missing

1. **FluxBench cannot measure an adaptation.** There is no lane, the metrics are `null`, and bench runs have no provider. The demo lanes are live, manual, and not bench cells.
2. **There is no provider-free way to drive an adaptation inside the Lab's Core.**
   - Tests inject `llmProviderResolver` mocks (`service.test.ts:1442, 1537`).
   - The host resolver from `createGlobalProgramRuntime` (`F:\!FluxIQ\packages\fluxiq\src\programs\_shared\runtime.ts:37`) returns a provider only with a grant.
   - No scripted provider is exported from Core `src`.
3. **Nothing attributes which adaptation was selected.**
   - `appliedAdaptationIds` is Flow metadata (`durable.ts:110-113`).
   - The typed path stamps only the adaptation (`adaptation-store.ts:185`).
   - Attempts carry no adaptation ID. The Adaptation Reuse Rate cannot be computed.
4. **The known-adaptation gate is not wired into runtime.** The provisional (Medium) tier needs it.

#### Recommended steps

- **C2.9a — Core.** A scripted, test-only provider for Lab hosts, under a `testing\` directory next to `runtime\llm\` per the code-structure rule.
  - It is enabled only by an explicit host flag on loopback, still requires a grant, and replays a fixture-declared patch response.
  - Wire it where the web app builds the resolver.
  - Update `automation-studio.md` "What the shipped app reaches".
- **C2.9b — Core.** Per-attempt provenance.
  - Apply stamps `metadata.adaptationId` on each patched node (`patches.ts`; `adaptation-store.ts:372-400`).
  - The executor copies it onto the attempt record (`runtime\executor\attempt-trace.ts`) and into run detail (`conversions.ts`).
  - **Mutation:** drop the stamp, and the "selected" test must fail.
- **D2.9a — Here** — `packages\test-contracts\src\evaluation.ts:138-143`, `bench-report.ts:123-128`, `evaluation-validation.ts`, `bench-report-validation.ts`, and the `tests\*.test.mjs` files.
  - Replace the `null` fields with typed records:
    - `harnessRecovery`
    - `adaptationCost`: provider calls, tokens, USD
    - `adaptationValidation`: tier and counts
    - `adaptationPersistence`: applied, mutations, revision
    - `adaptationReuse`: learned adaptation selected, provider calls, interventions
  - Add an adaptation cycle to the lanes (`evaluation.ts:68`) or a cycle index on the Flow lane.
- **D2.9b — Here**, a new `packages\test-runner\src\flow-lane\adaptation-cycle\` directory.
  - **Run 1:** drift armed, scripted provider. Assert the failure is classified, the adaptation is created, validated, and applied, and the run continued.
  - **Run 2:** same drift, provider endpoints blocked. Assert success, 0 calls, 0 interventions, and provenance naming the adaptation.
  - Aggregate the reuse rate in `bench\aggregate-report.ts`.
- **D2.9c — Here**, a new `bench\corpus\week2.ts`, registered at `find-bench-corpus.ts:7`. Rows:
  - the `instruction-only-form` target drift;
  - W04 `text-variant` and W08 `column-reorder`, plus X6's new item-selector drift;
  - W13 and W24, once Phase 2.4 classifies them (ranks W2-3 and W2-1).
- **D2.9d — Here**, `apps\scenario-lab`: fixture side-effect counters for the resume proof, and the item-selector drift variant.
- **Lab proof.** `pnpm lab bench --corpus week2` as an A/B pair on the production-Core topology, then `lab compare`. Then one live DeepSeek checkpoint through the existing demo lane.
- **Mutation targets:**
  - add a provider call to run 2, and the reuse assertion must fail;
  - remove the provenance, and "selected" must fail;
  - restart instead of resuming, and the counter must read 2.

---

## Extraction X6 interaction

- **Sequencing.** X6 runs with 2.6-2.9 and depends on X4 and X5 (`first-class-data-extraction-plan.md:96-98, 265`).
- **Blocker 1: extract-list targets are rejected.** An extract-list target failure can never produce a proposal (`target-override.ts:36-41`). List item and field selectors are parameters, which no patch kind edits. This needs either C2.5d plus a domain-declared "repairable parameter" patch, or X3's repair hooks with the collection-target contract (`extraction plan:262`). E2 must be decided with this in view (`open-questions.md:68-69`).
- **W04 `text-variant`** changes the price text (`apps\scenario-lab\src\scenarios\product-catalog\format.ts:10`).
  - That is an output mismatch, not a target failure.
  - Its repair is a record-shape or field expectation, which `edit_expectation` cannot carry today (it holds timeout and retry only).
- **W08 `column-reorder`** (`apps\scenario-lab\src\scenarios\data-table\scenario.ts:40`).
  - If the `column:<header>` grammar already survives the reorder, the row is a deterministic-first negative control: the LLM must not activate.
- **The reuse proof with extraction** needs:
  - X5's record judging;
  - the fix for Core trace withholding corrupting extracted strings (extraction plan Current State, defect 4). Otherwise run 2's records can read `[withheld]`.

## Week 1 carry-overs

- **E2** (`open-questions.md:54-69`): still selector-keyed (`tools.ts:91`; `structured-response.ts:14-28`; `live-patch.ts:58-61`). It decides what 2.5 and 2.7 persist. Recommendation: fingerprint-first, as in C2.5d.
- **E57** (`open-questions.md:1413-1441`): about 4 s per capture on a 5,000-element page. Every 2.6 validation rerun and every 2.8 resume adds captures. Measure these costs in the `week2` corpus on `member-directory`; X6 already plans cost measurement there.
- **E58** (`open-questions.md:1442-1477, 1497-1507`):
  - The snapshot cap (2,000) and `MAX_CANDIDATES` (60) bind on `member-directory`.
  - A persisted fingerprint repair (C2.5d) is only as good as the candidate set, so keep a realistic-page row in the reuse proof.
- **The Week 1 plan's Next steps** (`mvp-week1-web-automation-reliability-plan.md:85-89`):
  - W2-1 (W24 `unannounced`) and W2-3 (W13 `banner-absent`) are Phase 2.4 inputs (`cb-blocker-ranking-final.md:103, 105`). They become 2.9 benchmark rows after they classify.
  - The follow-ups at lines 74-83 (the TCP gateway failure stage; merge tolerance) are Lab reliability work that the `week2` A/B pair depends on.
- **LLM production plan** (Current State, lines 42, 46, 47, 53):
  - Reusable context must never offer rejected, reverted, stale, or nondeterministically validated changes as positive examples. This ties to the 2.6 tiers.
  - Literal selectors in exploration evidence tie to E2.
  - Generic submit stays blocked, which bounds what 2.5 may generate and what 2.8 may resume.

## Ownership summary

| Work | Owner |
| --- | --- |
| Patch kinds, reduction, confidence tiers, provisional validation, persistence columns, resume, provenance, scripted test provider | Core (C2.5a-d, C2.6a-d, C2.7a-c, C2.8a-b, C2.9a-b) |
| Target validator and fingerprint (E2), extract-list compatibility, gateway precedence, input-state predicate | Here: `domain` (C2.5d downstream half, D2.7a, D2.8a) |
| Metric contracts, adaptation-cycle lane, `week2` corpus, fixtures | Here: `packages\test-contracts`, `packages\test-runner`, `apps\scenario-lab` (D2.9a-d) |

The Core items touch shared files, so they are serial within each file:

- `model\flow-adaptation.ts`: C2.5c, C2.6a, C2.7b
- `adaptation-store.ts`: C2.5c, C2.6c, C2.7b, C2.9b
- `live-patch.ts`: C2.5a, C2.6c

## What changed and why

Only this report was written. No source file, document, build output, or git state was touched.

## Commands run and observed results

- `wc -l` on 17 Core adaptation files.
  - **Observed:** `runtime/service.ts` is 6,807 lines; `adaptation-store.ts` 459; `live-patch.ts` 376; `patches.ts` 302; `durable.ts` 191. Total 10,683.
- `sed -n '1743p;1747p'` on `docs\architecture\testing-facility.md`, to read two long lines.
- Everything else was Read, Grep, and Glob.
- No builds, tests, Lab runs, or panel were started.

## Not verified

- **Phase 2.1-2.4 behavior** (sibling scope): whether web failed attempts carry `transitionComparison`, which `runtimePatchRestoredExpectedState` needs.
- **Gateway precedence** (`gateway-mapping.ts:227-231`): whether a stale recorded element outranks a persisted `{selector}` repair at dispatch.
- **Reuse evidence.** No test was run. The Core loop test and the certified live lanes are cited as written; their passing is claimed by the LLM plan, not observed here.
- **Evidence digest.** Whether `evidence_digest` is filled for runtime-patch adaptations. `adaptationEvidenceForStore` was read; the store's put path was not.
- **Structure baseline.** Whether `service.ts`'s size is frozen in `F:\!FluxIQ\.structure-baseline.json`.
- **Grant wiring.** Where exactly the web app wires `llmProviderResolver` for the Lab's Core.
- **Classifier inputs.** Whether `conversions.ts:143` passes adaptations to the classifier.

## Open questions or contradictions found

1. **The proposal-only target override is recorded as a "succeeded" validation** (`live-patch.ts:285-290`), and both apply gates count it (`service.ts:5635`; `adaptation-store.ts:161`). This contradicts 2.6's exit criterion in spirit. Only the high-risk rule stops auto-apply.
2. **`edit_recovery` action sequences persist into `parameterValues.recovery`, which no Core code reads.** They can reach `applied` without ever executing. `approvedRuntimePatchNodeIds` likewise has no producer outside tests.
3. **The MVP asks for automatic persistence at High confidence and for resume after adaptation.** In the shipped app both are unreachable by design (`automation-studio.md:606-650`). Allowing an explicit-grant lane to execute and auto-apply is a security and product decision for the supervisor (C2.8b).
4. **The classifier's known-adaptation matching and `failureSignature` are unwired.** The matcher reads a field no producer writes, and the classifier runs only for summaries.
5. **E2 and X6 are one decision.** An extract-list repair needs a non-`target` parameter repair, so the E2 contract should be designed once for both.
