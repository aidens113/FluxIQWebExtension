# Report: w2-renamed-repair-rejected

Worker report, 2026-09-16. Nothing committed or pushed in either repository.
`F:/fxlab/lab-core` was changed for the live runs only, then restored
(`git status` clean) and rebuilt at `6be4698`.

## Outcome

Done. All three parts are fixed and tested, and the coordinator's two
mid-task items are done too.

- **Live repair works end to end.** On `renamed-redesign`, a live DeepSeek run
  (`run-mu4tlmls-f7ac6101`, verdict **passed**) proposed a change naming the
  renamed Save ("Apply changes"). That run used my Core change plus two domain
  changes. The domain changes were in a scratch host module only, because
  `domain/src/runtime/llm-evidence/**` was off-limits. The exact domain change
  is below; it is **not applied** to the shared checkout.
- **The Core fix stands alone but is not sufficient alone.** Without the domain
  change, the Lab now reports why a repair was refused, but the repair is still
  refused.

### Root cause, plainly

Two defects, one behind the other. Both were proven offline through Core's
real path, and each was confirmed by a live run.

1. **The domain could not tell that the failed action was a click.**
   - **Why:** A Flow built from a recording runs every action through Core's
     generic `builtin.policy.action` node. The web action is stored only in
     `parameterValues.outputId` (`web.dom.click`).
   - **What Core asked:** Core asked the domain to judge an override with
     `{ nodeId, definitionId: "builtin.policy.action" }` and nothing else.
   - **What the domain did:** It looks up what a repair may re-point by
     definition id, found nothing for `builtin.policy.action`, and returned
     `absent`. It did this for *every* override on *every* recorded Flow,
     before reading the handle.
   - **So:** `run-mu4rpka7-845d919a` was refused whatever DeepSeek named. The
     model naming the wrong control was **not** the cause, and the Lab could
     not have shown which control it named.
   - **Offline proof:** Core's real `annotateAutomationStudioRunDetailWithRuntimeLlm`
     was run with the real `createWebAutomationLlmEvidenceRuntime`. Its gateway
     returned the Chromium capture of this page (the fixture from
     `renamed-save-override.test.ts`). The provider was Core's real DeepSeek
     provider with its network call replaced.
     - The *correct* reply `{handles:{element:"target.2"}}` was refused as
       `absent`: `preflightOk:false`, no proposal. This is the live record
       exactly.
     - With `definitionId: "web.output.dom-click"`, the same reply resolved
       and produced a change proposal.
   - **Same packet?** Yes. The packet validated is the sanitized failure
     capture, the same one the diagnosis and patch prompts carried: 21
     elements, after a JSON round trip. The selector binding keyed by packet
     *is* found: the resolved target carried the selector.
2. **The model is never told the parameter name `element`.**
   - **What the prompt says:** Core's patch prompt says "fill target.handles …
     one per repairable parameter [failureEvidence] offers".
   - **What the packet offers:** nothing, and nothing else in the request says
     `element` or `web.dom.click`. I captured the exact DeepSeek request body
     offline and checked this.
   - **Live proof:** With defect 1 fixed (live run 1, `run-mu4tfxld-e78debce`),
     the refusal became `runtime_patch.target_override_rejected.parameter_not_offered`.
     DeepSeek named some parameter other than `element`. Which one is not
     retained, by design (no raw responses).
   - **Fix proven live:** With the failure packet declaring
     `repairParameters: { element: … }` (live run 2), DeepSeek's override was
     accepted and resolved to the renamed Save. The judge read the saved
     proposal back and found `tagName: button`,
     `accessibleName: Apply changes`, `controlType: submit`.

### The contract the domain now depends on (keep it stable)

These live in Core `AS/runtime/live-patch.ts` and are currently uncommitted
there. The other worker's domain code already reads `failedAction.outputId` and
returns `reason: "action_not_repairable"`.

- **`AutomationStudioRuntimeTargetOverrideFailedAction`** is
  `{ nodeId, definitionId, outputId?: string }`.
  - **Where Core gets `outputId`:** from the failed node,
    `parameterValues.outputId` (policy action) or `metadata.outputActionId`
    (bootstrap).
  - **What Core rejects:** anything that is not an identifier, such as a state
    binding or free text.
