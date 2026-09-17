# w2-back-half-design: one back half for create, repair and improve (Phases 2.4-2.9, X6)

Worker report, 2026-09-16. Read-only design. Nothing was edited, built, tested
or run live; the only file written is this report.

Path prefixes: `AS/` is Core's `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`;
`FB/` is `AS/runtime/flow-bootstrap/plan/`; unprefixed `domain/`, `apps/`,
`packages/` paths are this repository. Line numbers are from the working trees as
read on 2026-09-16 at about 17:30-18:30. Files marked **(in flux)** were being
edited by other workers while I read them, so treat their line numbers as
approximate.

## Outcome

Done. The design is below. The short version:

1. **The back half should be one pipeline with one record, whatever the entry
   point:** *generate a change → trial it on the live page → decide a verdict
   from observed evidence → save it with its validation results → apply it →
   continue the run (or run the new Flow) → replay it with no model → promote it*.
   Today creation and repair share almost nothing after "generate". Creation has
   no trial, no validation results, no replay record, and its only gate is a
   person's approval. Repair has a trial but judges it too strictly and too
   loosely at once (details under 2.4), throws the trial away instead of
   continuing from it, and never learns from later runs.
2. **Six new defects found by reading** would each stop "Fail → … → Re-run
   Deterministically" from working reliably. Three matter now:
   - **D-1: a correct repair applied to a *recorded* Flow probably still fails on
     replay.** The dispatched command takes the repaired selector but keeps the
     stale recorded element as its identity. The page-side resolver then
     cross-checks that selector's match against the stale identity, and on
     `identity-drift --variant renamed-redesign` the stale identity
     corroborates nothing on the redesigned page. This hits the plan's next
     step 5 directly. The Flow that passed live today (`flow.080e474c`) was a
     *created* Flow, which has no recorded element, so it did not exercise this.
   - **D-2: once a repair is applied, a later failure of the same node can
     never reach the model again.** The deterministic gate treats any
     applied or approved adaptation on the same node as "a known answer", and
     nothing re-applies it. The trace even says the known adaptation "is what
     should be applied".
   - **D-3: what the exploration finds never reaches the repair.** The patch
     request gets only the original failure snapshot. The target check
     validates handles against that same snapshot. So a control the exploration
     revealed cannot be named in the repair, and whatever the exploration did to
     the page (for example dismissing an overlay) is not part of the repair.
3. **The third entry point (improve an existing Flow)** is best built as an
   *additive* Flow Bootstrap mode (`extend`): new Subflows, new Router rules
   and new branches on existing nodes' ports, never edits to what is there.
   Its new nodes use the same handle resolution, parameter contracts, trial,
   verdict and replay as the other two entry points. Details in its own section.
4. **The work splits into 23 briefs** (section "Work partition"). Nine can start
   now in parallel because they touch no file another worker holds today. The
   rest queue behind the in-flux Core files (`service.ts`, `live-patch.ts`,
   `recovery/annotation/**`, `harness-options/**`, `service/**`) and this
   repository's `flow-lane/**`, `live-llm/**` and `run-scenario.ts`.

## What changed and why

Only this report was written. No source, working document, build output or git
state was touched in either repository.

---

## 1. The pipeline, and what "entry-point-neutral" means concretely

| Step | Instruction (create) today | Run failure (repair) today | Neutral design |
| --- | --- | --- | --- |
| Generate | Bootstrap plan, handles resolved by the domain (in flux: `AS/runtime/llm/harness-options/plan-parameter-resolution.ts`, `bootstrap-completion.ts`), checked in-loop (`AS/runtime/service.ts:1919-1923`) | One `runtime_patch` response (`AS/runtime/recovery/annotation/annotate.ts:288-311`); target handles resolved by `validateTargetOverrideEvidence` (`AS/runtime/recovery/annotation/patches.ts:89-94`) | Every model-authored node or parameter is resolved by **one** domain hook (`resolvePlanNodeParameters`) and checked by **one** validator (registry + parameter contracts). The target-override validator stays for the single-control case |
| Trial | None | `executeAutomationStudioRuntimePatch` reruns from the failed node (`AS/runtime/live-patch.ts:295-329`), only under `explore_and_adapt` (`patches.ts:98-101`) | `trialAutomationStudioFlowChange`: run the candidate on a throwaway copy on the live page, from the right node, with the run's real values |
| Verdict | None | `verifyRuntimePatchOutcome` (`live-patch.ts:522-539`) | `decideAutomationStudioChangeVerdict`, per changed node, evidence-based (2.4) |
| Save | `AutomationStudioBootstrapAdaptation` (`AS/runtime/flow-bootstrap/adaptation.ts:68-90`), no validation field | `AutomationStudioFlowAdaptation` (`AS/model/flow-adaptation.ts:338-362`) with `validationResults` | Both carry `origin`, `validationResults[]` with a `kind`, and `metadata.confidence` |
| Apply | `applyFlowBootstrapAdaptation` (`service.ts:4105-4222`), gate = status `validated` (a person approved) | typed store `applyApprovedAdaptation` (`AS/storage/project/adaptation-store.ts:159-199`) or legacy durable; gate = executed success or named approval (`AS/runtime/recovery/adaptation-promotion.ts:12-25`) | Same gate for both: a succeeded trial or replay, or a named reviewer's approval |
| Continue | n/a (nothing was running) | restart from the top, only without a grant (`service.ts:2974-3057`, call sites `:3239`, `:3293`) | Repair: adopt the verified trial as the run's continuation. Create: the trial *is* the first run |
| Replay | Lab only: created Flow run deterministically after apply (`packages/test-runner/src/flow-lane/creation/lane.ts`) | Lab/demo only: two zero-LLM runs (`packages/test-runner/src/demo-workspace/adaptation-ui.ts:167-174`) | Core records it: every later run with zero provider calls that exercised a changed node appends a `replay` result to that change |
| Promote | n/a | promotion gate (`AS/runtime/training-modes.ts:306-318`) on a single success | Tier from trial + replay counts (2.6); the known-adaptation gate reads the tier |

The rule that makes this neutral is simple: **a change is known to the executor
by the node ids it wrote, and to the store by one record shape.** Bootstrap
already stamps every node it creates with `metadata.bootstrapAdaptationId`
(`AS/runtime/flow-bootstrap/adaptation.ts:138-142`). Repairs stamp nothing. Once
both stamp one neutral field, the trial, verdict, replay and promotion code never
needs to know which entry point produced the change.

---

## 2. Shared contracts (types and persisted fields)

All new Core types go in a new directory, **`AS/runtime/flow-change/`**. The
reason is size: `AS/runtime/` already holds 23 source files against a hard limit
of 25, and `AS/runtime/recovery/` holds 16 against an advisory 15 (per the
`w2-grant-survives-bad-reply` report). Nothing here is web-specific.

### 2.1 Origin (which entry point produced the change)

```ts
// AS/runtime/flow-change/contracts.ts
export type AutomationStudioFlowChangeOrigin =
  | { entryPoint: "instruction"; instructionIds: string[] }
  | { entryPoint: "run_failure"; runId: string; failedNodeId: string; failureSignature: string }
  | { entryPoint: "edge_case"; instructionIds: string[]; runId?: string; failureSignature?: string };
```

Persisted as `metadata.origin` on `AutomationStudioFlowAdaptation` (it lives in
the typed store's `status_detail_json`, so no migration), and as a new optional
top-level `origin` on `AutomationStudioBootstrapAdaptation`.

### 2.2 Verdict (Phase 2.4)

```ts
export type AutomationStudioChangeVerdictCheckKind =
  | "changed_node_succeeded"   // every node the change wrote, where the trial reached it
  | "expected_state"           // host-evaluated expectedState on a changed node
  | "expected_route"           // a declared route (never the failure's own fallback)
  | "expected_outputs"         // declared output ids present
  | "records"                  // a changed node that saves records captured >= its minimum
  | "downstream_assertion"     // a later node whose definition declares metadata.verifiesState succeeded
  | "continuation";            // the route taken from the last changed node leads to a node that started, or to a successful end
export type AutomationStudioChangeVerdictCheck = {
  kind: AutomationStudioChangeVerdictCheckKind;
  status: "passed" | "failed" | "not_applicable" | "unknown";
  nodeId?: string;
  code?: string;               // Core or domain code, never prose or page text
};
export type AutomationStudioChangeVerdict = {
  schemaVersion: "automation-studio.change-verdict.v1";
  outcome: "verified" | "contradicted" | "unverifiable" | "not_executed";
  basis: Array<Exclude<AutomationStudioChangeVerdictCheckKind, "changed_node_succeeded" | "continuation">>; // non-empty exactly when verified
  checks: AutomationStudioChangeVerdictCheck[];
  resumeFrom?: { nodeId: string; route: string } | { completed: true };
  reason: string;              // Core's sentence
};
```

Rules, each a unit test and a mutation target:

- `verified` requires `changed_node_succeeded` to pass for every changed node
  the trial reached, **no** failed check, and **at least one** passed evidence
  check (`expected_state`, `expected_route`, `expected_outputs`, `records`,
  `downstream_assertion`). A node that merely succeeded is `unverifiable`: that
  keeps the rule the Phase D work established.
- A failure *after* the changed nodes (a second drift further on) does not
  contradict the change. It ends the continuation, and the run can enter the
  loop again for that node. Today `verifyRuntimePatchOutcome` requires the whole
  rerun to succeed (`live-patch.ts:523`), so a correct repair followed by an
  unrelated later failure is recorded as `rejected`.
- An `unknown` on a check the node declared (for example a host that cannot
  evaluate `expectedState`) is not a pass.
- `downstream_assertion` is how most web repairs can be verified at all. Web
  output nodes declare no route and no outputs, so under today's rule nearly
  every executed web repair is `unverifiable`, lands as `testing`
  (`live-patch.ts:378-382`), and can never promote itself. Which verbs count is
  decided by the node definition's `metadata.verifiesState === true`: Core sets
  it on `builtin.policy.expectation`, and the web domain sets it on its
  `web.dom.assert`, `web.dom.wait_for_text` and `web.dom.wait_for_selector`
  outputs (`domain/src/actions/types.ts:22-36`).
- `records` reads the run state's captured-record summary for that node
  (`AS/runtime/executor/record-summary.ts`, `record-capture.ts`). That
  file's exact shape was **not read**; the brief that builds the check must
  confirm it.

`AutomationStudioRuntimePatchVerification` (`live-patch.ts:27-31`) already uses
the same four outcome words; it becomes a projection of this verdict, so
existing receipts (`patches.ts:113`) keep their shape.

### 2.3 Trial

```ts
export type AutomationStudioChangeTrialInput = {
  candidate: AutomationStudioFlowDocument;          // throwaway: patched copy, or an in-memory Subflow graph
  changedNodeIds: readonly string[];
  startNodeId?: string;                             // the failed node for a repair; absent means the graph's start
  seedValues: Record<string, JsonValue>;            // executed values at the failure, or the run's inputs
  options: AutomationStudioGraphExecutionOptions;   // the run's own IO, host runtime, dataset handler, signal
};
export type AutomationStudioChangeTrialResult = {
  verdict: AutomationStudioChangeVerdict;
  savedTrace: AutomationStudioGraphExecutionTrace;  // withheld; the only copy that may be stored
  executedTrace: AutomationStudioGraphExecutionTrace; // in memory only, for continuing; never persisted
};
```

It uses `runAutomationStudioGraph`'s existing `onExecutedTrace` hook
(`AS/runtime/executor/graph-run.ts:45-75`) to get real values without persisting
them. Its step budget is the run's remaining budget, not the fixed 50
(`live-patch.ts:310`): the trial is also the continuation (2.8), and a
Flow that loops over records needs more than 50 steps.

### 2.4 Validation result (Phase 2.6)

Widen the existing entry (`AS/model/flow-adaptation.ts:353`):

```ts
validationResults?: Array<{
  runId: string;
  status: "succeeded" | "failed";
  checkedAt: number;
  detail?: string;
  kind?: "trial" | "replay";     // absent on records written before this change: read as "trial"
  basis?: string[];              // the verdict's basis, codes only
}>;
```

Structural checks stay in `metadata.structuralChecks`
(`live-patch.ts:442-458`) and never become validation results. The same field
is added to `AutomationStudioBootstrapAdaptation`.

### 2.5 Confidence tier (L7)

```ts
export type AutomationStudioChangeConfidence = "unverified" | "provisional" | "established";
export function decideAutomationStudioChangeConfidence(input: {
  validationResults: readonly ValidationResult[];
  riskLevel: "low" | "medium" | "high" | "destructive";
  replaysRequired?: number;      // default 2
}): { tier: AutomationStudioChangeConfidence; trials: number; replays: number; lastFailure?: "trial" | "replay" };
```

- `unverified`: no succeeded trial or replay, or a failed replay after the last
  success.
- `provisional`: at least one succeeded trial or replay, and fewer than
  `replaysRequired` succeeded replays since the last failure.
- `established`: at least `replaysRequired` succeeded replays, and none failed
  since.

This replaces the numeric `adaptationConfidenceScore`
(`adaptation-promotion.ts:49-54`), which is written into review metadata and
decides nothing. It is persisted as `metadata.confidence` and, for querying, as
a typed column (2.7).

In plain terms: High, Medium and Low from the MVP map to `established`,
`provisional` and `unverified`.

### 2.6 Provenance (Phase 2.9)

- **Node:** `metadata.adaptationIds: string[]`, append-only, at most 8, on
  every node a change writes or creates. Bootstrap keeps
  `bootstrapAdaptationId` and adds the same id to the list.
- **Attempt:** `AutomationStudioNodeAttemptTrace.adaptationIds?: string[]`,
  copied from the node when it runs (`AS/runtime/executor/contracts.ts`).
- **Run detail:** `actionAttempts[].metadata.adaptationIds`, and
  `metadata.adaptationsExercised: string[]`.

### 2.7 Resume record (Phase 2.8)

In run detail metadata:
`resume: { from: { nodeId, route }, status, attemptCount, adaptationIds, source: "trial" }`.
It replaces `adaptiveRetry` (`service.ts:3049-3053`) for the repair path.
`deterministicSuccessAfterAdaptation`
(`AS/runtime/service/summaries/conversions.ts:36`) then reads `resume` first and
`adaptiveRetry` second.

---

## 3. Phase by phase

### Phase 2.4: Recovery success detection

**What exists**

- The false "recovered" is gone. `verifyRuntimePatchOutcome` refuses to infer
  success from silence: no comparison → `unverifiable`; an expected route
  that repeats the failure's own route is ignored; missing outputs →
  `contradicted` (`live-patch.ts:522-539`). An `unverifiable` rerun records no
  validation and leaves the adaptation in `testing` (`:337-344`, `:378-382`).
- The per-attempt comparison and the host's expected-state evaluation run inside
  the rerun (`AS/runtime/executor/transition-comparison.ts`; the web evaluator
  is `domain/src/runtime/host-runtime.ts:117`).
- A list extraction below its minimum fails its attempt, so a short read
  already contradicts a trial.

**What is missing**

1. The verdict is whole-run, not per changed node (`live-patch.ts:523`).
2. It has no evidence check a web node can satisfy (see 2.2), so executed web
   repairs are `unverifiable` in practice. This is an inference from reading,
   not an observed run.
3. It returns no `resumeFrom`.
4. Creation has no verdict at all.
5. W24 `unannounced` and W13 `banner-absent` classification (W2-1, W2-3) is
   not covered by anything I read today. It stays as the scoping report
   describes it.

**Created Flow through 2.4.** The trial's `changedNodeIds` is every node
carrying the bootstrap adaptation's id. `downstream_assertion` and `records`
are the checks that matter (a created scrape Flow is verified by its
`extract_list` node's records). `continuation` is `completed`.

**Repaired Flow through 2.4.** The changed node is the patched node (or the
inserted path, see 2.5). The verdict's `resumeFrom` is the edge target of the
route the changed node took.

**Tests**

- `AS/runtime/flow-change/tests/verdict.test.ts`, one row per rule.
- Mutations to prove the tests bite:
  - accept a success with no evidence;
  - let a later node's failure contradict the change;
  - treat `unknown` as passed;
  - count the failure's own route as evidence;
  - ignore `records`.

**Lab proof**

- The `harnessRecovery` record (`packages/test-contracts/src/harness-recovery.ts`)
  gains `verdict: { outcome, basis }`.
- On `identity-drift --variant renamed-redesign`, a repair run shows `verified`
  with basis `downstream_assertion` (the scenario has an assert step; that is
  **not verified**, so check the manifest).
- A repair naming Discard shows `contradicted`, because the oracle's text check
  fails the downstream assert.

### Phase 2.5: Convert exploration into a reusable change

**What exists**

- Five patch kinds (`AS/runtime/llm/harness/structured-response.ts:99-104`).
- The target is opaque handles, and the model may author nothing else
  (`:95-127`).
- The domain resolves handles fingerprint-first
  (`domain/src/runtime/llm-evidence/target-override.ts:49-80,150-193`).
- `failureSignature` is written (`live-patch.ts:372,457,588-596`).
- Two patch kinds are refused as unapplied rather than silently tested on the
  unmodified Flow (`live-patch.ts:500-504`).
- `edit_recovery` is refused by both durable appliers
  (`adaptation-store.ts:393-398`; `AS/runtime/service/adaptations/durable.ts:105`).
- Creation now resolves `{ "handle": … }` plan parameters through the domain
  (Core in flux; domain `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`).

**What is missing**

1. **D-3, the exploration-to-patch handoff.**
   - The patch request carries `failureEvidence`, `recoveryContext` and
     `reusableContext` only (`annotate.ts:298-299`). `exploration` is read only
     for the trace (`:352`).
   - The target check uses `input.failureEvidence` only (`patches.ts:89-94`).
   - The domain retains selectors per packet (`domain/src/runtime/llm-evidence/tools.ts:146-151`),
     so validating against an explored packet is safe. The plan-handle resolver
     remembers authoring packets only, not recovery packets (open question 5 of
     `w2-detect-repeating-structure-tool`).
2. **Nothing turns what the exploration did into steps of the repair.**
   - `temporary_action_sequence` names definition ids only and is refused.
   - Neutral replacement: **`temporary_insert_path`**, whose nodes are
     *bootstrap plan nodes* (`FB/contracts.ts:9-15`: key, definitionId,
     definitionVersion, parameters, outputActionId). They are resolved by the
     same `resolvePlanNodeParameters` hook and validated by the same parameter
     validation (`FB/validation.ts`) as a created Flow.
   - Shape:
     `{ kind: "temporary_insert_path"; beforeNodeId: string; nodes: BootstrapNode[]; edges: BootstrapEdge[]; reason }`.
     The nodes run in order in front of the failed node and rejoin it on
     success.
   - Durable form: `edit_insert_path`, applied with the existing graph
     operations `add_node`, `add_edge` and `delete_edge`
     (`AS/storage/project/graph-store.ts:21-27`), whose inverses the store
     already produces.
   - Reduction rule, deterministic and in Core: keep only the exploration steps
     that declared `effect: "mutate"` and returned evidence, in order, drop a
     step whose effect a later step undid, and let the model confirm or trim the
     path in the patch call. **Not verified:** that the domain's recovery
     option records carry enough (tool id, effect, result code) for this. The
     trace type is `AutomationStudioLlmEvidenceLoopTrace`, which I did not read
     in full.
3. **Structured-parameter repairs (X6, and any non-target parameter):**
   **`temporary_parameter_override`** `{ targetNodeId, parameters: Record<string, JsonValue>, reason }`,
   whose values may be `{ "handle": … }` references, resolved by the same hook.
   Durable form: `edit_node_parameters` → `set_node_parameters`. This is what
   an extraction repair should be (see X6).
4. `observedState` and `expectedState` on the adaptation are still unfilled
   (`live-patch.ts:345-375`). Fill them from the failed attempt's
   `transitionComparison`, as counts and status codes only, never values.
5. Failure signatures match by node identity alone, ignoring the failure class
   (`AS/runtime/adaptive-orchestrator.ts:189`). See D-2.

**Created Flow through 2.5.** Unchanged: the plan is the change. What creation
contributes is the node contract and the hook that repair reuses.

**Repaired Flow through 2.5.** It gets one of three patches: a single-control
target override, an inserted path, or a parameter override. Every one names
things only by handles, and every one is resolved by the domain before it is
saved.

**Tests**

- `live-patch.test.ts`: an inserted path applies to the throwaway copy and runs
  before the failed node.
- `AS/storage/project/tests/adaptation-store.test.ts`: `edit_insert_path`
  applies, and its rollback restores the original edge.
- Mutations: insert without rejoining; skip handle resolution; keep observe-only
  steps.

**Lab proof.** A W13-style overlay case: the exploration dismisses the overlay,
the repair inserts a dismiss step, and two replays pass with zero calls.
Scenario `modal-flows` or `failure-surfaces` is the candidate; **not checked**
which variant fits.

### Phase 2.6: Validate proposed changes

**What exists**

- A never-run proposal carries no validation result. It records
  `metadata.structuralChecks` instead (`live-patch.ts:442-458`).
- Both apply gates require an executed success or a named reviewer approval
  (`adaptation-promotion.ts:12-25`; `adaptation-store.ts:161-166`).
- The promotion gate refuses unvalidated, high-risk, side-effecting,
  structural and manual-mode adaptations (`training-modes.ts:306-318`).
- Explicit-grant runs force manual approval (`service.ts:3081`), so every
  granted repair waits for a person. That matches L13: approval gates
  *applying*, not producing.

**What is missing**

1. Validation kinds and a tier (2.4 and 2.5 in section 2).
2. Replay promotion (2.9).
3. A bootstrap adaptation has no validation at all. `validated` means "a
   person approved it" (`service.ts:4109`).
4. **Creation trial.**
   - Recommended: a `trial` review action on a proposed bootstrap adaptation.
     It runs the proposed primary Subflow graph, and the Router if there are
     several Subflows, *in memory* on the live page, through the same trial
     function. That works because `runAutomationStudioRouter` and
     `runCanonicalAutomationStudioFlow` take in-memory objects
     (`service.ts:3169-3189`).
   - The alternative is "the first run after apply is the trial". It is simpler
     and already exists in the Lab, but it makes creation's order (save, apply,
     then validate) differ from repair's (validate, save, apply). That breaks
     the neutrality asked for.
   - A trial performs real page actions, so it obeys the same policy as live
     patch testing (`live-patch.ts:126-131`).

**How a created Flow passes through**

1. Proposed.
2. `trial`, which appends a `trial` validation result.
3. A person approves; the gate needs a trial success or the approval.
4. Applied.
5. First runs append `replay` results.
6. After two replays the tier is `established`.

**How a repaired Flow passes through**

1. Trial under `explore_and_adapt`, which appends a `trial` result.
2. Saved as `validated` or `testing`.
3. A person approves (explicit grants), or the gate auto-applies (adaptive
   training mode, low risk).
4. Replays promote it.

**Tests and mutations**

- `flow-change/tests/confidence.test.ts`, one row per tier boundary.
- `adaptation-promotion` tests: count only `trial` and `replay`.
- Mutations: let a structural check count as a trial; skip the
  failed-replay-after-success demotion.

**Lab proof.** A variant whose repair passes its trial and fails its first
replay must end `unverified`, and the known-adaptation gate must then let the
model back in (ties to D-2).

### Phase 2.7: Persist

**What exists**

- The typed transactional apply, with a stale-base check, a rollback artifact
  and an audit event (`adaptation-store.ts:159-199`), for three patch kinds:
  - `edit_action_target` (writes `parameterValues.target`, `:405`);
  - `edit_expectation`;
  - `edit_router` as a `failed`-port edge (`:410-412`).
- The legacy durable path.
- Bootstrap apply with ownership, rollback, and (in flux) the graph index
  created before the applied digest is taken (`service.ts:4148-4150`).
- The next-run execution of a target override works for **created** Flows.
  That was observed live today (`w2-live-explore-create-repair`, live repair 3).

**What is missing**

1. **D-1, the precedence between the repair and the recorded identity.**
   - The dispatched selector comes from the adapted target
     (`domain/src/output-nodes/targets/targets.ts:12-17`;
     `domain/src/client/gateway-mapping.ts:186`).
   - The element identity comes from the *recorded* `parameters.element` unless
     Core set `selectedCandidate` (`gateway-mapping.ts:243-248`;
     `targets.ts:61-69`), and nothing sets it.
   - The content resolver vetoes an exact selector match that "corroborates
     nothing the recording named" (`apps/extension/src/content/action-runtime/resolve-target.ts:216-228`).
   - On `renamed-redesign` nothing corroborates by construction
     (`w2-repairable-drift-scenario`), and the family fallback scores −0.104
     under a 0.35 floor.
   - So an approved, applied, correct repair on the recorded Flow should still
     end `target_not_found`. **This is inferred from reading, not run.**
   - Fix: a target that carries `handles` and `handleResolution` (a domain
     resolution) is treated like a selected candidate in both functions.
     Failing test first.
2. **Provenance on nodes.**
   - The graph store has no metadata operation (`graph-store.ts:21-27`).
   - Add `set_node_metadata` with an inverse, or make `set_node_parameters`
     carry an optional `metadata`. The former is cleaner.
   - The alternative, a node → adaptation map passed through graph options,
     avoids a store change but duplicates what bootstrap already writes on the
     node.
3. **`edit_insert_path` and `edit_node_parameters`** operation builders.
4. **Typed columns for matching** (migration `0020`, the next free id after
   `0019_run_datasets`):
   - `failure_signature text`, indexed with `flow_id`;
   - `confidence_tier text`;
   - `origin_entry_point text`.

   Everything else stays in `status_detail_json`.
5. **The X6 application defect** (see X6).

**How a created Flow passes through.** Bootstrap apply as today, plus
`adaptationIds` on every node, plus `origin`.

**How a repaired Flow passes through.** Typed apply, plus the provenance
operation, plus the new operation builders.

**Tests**

- `domain/src/client/tests/` and `domain/src/output-nodes/targets/tests/`: a
  repaired target beats a recorded element.
- `apps/extension/e2e/content/tests/identity-resolution.spec.ts`: a new row,
  "a persisted repair of the recorded Save resolves Apply changes on
  `renamed-redesign`". That directory is at its 25-entry limit, so the row goes
  into the existing file.
- Mutations: restore the recorded-first order, and the new row must fail.

**Lab proof.** `renamed-redesign`, repaired, approved and applied, then run with
no model, ends `Saved: Aurora Field Team`, `saveCount: 1`.

### Phase 2.8: Resume the current run

**What exists**

- `retryRuntimeSessionAfterAutoAppliedPatch` reruns the whole Flow from its
  start with no `startNodeId` (`service.ts:3001`). It is skipped for every
  granted run (`:3239`, `:3293`).
- The executor honours `startNodeId` (`graph-run.ts:195-196`).
- The live-patch rerun already starts at the failed node with the failed
  attempt's real inputs (`live-patch.ts:305-311`). It is effectively a
  continuation that is then thrown away: its trace is used only for the verdict.

**What is missing**

1. Adopting the verified trial as the continuation. The session's attempts and
   effects are appended with the trial's, its status becomes the trial's, and
   run detail gets `resume`. This removes double execution: today, on a no-grant
   adaptive run, the rerun has already executed the rest of the Flow, and the
   retry executes it all again from the top.
2. The trial trace must reach the service. `applyAutomationStudioRuntimeRecoveryPatches`
   returns JSON receipts only (`patches.ts:102-120`). It needs to return the
   in-memory executed trace of the verified trial, never persisted.
3. Seed values:
   - The trial is seeded with `failedAttempt.inputs` (`live-patch.ts:309`).
   - For a continuation it must be the executed run's `values` at the failure.
   - The service captures only the failed attempt from `onExecutedTrace`
     (`service.ts:3189`, `:3270`). It must keep the executed values too, in
     memory.
4. Resuming after a *person* approves (the proposal-only `diagnose_and_adapt`
   path) is not possible safely, because the page has moved on. **Recommend
   not building it for Week 2.** For that path the next run is the replay. A
   domain "input state still holds" predicate is needed only if a
   resume-after-approval is wanted later.

**Created Flow.** Nothing to resume. The trial (2.6) runs the new Flow once,
and that is the task done.

**Repaired Flow.** The trial is the continuation. A continuation that fails at
a *later* node is a new failure of the same run. The loop may take it again
under the same grant and deadline, bounded by the existing guards (cost,
tokens, 600 s deadline, no-progress). That is "iterate" in L15's order.

**Tests**

- A new `flow-change/tests/resume.test.ts`, plus a service-level test: a node
  with a side-effect counter runs exactly once in total.
- Mutations: restart from the start (the counter reads 2); discard the trial
  trace (the run ends failed).

**Lab proof.** A fixture whose step 1 has a counter and whose step 2 drifts.
One live run, repaired in-run: verdict passed, counter 1, final state reached.
`apps/scenario-lab` has no such counter scenario today; **not checked** in
detail.

### Phase 2.9: Prove deterministic reuse

**What exists**

- Live demo lanes apply a repair and prove two zero-LLM runs
  (`packages/test-runner/src/demo-workspace/adaptation-lane.ts`,
  `adaptation-ui.ts:167-174`). Live repair 3 passed end to end today.
- Per-call records (`metadata.llmGate.providerCalls`, `annotate.ts:331-345`)
  and the Lab reader.
- `harnessRecovery` is typed and recorded
  (`packages/test-contracts/src/harness-recovery.ts`).
- The `create-flow` Lab lane and the campaign runner exist.
- `adaptationCost`, `adaptationValidation`, `adaptationPersistence` and
  `adaptationReuse` are still `null` (`packages/test-contracts/src/evaluation.ts:227-230`).
- The bench's Flow lane still drops `harnessRecovery`
  (open question 1 of `w2-lab-repair-outcome`).

**What is missing**

1. Core does not record reuse. Provenance (2.6 in section 2) plus a replay
   recorder:
   - After a run's detail is saved, if the run made zero provider calls, append
     a `replay` result to each adaptation in `adaptationsExercised`: succeeded
     if every exercised node succeeded and the verdict function, run over the
     live run's attempts, is `verified`; failed if any exercised node failed.
   - Then recompute the tier.
   - A run that did call the model records nothing, so repair runs do not grade
     themselves.
2. No Lab task selects `explore_and_adapt` (`packages/test-runner/src/live-llm/live-llm-plan.ts:177-186`).
   Add `--llm-task repair`: an in-run trial and resume, then approve and apply
   through the PIN review, then N replays in the same invocation.
3. Create, then drift, then repair in one lane (open question 5 of
   `w2-lab-live-create-flow`): build on the unarmed page, run on the armed
   variant, repair with a second grant, replay.
4. Typed Week 2 metrics, filled from Core's records rather than the Lab's
   bookkeeping:
   - `adaptationReuse`: exercised ids, provider calls, interventions;
   - `adaptationValidation`: tier, trials, replays;
   - `adaptationPersistence`: applied, revision;
   - `adaptationCost`: calls, tokens, USD, from `providerCalls`.
5. A `week2` corpus.
6. **L10's scripted provider should not be a proof.** The user's standing
   rule is that nothing is demonstrated until it runs against the real key.
   Keep a scripted double inside `packages/test-runner` tests for lane logic
   only, and do not put a scripted provider in Core `src`.

**Created Flow.** Its nodes carry the bootstrap id, so its first deterministic
runs promote the *creation*, exactly as they promote a repair.

**Repaired Flow.** Same, with the repair's id on the repaired or inserted nodes.

**Tests**

- `flow-change/tests/replay.test.ts`.
- A service test: run 2 has zero interventions and names the adaptation;
  after two runs the tier is `established`.
- Mutations: count a model-assisted run as a replay; drop the attempt stamp.

**Lab proofs.** Section 6.

### X6: Extraction repair

**What exists**

- The web domain declares `item` and `field.<key>` repairable for
  `web.output.dom-extract_list`
  (`domain/src/runtime/llm-evidence/repairable-parameters.ts:43-68`).
- The structure-detection tool and `extraction.N` handles exist for
  **authoring** (`domain/src/runtime/llm-evidence/structure/`).
- The extract node saves a dataset and validates `extractList` (`w2-extract-node-dataset`).

**What is missing**

1. **D-4: an extraction repair is saved but changes nothing.**
   - A resolved multi-parameter target is written as `targets: { item: … }`
     (`target-override.ts:156-170`).
   - Core writes the whole target into `parameterValues.target`
     (`adaptation-store.ts:405`; `live-patch.ts:488`).
   - Nothing reads `target.targets` (grep over `domain/src` outside tests: only
     the writer), and the extract dispatch reads `extractList.item`, not
     `target` (`domain/src/output-nodes/native-runtime.ts:66-72`).
   - So an "applied" extraction repair would run exactly as before. This is the
     same class of defect as the old `edit_recovery`.
   - Immediate fail-closed fix: stop declaring `extract_list` repairable
     through the target contract. The domain then answers
     `action_not_repairable`, which Core already has a word for
     (`live-patch.ts:56`).
2. Structure detection is not offered during a recovery. The five recovery
   options are inspect, reveal, act, wait and navigate
   (`domain/src/runtime/llm-evidence/harness-options/options.ts:55-115`).
3. The real repair is a **parameter override**: re-detect the list during
   exploration, then patch `{ extractList: { handle: "extraction.N" } }`,
   resolved by `resolvePlanNodeParameters` and checked by the extract node's
   parameter contract. That is the same path creation uses. The resolver must
   remember recovery-time packets and detections, keyed by project and Flow as
   today.
4. The verdict's `records` check (2.2) is what makes an extraction repair
   verifiable.
5. W04 `text-variant` is an output-shape change (a field reads the wrong
   thing), and its repair is also a parameter override. W08 `column-reorder` is
   a deterministic negative control: the model must not be asked. W04 and W08
   are the scoping report's rows; the *item-selector drift* variant does not
   exist yet.

**Lab proof**

- `product-catalog` with a new item-selector drift variant: a created Flow
  (built unarmed) fails with zero rows, is repaired by re-detection, the verdict
  basis is `records`, and two replays store 8 rows matching `extract-page-one`.

---

## 4. The third entry point: improving a Flow that is not blank

**What stops it today**

- `assertBlankBootstrapTarget` (`service.ts:4069-4078`) refuses any Flow that
  has nodes, edges, a Router or a Subflow. It is called at generation
  (`:1841`), creation (`:2042`) and apply (`:4110`).
- Normalization always mints a new Router and new Subflows
  (`AS/runtime/flow-bootstrap/adaptation.ts:92-150`).
- Apply creates them, and revert deletes what the adaptation owns
  (`service.ts:4224-4249`).
- The plan contract can only describe a whole new topology
  (`FB/contracts.ts:43-47`).

**Design: `mode: "extend"`, additive only**

1. **Contract.** The bootstrap adaptation gets `mode: "create" | "extend"`
   (default `create`). An extend plan is:

   ```ts
   type AutomationStudioFlowBootstrapExtension = {
     schemaVersion: "0.1"; mode: "extend";
     subflows: AutomationStudioFlowBootstrapSubflow[];     // new Subflows only
     routerRules: Array<{ key; name; targetSubflowKey; routeTags: string[] }>; // appended before the fallback
     branches: Array<{
       subflowId: string;        // an existing Subflow
       fromNodeId: string;       // an existing node
       fromPortId: string;       // a port that node declares and that has no edge yet, e.g. "failed"
       nodes: AutomationStudioFlowBootstrapNode[];
       edges: AutomationStudioFlowBootstrapEdge[];
       rejoinNodeId?: string;    // an existing node to continue at
     }>;
   };
   ```

   It never edits or deletes an existing node, edge, rule or Subflow.
   "Additive only" is what keeps revert exact and the risk bounded.
2. **Context for the model.** A new counts-and-names-only packet slot,
   `existingFlow`, for `flow_bootstrap` and `evidence_tool_decision` in extend
   mode:
   - each Subflow's id, name and role;
   - each node's id, definition id and `outputActionId`, and its open ports;
   - each Router rule's name and tags.

   It carries no parameters, selectors or values. It is bounded like the other
   packet slots (`AS/runtime/llm/harness/context-packet.ts`).
3. **Where an edge case comes from.**
   - The user writes an instruction ("also handle an empty search"), giving
     `origin.entryPoint = "edge_case"` with `instructionIds`.
   - Or a run ended in a state the Flow does not handle. Then `runId` and the
     run's `recoveryContext` summary (counts only) go into the packet, and the
     failure evidence goes into the exploration.
   - The difference from the run-failure entry is the *shape of the answer*:
     an additive branch or Subflow, not an edit of the failing node.
4. **Checks.**
   - Generation, creation and apply check that the target is an orchestration
     Flow **with** a Router whose revision matches the base. That uses the
     existing digest (`getLlmExecutionDependencyDigest`).
   - `pending` stays one per Flow.
   - Validation checks that every `fromNodeId` and `fromPortId` exists and is
     unwired, and that added nodes pass the same parameter validation and handle
     resolution as creation.
5. **Apply.**
   - New Subflow graphs are saved with their index (the fix in
     `service.ts:4150`).
   - Router rules are appended with a base-revision check.
   - Each branch is one typed graph transaction on its Subflow graph, built by
     the same `edit_insert_path`-style operation builder as 2.5. So an
     extension and a repair write graphs the same way.
   - Every added node carries `adaptationIds`.
6. **Revert.** Removes the added rules, deletes the owned Subflows, and applies
   each branch's stored inverse operations. It is refused if any of those
   changed, as creation's revert is today.
7. **Trial and replay.**
   - The trial runs the extended Flow in memory with the edge case present.
     Its changed nodes are the added nodes.
   - To reach `established`, the tier additionally needs at least one replay
     **on the original path** that does not traverse the added nodes. That is a
     regression check, and provenance shows which nodes a run exercised.

**What this reuses and what it adds**

- Reused unchanged: handle resolution, parameter contracts, in-loop completion
  check, the evidence loop, grants (`build_and_adapt`), the trial, the verdict,
  replay and tiers.
- New:
  - the extend plan contract and its validator;
  - the `existingFlow` packet slot and its prompt paragraph;
  - the additive apply and revert;
  - a mode flag on the generation endpoint.

**Out of scope for Week 2.** Router rule *conditions* beyond tags, which the
Phases table already says need a new contract. Most web edge cases (empty
results, an interstitial, a "load more") fit a branch on an existing port.

---

## 5. Defects and risks found while reading (new since the scoping reports)

| Id | Where | What | Confidence |
| --- | --- | --- | --- |
| D-1 | `domain/src/client/gateway-mapping.ts:243-248`, `domain/src/output-nodes/targets/targets.ts:61-69`, `apps/extension/src/content/action-runtime/resolve-target.ts:216-228` | A persisted repair on a **recorded** Flow dispatches the new selector with the stale recorded identity, and the veto can refuse the new match. Blocks the plan's next step 5 even with approve-then-rerun | Read, not run. Needs the failing content-harness row first |
| D-2 | `AS/runtime/adaptive-orchestrator.ts:72,189,207`; `AS/runtime/recovery/llm-invocation.ts:95-97`; `service.ts:2824-2845` (no status filter); `AS/runtime/recovery/stages.ts:159` | Any applied or approved adaptation on the same node suppresses the model for every later failure of that node, of any class. Nothing applies the "known" adaptation. A repaired node that drifts again is stuck | Read, not run |
| D-3 | `annotate.ts:288-311,352`; `patches.ts:89-94` | Exploration evidence never reaches the patch request or the target check | Read, not run |
| D-4 | `target-override.ts:156-170`; `adaptation-store.ts:405`; `native-runtime.ts:66-72` | An extraction repair is saved and applied, and changes nothing | Read, and confirmed by grep that `target.targets` has no reader |
| D-5 | `live-patch.ts:523` | A correct repair followed by an unrelated later failure is recorded `rejected` | Read |
| D-6 | `live-patch.ts:310` | The trial is capped at 50 steps, so a longer continuation (For Each over records) fails the trial | Read |
| R-1 | `service.ts:3239,3293` with `live-patch.ts:305-311` | On a no-grant adaptive run, the patch rerun executes the rest of the Flow, then the retry executes it all again from the top: double side effects | Read |
| R-2 | `AS/runtime/service/summaries/conversions.ts:30` | `llmCallCount` counts interventions, not provider calls. An iterating recovery makes more calls than interventions, so run summaries under-report | Read |
| R-3 | `domain/src/runtime/llm-evidence/tools.ts` (and `packages/test-runner/src/existing-fluxiq-control.ts`) | Contains a NUL byte (`grep` treats it as binary). A worker editing it needs a byte-safe method, as `w2-lab-live-create-flow` used | Observed |

---

## 6. Lab proofs (live, DeepSeek), in the order they become possible

1. **Repair, resume, replay in one run** (after Core briefs C-6, C-7, C-9 and
   Lab brief L-2):
   `pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm --llm-task repair --replays 2`.
   Pass means:
   - `harnessRecovery` shows an executed target override with verdict
     `verified`;
   - the run passes with `saveCount: 1` and the resume record set;
   - two replays pass with 0 provider calls, and their attempts name the
     adaptation;
   - the final tier is `established`.

   This needs defect D-1 fixed (web-domain brief W-1).
2. **The same variant under `--llm-task adapt`** (proposal-only):
   - the run fails as declared (the in-flux `flow-lane/repair/declared-repair.ts`);
   - the lane approves and applies, then replays pass.
3. **Create, then judge by data**, which the lane already supports:
   `create-flow` on `data-table-inventory` and `product-catalog-first-page`,
   plus the tier after the lane's deterministic run.
4. **Create, then drift, then repair, then replay** (after X6, domain brief
   W-3 and Core brief C-11): `product-catalog` item-selector drift, with the
   verdict basis `records`.
5. **Second drift after a repair** (after Core brief C-2): a second variant on
   the repaired node must reach the model again, not stop at "known
   adaptation".
6. **Improve an existing Flow** (after Core brief C-12): `product-catalog`
   `search` with its `no-results` variant, as an edge-case instruction on a
   created search Flow, an added branch on the extract node's `failed` port, and
   replays on both the results and no-results variants.
7. **Deterministic-first guard, kept:** W20-W23 stay at zero activations.

---

## 7. Where the scoping reports are now wrong

**`w2-scope-context-recovery`**

1. "`runtimePatchRestoredExpectedState` returns true when there is no
   comparison", and "any routed-`failed` attempt passes". Both are fixed:
   `verifyRuntimePatchOutcome` (`live-patch.ts:522-539`).
2. "`live-patch.ts:228` marks `validated` straight from `restoredExpectedState`".
   Now `adaptationStatusForVerification`: `testing` or `rejected` unless
   verified (`:378-382`).
3. "At run time there is no exploration loop". It exists and is wired
   (`annotate.ts:249-287`, `AS/runtime/recovery/runtime-exploration.ts`).
4. "The classifier is not a gate" and "the patch call runs unconditionally".
   Both wrong: `AS/runtime/recovery/llm-invocation.ts`; `annotate.ts:244-245`.
5. The call counts are all stale: "grant `diagnose_and_adapt` is exactly 2
   calls", "loop `maxToolCalls` ≤16", and "no whole-recovery wall-clock bound".
   Now the default is 26 calls, 64 at most, exploration 24/24, and a 600 s
   recovery deadline (`AS/runtime/recovery/recovery-deadline.ts`).
6. "`service.ts:2865-3169` `maybeAnnotateRunDetailWithRuntimeLlm`" and "6,807
   lines". Moved to `AS/runtime/recovery/annotation/annotate.ts`; `service.ts`
   is 6,422 lines.
7. "The target shape is a single `{selector}`" (E2). Now opaque handles plus a
   domain resolution (`structured-response.ts:95-127`).
8. "The shipped app never executes a runtime patch". An `explore_and_adapt`
   grant executes one through the API (`patches.ts:98-101`; `w2-core-contracts-and-docs`
   open question 1).
9. The recommended file names are superseded:
   - `recovery-context.ts` is `context.ts`;
   - `recovery-plan.ts` is `plan.ts`;
   - `recovery-trace.ts` is `trace.ts` and `stages.ts`;
   - the diagnosis is `deterministic-diagnosis.ts` and `structured-diagnosis.ts`.

   `recovery-verdict.ts` was never built. Its replacement is section 2.2 of
   this report, in `flow-change/`.

**`w2-scope-repair-reuse`**

10. "A never-executed proposal is recorded as a successful validation"
    (`live-patch.ts:285-290`). Wrong since Core `a2de143`: there is no
    validation result, and `metadata.structuralChecks` is written instead.
11. "The typed store treats any success as validated". It now requires an
    executed success or a named reviewer approval (`adaptation-store.ts:161-166`).
12. "`failureSignature` is never written", and "the classifier is called only
    from run summaries". Both wrong: `live-patch.ts:372,588-596`;
    `llm-invocation.ts`.
13. "`edit_recovery` is persisted into `parameterValues.recovery` and reads as
    applied". It is now refused by both appliers. The capability gap (no way to
    insert action nodes) remains.