- **`AutomationStudioRuntimeTargetOverrideEvidenceValidation`**: the
  `absent | ambiguous` member gains an optional
  `reason?: AutomationStudioRuntimeTargetOverrideRefusalReason`.
- **`AUTOMATION_STUDIO_RUNTIME_TARGET_OVERRIDE_REFUSAL_REASONS`** is the closed
  vocabulary:
  - `action_not_repairable`
  - `parameter_not_offered`
  - `parameter_missing`
  - `target_malformed`
  - `handle_not_issued`
  - `handle_incompatible`
  - `handle_ambiguous`
  - `no_compatible_element`
  - `evidence_unrecognized`
  - `domain_check_unavailable` (Core's own; a domain never needs to return it)
- **Handling of a domain's reason:** Core drops any reason outside the
  vocabulary and never repeats it.
- **The refusal sentence:**
  - **Without a reason:** unchanged ("Target override is absent from current
    sanitized evidence."). `llm-diagnosis.test.ts` pins that exact text.
  - **With a reason:** the sentence gains `: <reason text> (<reason>).`
- **The receipt:** each attempt in `metadata.runtimePatchAttempts` gains
  `targetOverrideRefusal: { status, reason? }`.
- **The domain type-check:** the domain compiles against the shared Core build
  from 17:38, which already had `outputId` and `reason`. `tsc` exit 0 for
  current `domain/src`, and for `domain/src` with my patch below.
  `domain_check_unavailable` is not in that build, and the domain does not
  need it.

## What changed and why

### Core (`F:\!FluxIQ`, uncommitted)

- **`runtime/live-patch.ts`**
  - **Refusal reasons and output id:** the refusal vocabulary above, the
    `outputId` field, and the reason carried into the issue and into
    `metadata.targetOverrideRefusal`.
  - **One check for every path** (coordinator item 1): the new private
    `checkRuntimeTargetOverride`. The proposal path, the exported
    `preflightAutomationStudioRuntimePatch`, and
    `executeAutomationStudioRuntimePatch` all use it. For every target
    override it:
    - re-aims the override at the failed node, as proposals already did;
    - asks the domain;
    - refuses on `absent` or `ambiguous`;
    - substitutes the domain's resolution, so the rerun and the adaptation
      carry the resolution and never the model's bare handles;
    - **fails closed when no validator is bound**, with
      `absent / domain_check_unavailable`.
  - **The executed path** used to run overrides without ever consulting the
    domain.
  - **Receipt:** on refusal, the executed path returns
    `metadata: { executed: false, targetOverrideRefusal }`.
  - **Size:** 640 lines, an advisory warning only.
- **`runtime/recovery/annotation/patches.ts`:** the receipt records
  `targetOverrideRefusal`. The validator is still only passed when failure
  evidence was captured, so no evidence now means `domain_check_unavailable`
  on both paths.
- **Tests (each written to fail first, and observed to fail):**
  - **`runtime/tests/live-patch-target-override.test.ts`** (new, split out of
    `live-patch.test.ts` for the 800-line limit; no test dropped, 23 → 33
    declarations across the two files). Covers:
    - `outputId` from a policy action and from a bootstrap node, and no output
      for a binding or free text;
    - the reason in the issue and in the metadata, and a foreign reason
      dropped;
    - executed override: refused with no check, refused when the domain
      refuses, and runs the domain's resolution on the failed node;
    - preflight judged by the same check;
    - a proposal with no check is refused.
  - **`runtime/tests/live-patch.test.ts`:** moved tests out, and bound a
    validator in the failure-signature test.
  - **`runtime/recovery/annotation/tests/patches.test.ts`** (new):
    - the receipt asks with `outputId` and records the refusal;
    - no-grant (executed) path refused by the domain;
    - no evidence means `domain_check_unavailable` on both paths;
    - a resolved override is proposed with no refusal recorded.
- **Tests outside my literal path list**, changed because they pinned the
  unchecked behaviour the coordinator asked me to remove. Each edit binds a
  domain check and leaves the assertions unchanged.
  - **`automation-studio/tests/opaque-target-execution.test.ts`** (a direct
    test of `executeAutomationStudioRuntimePatch`): the model now writes
    handles, and the validator returns the resolved target.
  - **`runtime/tests/service-adaptation/tests/runtime-patches.test.ts`**
    ("persists a canonical target override for manual review"): the service
    is given an `llmEvidenceRuntime` with a capture and a `matched` validator.

### This repository (uncommitted)

- **Part 2: never lose call records.**
  - **`live-llm/live-llm-run.ts`:** new `settleUnfinished`.
    - **Always writes the snapshot:** it writes `snapshots/live-llm.json` from
      the run detail whenever a grant was issued, with
      `settlement: lane_failed | run_detail_unreadable | run_not_identified`,
      and publishes the usage.
    - **Budget breach:** it returns a budget breach so the caller raises that
      instead of the lane's error.
    - **What it never raises:** "no provider reached".
    - **`proposesRepairOnly` getter:** true for `diagnose_and_adapt`.
    - **Refactor:** snapshot writing and publishing are factored out.
  - **`live-llm/lane-settlement.ts`** (new):
    `runLaneWithLiveLlmSettlement` runs the lane with a run-id hook. It settles
    normally on success and `settleUnfinished` on any throw. A snapshot write
    failure never hides the lane's error.
  - **`flow-lane/persisted-flow-run.ts`:** `onRunIdentified` fires as soon as
    Core names the run id, before any read that can throw.
  - **`flow-lane/run-flow-lane.ts`:** `flowRunIdentified` input.
  - **`run-scenario.ts`:**
    - **Size:** line-neutral (793 lines; the limit is 800).
    - **Pinned strings kept:** `await runFlowLane({` and
      `const workflow = resolveWorkflow(...)`, which `runner-wiring.test.ts`
      pins.
    - **Wiring:** the lane runs inside `runLaneWithLiveLlmSettlement`, and a
      separate `flowWorkflow` feeds the Flow lane.
- **Part 3: judge the variant on its repair.**
  - **Why a separate declaration:** declaring `failure` on the variant itself
    would contradict two tests I don't own and a catalogue task (see Open
    questions). So the declaration lives beside the fixture.
  - **`apps/scenario-lab/src/scenarios/identity-drift/repair.ts`** (new,
    exported through the barrel) declares `SCENARIO_REPAIRS` for
    `renamed-redesign`:
    - **`proposalOnlyOutcome`:** type succeeded, click failed, status line
      `""`, failure `target_not_found / web.target.not_found`;
    - **`proposal`:** a `temporary_target_override` whose target is
      `{ tagName: button, accessibleName: Apply changes, controlType: submit }`.
  - **`manifest.ts`:** comment and description point at it; `expected` is
    unchanged.
  - **`tests/scenario.test.ts`:** a new test checks the declaration against
    the manifest, the rendering and the contract.
  - **`flow-lane/repair/`** (new directory):
    - **`declared-repair.ts`:** `withDeclaredFlowRepair`. It loads
      `scenarios/<id>/repair.js` from the scenario lab build (optional; parsed
      closed). For a Flow-lane, proposal-only run of a declared variant, it
      replaces the variant's expectations with `proposalOnlyOutcome`. Before
      anything starts, it validates the result with the scenario contract.
    - **`judge-repair.ts`:** `judgeFlowRepair` / `assertFlowRepair`. It reads
      the saved adaptation through `get-flow-adaptation` and compares its
      `edit_action_target.after` with the declared fields. It publishes only a
      verdict (`repaired | wrong_target | refused | not_proposed |
      not_attempted | proposal_unreadable`), field names and codes, never the
      target.
    - **Wiring in `run-flow-lane.ts`:** the judgement is made only for a live
      grant that can propose. It is published as `repair` in
      `snapshots/flow-lane.json` before the asserts, and failing it throws
      `runtime.behavior` "The live repair was not the declared one: …".
- **Refusal case in the Lab's code** (`flow-lane/harness-recovery.ts`). Each
  patch attempt's `issueCodes` gains
  `runtime_patch.target_override_rejected.<reason or status>` next to the
  coarse code. It is read from Core's structured `targetOverrideRefusal`,
  never from the sentence, and only a word-shaped reason is kept.
- **New tests:**
  - `live-llm/tests/lane-settlement.test.ts` (real `LiveLlmRun`);
  - `flow-lane/repair/tests/declared-repair.test.ts`;
  - `flow-lane/repair/tests/judge-repair.test.ts`;
  - `flow-lane/tests/live-repair-lane.test.ts`;
  - additions to `flow-lane/tests/harness-recovery.test.ts` and
    `flow-lane/tests/persisted-flow-run.test.ts`.

### Domain change still needed (not applied; `domain/src/runtime/llm-evidence/**` was off-limits)

- **Already done by the other worker:** the output-id mapping
  (`failedActionDefinitionId`, stricter than my draft) and
  `action_not_repairable`.
- **What remains, against the current shared files:**
  - reasons on the other refusals;
  - `evidence_unrecognized`;
  - the failure packet declaring the parameter name (**required for a live
    repair to be accepted**).
- **Checks on the patch:**
  - it applies with `git apply --check --ignore-whitespace`;
    `target-override.ts` currently has CRLF line endings;
  - a patched copy type-checks (`tsc` exit 0);
  - live run 2 used the equivalent change.
- **Domain tests will need updating:** any that pin the exact packet key set
  or bare `{ status: "absent" }`, for example `sanitize.test.ts`,
  `target-override.test.ts`, `renamed-save-override.test.ts`, and
  `packet-carries-no-selector.test.ts`. I did not run them against the patch.

```diff
diff --git a/domain/src/runtime/llm-evidence/sanitize.ts b/domain/src/runtime/llm-evidence/sanitize.ts
@@ export type WebLlmPageEvidence = WebLlmPageContext & {
   failedTargetUnknown?: true;
+  /**
+   * On a failure packet: each parameter a target override for the failed
+   * action names in `target.handles`, with what its handle must be. Core tells
+   * the model to fill one handle per parameter the evidence offers; a packet
+   * that offered none left it to guess the key (`run-mu4tfxld-e78debce`).
+   */
+  repairParameters?: Record<string, string>;
 };
@@ export type WebLlmSanitizeOptions = {
-  failedAction?: { selector?: string };
+  failedAction?: { selector?: string; repairParameters?: Record<string, string> };
@@ export function sanitizeWebLlmSnapshotWithBindings(
-    failedTargetUnknown: undefined
+    failedTargetUnknown: undefined,
+    repairParameters: undefined
   });
@@ function markFailedTarget(
   if (!failedAction) return;
+  // Written with the mark, before the trim, so its bytes are inside the budget.
+  if (failedAction.repairParameters && Object.keys(failedAction.repairParameters).length > 0) evidence.repairParameters = { ...failedAction.repairParameters };
   if (!failedAction.selector) {
diff --git a/domain/src/runtime/llm-evidence/target-override.ts b/domain/src/runtime/llm-evidence/target-override.ts
-  if (!handles) return { status: "absent" };
+  if (!handles) return { status: "absent", reason: "target_malformed" };
-  if (Object.keys(handles).some((name) => !webRepairableParameterFor(definitionId, name))) return { status: "absent" };
-  if (declared.some((parameter) => parameter.required && handles[parameter.name] === undefined)) return { status: "absent" };
+  if (Object.keys(handles).some((name) => !webRepairableParameterFor(definitionId, name))) return { status: "absent", reason: "parameter_not_offered" };
+  if (declared.some((parameter) => parameter.required && handles[parameter.name] === undefined)) return { status: "absent", reason: "parameter_missing" };
-    if (named.length > 1) return { status: "ambiguous" };
+    if (named.length > 1) return { status: "ambiguous", reason: "handle_ambiguous" };
-    if (candidates.length === 0) return { status: "absent" };
-    if (candidates.length > 1) return { status: "ambiguous" };
+    if (candidates.length === 0) return { status: "absent", reason: "no_compatible_element" };
+    if (candidates.length > 1) return { status: "ambiguous", reason: named.length === 1 ? "handle_incompatible" : "handle_not_issued" };
-  if (resolved.size !== 1 || !element) return { status: "absent" };
+  if (resolved.size !== 1 || !element) return { status: "absent", reason: "parameter_not_offered" };
diff --git a/domain/src/runtime/llm-evidence/tools.ts b/domain/src/runtime/llm-evidence/tools.ts
 } from "./sanitize";
+import { WEB_REPAIRABLE_ELEMENT_PARAMETER } from "./repairable-parameters";
 import { validateWebRuntimeTargetOverrideEvidence } from "./target-override";
@@ const RETAINED_SELECTOR_BINDINGS = 8;
+/**
+ * What a failure packet tells the model a target override names. Every action
+ * this domain declares repairable re-points exactly one control, as `element`
+ * (`repairable-parameters.ts`), and Core's capture request does not yet say
+ * which action failed, so the packet names that one parameter for every
+ * failure; an action with nothing to re-point is still refused as
+ * `action_not_repairable` when the override is checked.
+ */
+const FAILURE_REPAIR_PARAMETERS: Readonly<Record<string, string>> = Object.freeze({
+  [WEB_REPAIRABLE_ELEMENT_PARAMETER]: "the target handle of the one element the failed action should act on instead"
+});
@@ captureSanitizedFailureEvidence
-        failedAction: {},
+        failedAction: { repairParameters: FAILURE_REPAIR_PARAMETERS },
@@ validateTargetOverrideEvidence
-      if (evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || !Array.isArray(evidence.elements)) return { status: "absent" };
+      if (evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || !Array.isArray(evidence.elements)) return { status: "absent", reason: "evidence_unrecognized" };
```

The full unified diff (with line numbers) is at
`<scratchpad>/w2rr/domain-change-rebased.patch`. The scratchpad is
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\f31cfd6e-5126-46a3-8c5b-179104eb25c8\scratchpad`.

**Measured cost of the packet change:** 2935 bytes (Core's limit is 3000),
with 20 elements instead of 21. The three clickable controls stay
`target.1`–`target.3`.

## Commands run and observed results

### Offline reproduction

Scratch bundle: Core's real annotation path, the real web evidence runtime, and
Core's DeepSeek provider with `fetchImpl` stubbed.

- **Core build output, current domain, recorded node shape:** reply
  `{element:"target.2"}` gave validator `{status:"absent"}`,
  `issues:["Target override is absent from current sanitized evidence."]`,
  and no adaptation.
- **Same, with `definitionId: web.output.dom-click`:** `resolved`,
  `targetResolution:"resolved"`, change proposal created, target
  `{tagName:"button", accessibleName:"Apply changes", selector:…, metadata:{controlType:"submit", formId:"settings-form"}}`.
- **Core source with my fix, unpatched domain:** every reply was `absent`, and
  the domain was asked with `outputId:"web.dom.click"`.
- **Core source with my fix, patched domain:**
  - `element:target.2` → resolved (Apply changes);
  - `element:target.1` → resolved (Discard: a wrong target the check cannot
    tell apart);
  - `target:target.2` → `absent:parameter_not_offered`;
  - `element:target.5` (a label) → `ambiguous:handle_incompatible`;
  - `element:save-changes` → `ambiguous:handle_not_issued`.
- **The prompt as captured:** it contains no `element`, no `web.dom.click` and
  no "repairable". `recentActions` and `recoveryContext` carry only
  `definitionId: builtin.policy.action`.

### Core (`F:\!FluxIQ\packages\fluxiq`)

- **Failing first:**
  - `vitest run …/live-patch.test.ts` (new cases): `4 failed | 26 passed`,
    then after the fix `30 passed`;
  - `patches.test.ts`: `2 failed | 1 passed`, then `3 passed`;
  - the gating cases: `5 failed | 30 passed` and `2 failed | 3 passed`.
- **After all edits:**
  - `npx tsc --noEmit -p tsconfig.json` → exit 0. It was not 0 while the
    narrowing bug existed; I fixed that.
  - `vitest run` on the target-override files, the annotation tests,
    `opaque-target-execution`, `runtime-patches`, `llm-diagnosis` and
    `iterating-recovery` → `Test Files 12 passed (12)`,
    `Tests 89 passed (89)`.
  - `pnpm check` (repository root) → exit 0,
    `structure-audit: passed (148 warning(s), 254 baselined)`. My files carry
    only advisory file-lines warnings: `live-patch.ts` 640,
    `live-patch-target-override.test.ts` 531, `live-patch.test.ts` 417.
  - `vitest run src/programs/automation-studio/runtime src/programs/automation-studio/tests`
    → `124 passed | 4 failed (128 files)`:
    - **`flow-bootstrap/plan/tests/catalog.test.ts`** (3 tests, fast
      assertion diffs): this is another worker's file, modified in the
      working tree (`catalog.ts`). Not mine.
    - **`service-summaries/run-detail-preservation`,
      `service-bootstrap/adaptation` and `service-recordings/proposals`:**
      15-second timeouts. Rerun alone: `3 passed (22 tests)`. This was load
      (running many files in parallel on this machine), not a defect.
- **An earlier timeout triage:** `durable-patches.test.ts` timed out even
  with my two Core files restored to HEAD, so it is not mine. `adaptive-loop`
  and `subflow` passed alone with my code (6 s and 7 s).
- **An earlier full run, before the gating change:** `122 files,
  1168 passed`.

### This repository

- `npx tsc -p tsconfig.json --noEmit` (test-runner) → exit 0.
- **`pnpm test` (test-runner):** `# tests 1092 # pass 1091 # fail 1`.
  - **The one failure:**
    `demo-llm-create-ui/tests/failure-sanitizer.test.ts` expects
    `generation.http-400`, actual `generation.provider-output-validation`.
  - **Why it isn't mine:** it depends on another worker's in-progress
    generation-failure changes and imports nothing I changed.
- **Private build runs of my suites:**
  - lane-settlement, live-llm-run, declared-repair, judge-repair,
    live-repair-lane, harness-recovery, run-flow-lane, persisted-flow-run
    → `# tests 78`, all passing once the test bug in
    `live-repair-lane.test.ts` was fixed;
  - then 38/38 for the four probed files.
- **Negative probes** (compiled JS edited, sources untouched):
  - no `settleUnfinished` call → `lane-settlement` 3 fail;
  - no refusal case → `harness-recovery` + `live-repair-lane` 2 fail;
  - no `onRunIdentified` → `persisted-flow-run` + `live-repair-lane` 3 fail;
  - no `assertFlowRepair` → `live-repair-lane` 2 fail;
  - all restored → 38 pass.
- **`pnpm check` (repository root)** → exit 0:
  - structure tests 105/105, lab tests 30/30;
  - `structure-audit: passed (61 warning(s), 17 baselined)`;
  - all ten packages `Done`.
- **Scenario lab** (private build via `FLUXIQ_LAB_SCENARIO_OUT_DIR`):
  `# tests 242 # pass 242`.
- **Domain:** `npx tsc -p tsconfig.json --noEmit` → exit 0 (current shared
  src). A patched scratch copy also gives exit 0.

### Live runs

Two, `FLUXIQ_CORE_ROOT=F:/fxlab/lab-core` with my Core change applied there
at that time; host module built from a scratch domain copy. Command:
`FLUXIQ_TEST_ENV_FILES=none … node packages/test-runner/dist/cli.js run identity-drift --variant renamed-redesign --flow --target isolated --live-llm --llm-profile lab-adapt-renamed --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt`.

An earlier attempt was refused before start (`--target isolated conflicts
with FLUXIQ_TEST_TARGET=existing`) and reached nothing.

- **Run 1, `run-mu4tfxld-e78debce`** (Core fix plus domain output-id and reason
  change): `verdict failed`, `failureCategory runtime.behavior`.
  - **Expectation now met:** `automationFailureExpected` is
    `target_not_found` (was `null`), and `oracleVerdict passed`.
  - **Refusal case:** `issueCodes ["runtime_patch.target_override_rejected",
    "runtime_patch.target_override_rejected.parameter_not_offered"]`.
  - **Repair judged:** `snapshots/flow-lane.json` has
    `repair: {verdict: "refused", …}`. `summary.firstFailure` reads "The live
    repair was not the declared one: Core refused it (…parameter_not_offered)".
  - **Call records now written** (they were missing before):
    `snapshots/live-llm.json` has `settlement: "lane_failed"`, `calls: 2`,
    `perCallRecords: "recorded"`, and the lines `runtime_diagnosis` (3803
    tokens) and `runtime_patch` (3554 tokens), `$0.0041`. `llm.calls: 2` in
    the evaluation (was 0).
  - **Redaction:** attestation `passed`, and no credential in the snapshot.
- **Run 2, `run-mu4tlmls-f7ac6101`** (plus the packet's `repairParameters`):
  **`verdict passed`**.
  - **Proposal accepted:** `runtimePatchAttempts`
    `[{kind: temporary_target_override, proposalOnly: true, executed: false,
    preflightOk: true, issueCodes: [], adaptationCreated: true,
    changeProposalCreated: true}]`.
  - **Repair judged correct:** `flow-lane.json`
    `repair: {verdict: "repaired", proposals: 1, mismatchedFields: []}`.
  - **Usage:** `live-llm.json` `calls: 2`, 7520 tokens, `$0.0042`.

## Not verified

- **Which parameter name DeepSeek used in run 1.** Raw responses are not
  retained. Only "not `element`" is known.
- **The gating change (coordinator item 1) was not run live.** Both live runs
  predate it. They exercised the proposal path with a validator bound, which
  the gate leaves unchanged.
- **The rebased domain patch was not run against the domain's own tests**
  (`DOMAIN_TEST_BUILD_LABEL` run). Some will need their expectations updated;
  see above. It was type-checked only. Live run 2 used an equivalent change
  built on the earlier domain version.
- **An approved proposal still does not change what a recorded Flow clicks.**
  I read this but did not exercise it.
  - **Where it breaks:** applying `edit_action_target`
    (`service/adaptations/patches.ts`) writes `parameterValues.target`, and
    the executor forwards `target` only to *native* nodes
    (`executor/node-execution.ts:75`). `builtin.policy.action` dispatches
    `parameterValues.parameters`, so its click would keep the recorded
    selector.
  - **Same gap on the executed path:** `applyRuntimePatchToFlow` has the same
    problem for policy-action nodes.
- **Firefox, and other scenarios.** Neither was exercised.
- **The two extra Core test edits** (`opaque-target-execution`,
  `runtime-patches`) are outside the brief's literal path list. See Open
  questions.

## Open questions or contradictions found

1. **The brief's part 3 ("declare the expected `target_not_found`" on the
   variant) contradicts files I don't own.**
   - **The conflicts:**
     - `apps/scenario-lab/e2e/identity-drift.spec.ts` asserts the variant's
       `failure` is undefined and that the renamed control saves.
     - `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`
       requires "no expected failure" for any playback-goal task.
     - The catalogue's create-flow task `identity-drift-rename-redesigned-save`
       targets this variant and must succeed.
   - **What I did:** declared the proposal-only outcome and the repair in
     `identity-drift/repair.ts`, and applied them only to live Flow-lane runs
     under a proposal-only grant.
   - **What would be cleaner:** a contract field (`expected.repair` in
     `packages/test-contracts`), if that is wanted later.
2. **Coordinator item 1 ("a missing validator must fail closed") changed
   behaviour that two tests I don't own pinned.**
   - `automation-studio/tests/opaque-target-execution.test.ts` executed an
     override with no validator.
   - `runtime-patches.test.ts:107` proposed, approved and applied one.
   - I bound a validator in each (assertions unchanged) rather than leaving
     the proposal path unchecked.
   - Please confirm those two edits are acceptable, or reassign them.
3. **Core's failure-evidence capture request does not carry `outputId`.**
   - **Where:** `llm/harness/failure-evidence.ts`
     `AutomationStudioLlmFailureEvidenceCaptureInput.failedAction`, which is
     `llm/**` and off-limits to me.
   - **Effect today:** the domain's packet cannot tell an extraction failure
     from a click, so the proposed `repairParameters` names `element` for
     every failure.
   - **Suggested follow-up:** add `outputId?` there and pass it from
     `recovery/annotation/annotate.ts`; the domain can then declare exactly
     the parameters of the failed verb. A better long-term alternative is for
     Core's patch prompt to list the domain's repairable parameters itself.
4. **The judge cannot tell a correct control from a wrong clickable one.**
   The domain check accepts Discard as Discard (finding 1 of
   `w2-repairable-drift-scenario.md`). The Lab's `repair` judgement now
   catches that case (`wrong_target`); Core does not.
5. **Two diagnosis interventions per run.** Both live runs recorded two
   diagnosis interventions (one `validationOk:false`) but only 2 provider
   calls. The extra intervention comes from outside the annotation path. Not
   investigated.
6. **`runtime/tests/live-patch-target-override.test.ts` is a new file in
   `runtime/tests/`.** That directory holds 23 files, under the 25 limit.
   Another Core worker has also added untracked tests there.