14. "`isAutomationStudioRuntimeTargetOverrideTarget` requires exactly
    `{selector}`" and "`extract_list` targets are rejected". Wrong: handles;
    `item` and `field.*` are declared repairable. But see D-4: that repair is
    inert.
15. "The only runtime lane that reaches a model is `diagnose_and_adapt`".
    `explore_and_adapt` now exists and executes patches.
16. Line references into `service.test.ts:1501-1596` are stale, because the
    file was split (`w2-test-split`). Line references into
    `adaptation-store.ts:372-400` are now `:390-431`.
17. "All five Week 2 FluxBench metrics are typed `null`". `harnessRecovery` is
    now typed (`w2-lab-repair-outcome`).
18. **C2.9a (a scripted provider in Core `src`, wired where the web app builds
    the resolver) conflicts with the user's rule** that proof is live. Keep a
    double in Lab tests only.
19. "Gateway precedence is not verified". Still unverified, but now read far
    enough to call it a probable defect (D-1).

**Current State of the working document**

20. "Loop phases 2.4-2.9 and X6 are not started". Parts exist from Phase D and
    today's work:
    - the verification statuses (2.4);
    - `failureSignature` (2.5);
    - evidence-only gates and no fabricated validations (2.6);
    - the `harnessRecovery` contract, per-call records and zero-LLM certificates
      (2.9);
    - extraction targets declared repairable (X6), though inert.
21. **Next step 5.** "A correct repair there is a change proposal naming the
    renamed Save; the run itself still fails `target_not_found` because `adapt`
    proposes and does not retry." That is true. But the *applied* repair will
    probably also fail on replay until D-1 is fixed.

---

## 8. Work partition (briefs by file, in dependency order)

Legend:

- **Now**: touches no file another worker holds today, so it can start in
  parallel immediately.
- **After X**: wait for that brief, or for the named in-flux worker to land.
- "Core in-flux set": `service.ts`, `live-patch.ts`, `recovery/annotation/**`,
  `llm/harness-options/**`, `llm/evidence-loop.ts`, `loop-limits/**`,
  `service/**`.
- "Lab in-flux set": `flow-lane/**`, `live-llm/**`, `run-scenario.ts`.

### Core, wave 1: now, all in parallel

| Brief | Owns | Delivers | Depends |
| --- | --- | --- | --- |
| **C-1 change-verdict-and-tier** | new `AS/runtime/flow-change/{contracts,verdict,confidence,index}.ts`, `AS/runtime/flow-change/tests/{verdict,confidence}.test.ts`, one export line in `AS/runtime/index.ts` | Sections 2.1-2.5 as pure functions, with every rule and mutation listed. Also exports the neutral node-metadata key names (`adaptationIds`, `verifiesState`) | none |
| **C-2 known-adaptation-gate** (D-2) | `AS/runtime/adaptive-orchestrator.ts`, `AS/runtime/recovery/deterministic-diagnosis.ts`, `AS/runtime/recovery/stages.ts`, their tests (`AS/runtime/tests/adaptive-orchestrator.test.ts`, `AS/runtime/recovery/tests/{deterministic-diagnosis,stages}.test.ts`) | Match by `failureSignature` where present (node identity only for records without one). An `applied` adaptation whose node fails again is *not* known. A `validated` one is known and the trace names it. Failing test first: an applied repair plus the same node failing again gives `invoke: true` | none |
| **C-3 adaptation-record** | `AS/model/flow-adaptation.ts`, `AS/model/validation/adaptation.ts`, `AS/runtime/flow-bootstrap/adaptation.ts` and its tests | `validationResults[].kind/basis`, `origin`, bootstrap `origin`, `mode`, `validationResults`, and `adaptationIds` stamped by normalization | C-1 (types) |
| **C-4 executor-provenance** | `AS/runtime/executor/contracts.ts`, `AS/runtime/executor/node-execution.ts` (or `attempt-trace.ts`, whichever builds the attempt), `AS/runtime/executor/tests/` | Attempts carry `adaptationIds` from node metadata | C-1 (key name) |
| **C-5 graph-store-provenance-and-migration** | `AS/storage/project/graph-store.ts`, new `AS/storage/project/schema/<0020 file>.ts`, `AS/storage/project/schema/index.ts`, `AS/storage/project/adaptation-store.ts`, their tests | The `set_node_metadata` operation with an inverse; migration `0020` (`failure_signature`, `confidence_tier`, `origin_entry_point`, and an index); row mapping; typed apply stamps `adaptationIds` on changed nodes | C-3 |

### Core, wave 2: after the Core in-flux set lands; serial where marked

| Brief | Owns | Delivers | Depends |
| --- | --- | --- | --- |
| **C-6 trial** | `AS/runtime/live-patch.ts`, `AS/runtime/tests/live-patch.test.ts`, new `AS/runtime/flow-change/trial.ts` and its test | `trialAutomationStudioFlowChange`; live patch uses it. Per-node verdict (D-5), the run's remaining step budget (D-6), `observedState`/`expectedState`, `origin`, and the executed trace returned in memory | C-1, C-3, live-patch worker landed |
| **C-7 exploration-handoff** (D-3) | `AS/runtime/recovery/annotation/{annotate,exploration,patches}.ts` and their tests, `AS/runtime/llm/harness/{context-packet,task-request}.ts`, `AS/runtime/llm/deepseek-provider.ts` (prompt), `AS/runtime/llm/harness-options/binding.ts` (validator takes the explored packets), `AS/runtime/llm/tests/harness.test.ts` | An exploration evidence slot for `runtime_patch`; the target check runs against the failure packet plus explored packets | C-6; annotation and harness-options workers landed. **Serial before C-9** (same files) |
| **C-8 promotion-gates** | `AS/runtime/recovery/adaptation-promotion.ts`, `AS/runtime/training-modes.ts`, their tests | Count only `trial` and `replay`; the tier replaces the numeric score; a bootstrap apply gate helper | C-1, C-3. Can run beside C-6 |
| **C-9 resume** | new `AS/runtime/flow-change/resume.ts` and its test; `AS/runtime/recovery/annotation/{annotate,patches}.ts` (return the in-memory trial trace); `AS/runtime/service.ts` (replace both retry call sites; move `retryRuntimeSessionAfterAutoAppliedPatch` into `flow-change/resume.ts` to offset the frozen baseline; keep executed values from `onExecutedTrace`); the service-level counter test | Section 3, Phase 2.8; the `resume` record; R-1 removed | C-4, C-6, C-7 |
| **C-10 replay-recorder** | new `AS/runtime/flow-change/replay.ts` and its test; `AS/runtime/service/summaries/{conversions,store}.ts` (`adaptationsExercised`, R-2 `llmCallCount`); `AS/runtime/service/adaptations/{durable,patches}.ts` (legacy stamping); `service.ts` (one call after the run detail is saved) | Section 3, Phase 2.9 item 1 | C-5, C-8, C-9 (serial on `service.ts`); `service/**` worker landed |

### Core, wave 3: new capability; serial on shared unions

| Brief | Owns | Delivers | Depends |
| --- | --- | --- | --- |
| **C-11 insert-path-and-parameter-override** | `AS/runtime/llm/harness/structured-response.ts`, its schema in `deepseek-provider.ts`, `AS/runtime/live-patch.ts` (apply both kinds to the copy), `AS/model/flow-adaptation.ts` (`edit_insert_path`, `edit_node_parameters`), `AS/storage/project/adaptation-store.ts` (operation builders), `AS/runtime/training-modes.ts` (structural list), a handle-resolution call through `binding.resolvePlanNodeParameters`, and tests | Section 3, Phase 2.5 items 2-3 | C-6, C-7, C-5. Serial after C-8 on `training-modes.ts` |
| **C-12 bootstrap-trial-and-extend** | `AS/runtime/flow-bootstrap/plan/*` (extend contract and validation), `AS/runtime/flow-bootstrap/adaptation.ts` (additive normalization), `AS/runtime/llm/harness/context-packet.ts` (the `existingFlow` slot), `AS/runtime/service.ts` (target check by mode, `trial` review action, additive apply and revert; extract the graph-options builder at `service.ts:3123-3141` into `AS/runtime/service/runtime-graph-options.ts` to offset), `AS/api/**` (the mode flag on generation), and tests | Section 3, Phase 2.6 item 4, and section 4 | C-6, C-9, C-11. Serial last on `service.ts`. Docs: Core's `docs/architecture/automation-studio/llm-flow-bootstrap.md` |
| **C-13 docs** | Core `docs/architecture/automation-studio.md`, `automation-studio/persistence.md`, `llm-flow-bootstrap.md` | The trial, verdict, tiers, resume, replay and extend mode | after C-12 |

### This repository, domain: now, in parallel

| Brief | Owns | Delivers | Depends |
| --- | --- | --- | --- |
| **W-1 repair-precedence** (defect D-1) | `domain/src/client/gateway-mapping.ts`, `domain/src/output-nodes/targets/targets.ts`, their tests, and one row in `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | Section 3, Phase 2.7 item 1, with the failing row first | none. The content-script **source** is in flux, but this brief only reads it |
| **W-2 extraction-repair-fail-closed** (defect D-4, part 1) | `domain/src/runtime/llm-evidence/repairable-parameters.ts`, `target-override.ts`, their tests | `extract_list` answers `action_not_repairable` until W-3 lands | none |
| **W-3 recovery-detection-and-packets** (defect D-4, part 2) | `domain/src/runtime/llm-evidence/harness-options/{options,execute,vocabulary}.ts`, `domain/src/runtime/llm-evidence/plan-resolution/{target-packets,resolve-plan-node}.ts`, `domain/src/runtime/llm-evidence/structure/handles.ts`, and tests | Detection offered at `gather`/`iterate`; recovery packets and detections remembered for resolution | W-2; `tools.ts` needs byte-safe edits (R-3) |
| **W-4 verification-verbs** | `domain/src/output-nodes/definitions.ts` and its tests (plus `domain/src/tests/domain.test.ts` if it pins metadata) | `metadata.verifiesState: true` on assert, wait-for-text and wait-for-selector | C-1 (key name) |

### This repository, Lab

| Brief | Owns | Delivers | Depends |
| --- | --- | --- | --- |
| **L-1 week2-contracts** (now) | `packages/test-contracts/src/{evaluation,evaluation-validation,harness-recovery,harness-recovery-validation}.ts`, a new `packages/test-contracts/src/adaptation-reuse.ts` and its validation, `bench-report.ts`, tests; `packages/test-runner/src/bench/evaluate-run.ts` (the one-line parity fix) | Typed `adaptationReuse`, `adaptationValidation`, `adaptationPersistence` and `adaptationCost`; `harnessRecovery.verdict` | none |
| **L-2 repair-lane** | `packages/test-runner/src/live-llm/{live-llm-plan,live-llm-run}.ts`, `packages/test-runner/src/flow-lane/repair/*`, `packages/test-runner/src/flow-lane/harness-recovery.ts`, `packages/test-runner/src/run-scenario.ts`, `packages/test-runner/src/commands.ts`, `packages/test-runner/src/cli.ts`, tests | `--llm-task repair` (`explore_and_adapt`); approve, apply and `--replays N` for `repair` and `adapt` | L-1, and the Lab in-flux set landed. Full value after C-9 and W-1 |
| **L-3 reuse-observation** | `packages/test-runner/src/flow-lane/{persisted-flow-run,lane-observation,run-flow-lane}.ts`, `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`, tests | Fill the four metrics from run detail (`resume`, `adaptationsExercised`, `providerCalls`, the adaptation tier) | L-1, L-2 (serial on `flow-lane`), C-10 |
| **L-4 create-then-repair** | `packages/test-runner/src/flow-lane/creation/{lane,review-proposal,snapshot}.ts`, tests | A second grant, the variant armed for the run, repair, replay; a creation `trial` once C-12 lands | L-2, L-3 (serial on `flow-lane`) |
| **L-5 week2-corpus-and-fixtures** (now) | `apps/scenario-lab/src/scenarios/product-catalog/*` (item-selector drift variant), a new side-effect-counter scenario directory, `apps/scenario-lab/src/scenarios/live-instructions.ts` (edge-case and repair tasks), `packages/test-runner/src/bench/corpus/week2.ts`, `packages/test-runner/src/bench/corpus/find-bench-corpus.ts`, tests | Fixtures for Lab proofs 1, 4, 5 and 6 | none |
| **L-6 campaign-accounting** | the campaign runner's summary reader (path from `w2-live-campaign-catalog`, not read here) | Read `build.accounting` for create-flow bundles | none |

**The order in one line.** C-1, C-2, C-4, W-1, W-2, L-1 and L-5 start now. C-3
and W-4 follow C-1, and C-5 follows C-3. When the Core in-flux set lands: C-6
and C-8, then C-7, C-9, C-10, C-11 and C-12, then C-13. W-3 follows W-2. When
the Lab in-flux set lands: L-2, L-3 and L-4. L-6 can start at any time.

Nine can start at once: C-1, C-2, C-4, W-1, W-2, L-1, L-5, L-6, and C-3 as soon
as C-1's type names are fixed. With the recorded limit of five concurrent heavy
workers, start C-1, C-2, W-1, W-2 and L-1 first. C-4, C-3, L-5 and L-6 take the
next free slots.

---

## Commands run and observed results

All read-only.

- `ls` of Core `AS/runtime/`, `recovery/`, `recovery/annotation/`, `service/`,
  `service/adaptations/`, `flow-bootstrap/`, `flow-bootstrap/plan/`,
  `executor/`, `llm/`, `llm/harness-options/`, `loop-limits/`, and
  `storage/project/schema/`.
  - Printed the file lists used above.
  - `AS/runtime/` has 30 entries: 23 files and 7 directories.
- `wc -l` on 50 Core files. Relevant results:
  - `live-patch.ts` 600;
  - `service.ts` 6,422;
  - `adaptation-store.ts` 487;
  - `annotate.ts` 364;
  - `patches.ts` (annotation) 146;
  - `flow-bootstrap/adaptation.ts` 246;
  - `training-modes.ts` 341;
  - `adaptive-orchestrator.ts` 248.
- Core `git status --short`, `git diff --stat`, and `git diff live-patch.ts`.
  - The uncommitted set is 25 modified and 14 untracked files, matching the
    brief's in-flux list.
  - The `live-patch.ts` diff adds the refusal reasons and `outputId` on the
    failed action.
- Core `git log --oneline | head -15`: HEAD `59dbb22`.
- This repository `git status --short` for `packages/test-runner/src/flow-lane`,
  `live-llm` and `run-scenario.ts`. It shows the other workers' changes and the
  untracked `flow-lane/creation/`, `flow-lane/repair/` and
  `live-llm/build-usage.ts`.
- Grep and Read over the files cited.
  - The grep for `.targets` readers in `domain/src` outside tests found only
    the writer (`target-override.ts:168`) and unrelated names in
    `plan-resolution`.
  - `grep` reported `tools.ts` as a binary file; `grep -a` read it.
- No build, test, Lab, demo, panel or provider call was run. Nothing printed
  `.fluxiq` contents, tokens or page data.

## Not verified

- **Every defect in section 5 comes from reading.** D-1 in particular needs the
  content-harness row to fail before anything is changed.
- **The records-summary shape.** Whether `AS/runtime/executor/record-summary.ts`
  exposes a per-node captured count the verdict can read. That file was not
  read.
- **Exploration steps.** Whether `AutomationStudioLlmEvidenceLoopTrace` steps
  carry `effect` and a result code, which 2.5's reduction needs.
- **The Lab proof fixtures.** Whether `identity-drift`'s primary workflow has
  an assert step (the `downstream_assertion` basis in Lab proof 1), and which
  `modal-flows` or `failure-surfaces` variant fits 2.5's overlay proof.
- **Graph store records.** Whether `AutomationStudioGraphNodeRecord` carries
  `metadata`, which `set_node_metadata` needs.
- **The web panel's review UI** for a `trial` action or tier display was not
  read. `apps/web` changes are implied by C-8 and C-12 and are not partitioned
  in detail.
- **The working document.** Beyond Current State and the Phases rows I read
  nothing, per the brief. The archived settled decisions (L1-L16) were not
  read, so the tier names and the "no resume after approval" recommendation
  have not been checked against them.
- **Uncommitted code.** The in-flux files were read as they stood. The Core
  handle-resolution hook, completion check, graph index fix and run-detail
  merge are uncommitted and may still change.

## Open questions or contradictions found

1. **Creation trial before apply, or first run as the trial?** Recommended:
   before apply (section 3, Phase 2.6 item 4), so both entry points validate
   before they persist. It adds a service action that runs real page actions
   under the Flow's side-effect policy.
2. **Resume after a person approves** is recommended *not* to be built for
   Week 2. The proposal-only path's evidence of reuse is the next run's replay.
   If the MVP's "continue the current workflow" is read as covering approval,
   this needs a domain input-state predicate and is a larger change.
3. **`validated` means two things.** For a runtime adaptation it is set by a
   reviewer's `approve` (`service.ts:4025`) and also by a verified rerun
   (`live-patch.ts:379`). For a bootstrap adaptation it means approved only.
   C-2 and C-8 should read tiers and `metadata.review.approvedBy`, never the
   status word.
4. **An `explore_and_adapt` grant already executes patches through the API**
   (`w2-core-contracts-and-docs` open question 1, still unconfirmed by the
   user in anything I read). The repair lane (L-2) depends on it. That report's
   gap still applies: a Flow policy that allows side effects without approval
   would live-run a side-effecting patch.
5. **The Phases table says the first loop increment needs no new authoring
   contract.** Sections 3 (2.5) and 4 add three (`temporary_insert_path`,
   `temporary_parameter_override`, and the extend plan). They reuse the
   bootstrap node contract rather than invent a new one, which is the reason to
   accept them. X6 cannot be done without the parameter override.
6. **L10 (a scripted test provider) conflicts with the user's
   validate-with-the-real-provider rule** if it is meant as proof. Recommended:
   a test double inside `packages/test-runner` only.
